import type { Adjustment, Bill, Item, Person } from "./bill";
import { isValidCurrency } from "./money";

/**
 * Bills are shared in the URL fragment (`#b=...`). Fragments are never sent to
 * a server, so a shared bill only exists in the link itself.
 *
 * Format: "1." + base64url(UTF-8 JSON) using short keys to keep links short.
 * The leading version number lets future releases change the format and still
 * read old links.
 */
const VERSION = "1";
export const MAX_LINK_CHARS = 16_000;

type Packed = {
  t: string;
  c: string;
  p: [string, string][];
  i: [string, string, number, number, [string, number][]][];
  a: [string, string, "p" | "a", number, "p" | "e", 0 | 1][];
  w: string | null;
  r: number | null;
};

export class ShareError extends Error {}

export function encodeBill(bill: Bill): string {
  const packed: Packed = {
    t: bill.title,
    c: bill.currency,
    p: bill.people.map((p) => [p.id, p.name]),
    i: bill.items.map((it) => [it.id, it.name, it.unitCents, it.quantity, Object.entries(it.shares)]),
    a: bill.adjustments.map((a) => [
      a.id,
      a.label,
      a.kind === "percent" ? "p" : "a",
      a.value,
      a.split === "proportional" ? "p" : "e",
      a.compound ? 1 : 0,
    ]),
    w: bill.paidBy,
    r: bill.receiptCents,
  };
  return `${VERSION}.${toBase64Url(JSON.stringify(packed))}`;
}

export function decodeBill(token: string): Bill {
  const dot = token.indexOf(".");
  if (dot < 1) throw new ShareError("This link is missing its bill data.");
  const version = token.slice(0, dot);
  if (version !== VERSION) {
    throw new ShareError(`This link was made by a newer version of penny-split (format ${version}).`);
  }
  let raw: unknown;
  try {
    raw = JSON.parse(fromBase64Url(token.slice(dot + 1)));
  } catch {
    throw new ShareError("This link looks incomplete. Ask for it to be shared again.");
  }
  return validate(raw);
}

export function billFromHash(hash: string): Bill | null {
  const match = /^#?b=(.+)$/.exec(hash);
  return match ? decodeBill(decodeURIComponent(match[1])) : null;
}

function fail(what: string): never {
  throw new ShareError(`This link contains an invalid ${what}.`);
}

const isStr = (v: unknown, max = 200): v is string => typeof v === "string" && v.length <= max;
const isInt = (v: unknown): v is number => Number.isSafeInteger(v);

function validate(raw: unknown): Bill {
  if (typeof raw !== "object" || raw === null) fail("bill");
  const r = raw as Record<string, unknown>;
  if (!isStr(r.t, 120)) fail("title");
  if (!isStr(r.c, 3) || !isValidCurrency(r.c)) fail("currency");
  if (!Array.isArray(r.p) || r.p.length > 50) fail("list of people");
  if (!Array.isArray(r.i) || r.i.length > 300) fail("list of items");
  if (!Array.isArray(r.a) || r.a.length > 20) fail("list of extras");

  const people: Person[] = r.p.map((p: unknown) => {
    if (!Array.isArray(p) || !isStr(p[0], 40) || !isStr(p[1], 60)) fail("person");
    return { id: p[0], name: p[1] };
  });
  const ids = new Set(people.map((p) => p.id));
  if (ids.size !== people.length) fail("list of people");

  const items: Item[] = r.i.map((it: unknown) => {
    if (!Array.isArray(it) || it.length !== 5) fail("item");
    const [id, name, unitCents, quantity, shares] = it as unknown[];
    if (!isStr(id, 40) || !isStr(name, 120) || !isInt(unitCents) || !isInt(quantity)) fail("item");
    if (unitCents < 0 || unitCents > 1e11 || quantity < 1 || quantity > 999) fail("item");
    if (!Array.isArray(shares)) fail("item");
    const map: Record<string, number> = {};
    for (const entry of shares) {
      if (!Array.isArray(entry) || !isStr(entry[0], 40) || !isInt(entry[1]) || entry[1] < 1 || entry[1] > 99) {
        fail("item share");
      }
      if (ids.has(entry[0])) map[entry[0]] = entry[1];
    }
    return { id, name, unitCents, quantity, shares: map };
  });

  const adjustments: Adjustment[] = r.a.map((a: unknown) => {
    if (!Array.isArray(a) || a.length !== 6) fail("extra");
    const [id, label, kind, value, split, compound] = a as unknown[];
    if (!isStr(id, 40) || !isStr(label, 60) || (kind !== "p" && kind !== "a")) fail("extra");
    if (typeof value !== "number" || !Number.isFinite(value)) fail("extra");
    if (kind === "p" && (value < -100 || value > 1000)) fail("extra");
    if (kind === "a" && (!isInt(value) || Math.abs(value) > 1e11)) fail("extra");
    if ((split !== "p" && split !== "e") || (compound !== 0 && compound !== 1)) fail("extra");
    return {
      id,
      label,
      kind: kind === "p" ? "percent" : "amount",
      value,
      split: split === "p" ? "proportional" : "even",
      compound: compound === 1,
    };
  });

  const paidBy = r.w === null || r.w === undefined ? null : isStr(r.w, 40) && ids.has(r.w) ? r.w : null;
  const receiptCents = r.r === null || r.r === undefined ? null : isInt(r.r) && r.r >= 0 ? r.r : fail("receipt total");

  return { title: r.t, currency: r.c, people, items, adjustments, paidBy, receiptCents };
}

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(data: string): string {
  const base64 = data.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64 + "=".repeat((4 - (base64.length % 4)) % 4));
  const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}
