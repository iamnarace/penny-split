import { describe, expect, it } from "vitest";
import type { Bill } from "./bill";
import { sampleBill } from "./sample";
import { billFromHash, decodeBill, encodeBill, ShareError } from "./share";
import { summaryText } from "./summary";
import { computeSplit } from "./bill";

describe("share links", () => {
  it("round-trips a bill exactly", () => {
    const bill = sampleBill("AUD");
    expect(decodeBill(encodeBill(bill))).toEqual(bill);
  });

  it("round-trips unicode names and titles", () => {
    const bill: Bill = {
      ...sampleBill("NPR"),
      title: "दशैं dinner 🍛",
      people: [{ id: "x", name: "Sanjeev Shrestha" }, { id: "y", name: "Zoë" }],
    };
    bill.items = bill.items.map((it) => ({ ...it, shares: {} }));
    bill.paidBy = "y";
    expect(decodeBill(encodeBill(bill))).toEqual(bill);
  });

  it("produces URL-safe tokens", () => {
    expect(encodeBill(sampleBill("AUD"))).toMatch(/^1\.[A-Za-z0-9_-]+$/);
  });

  it("reads from a location hash", () => {
    const bill = sampleBill("USD");
    expect(billFromHash(`#b=${encodeBill(bill)}`)).toEqual(bill);
    expect(billFromHash("")).toBeNull();
    expect(billFromHash("#section")).toBeNull();
  });

  it("explains broken or tampered links", () => {
    expect(() => decodeBill("1.not-base64!!")).toThrow(ShareError);
    expect(() => decodeBill("2.abc")).toThrow(/newer version/);
    expect(() => decodeBill("garbage")).toThrow(ShareError);
    const token = encodeBill(sampleBill("AUD"));
    expect(() => decodeBill(token.slice(0, token.length - 20))).toThrow(ShareError);
  });

  it("rejects invalid values instead of trusting them", () => {
    const tamper = (mutate: (packed: Record<string, unknown>) => void) => {
      const packed = JSON.parse(atob(encodeBill(sampleBill("AUD")).slice(2).replace(/-/g, "+").replace(/_/g, "/")));
      mutate(packed);
      const json = btoa(unescape(encodeURIComponent(JSON.stringify(packed))));
      return `1.${json.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")}`;
    };
    expect(() => decodeBill(tamper((p) => (p.c = "XXXX")))).toThrow(/currency/);
    expect(() => decodeBill(tamper((p) => ((p.i as unknown[][])[0][2] = -5)))).toThrow(/item/);
    expect(() => decodeBill(tamper((p) => ((p.i as unknown[][])[0][3] = 0)))).toThrow(/item/);
    expect(() => decodeBill(tamper((p) => ((p.a as unknown[][])[0][2] = "z")))).toThrow(/extra/);
    expect(() => decodeBill(tamper((p) => (p.p = [["dup", "A"], ["dup", "B"]])))).toThrow(/people/);
    // A payer who isn't on the bill is dropped, not trusted.
    expect(decodeBill(tamper((p) => (p.w = "stranger"))).paidBy).toBeNull();
  });
});

describe("summaryText", () => {
  it("lists totals, the payer and extras", () => {
    const bill = sampleBill("AUD");
    const text = summaryText(bill, computeSplit(bill), "en-AU");
    expect(text.split("\n")[0]).toBe("Friday dinner at Lucia's: $174.49");
    expect(text).toContain("Chloe paid, so:");
    expect(text).toMatch(/Ana owes \$\d+\.\d\d/);
    expect(text).toContain("Includes Weekend surcharge $14.10, Tip $19.39");
  });
});
