import { allocate, percentOf } from "./allocate";

export { percentOf };

export interface Person {
  id: string;
  name: string;
}

export interface Item {
  id: string;
  name: string;
  /** Price of one unit in minor units. */
  unitCents: number;
  quantity: number;
  /**
   * Who had it, as person id -> portions. An empty object means everyone at
   * the table shares it equally. Portions let "Sam had two of the three
   * slices" split 2:1.
   */
  shares: Record<string, number>;
}

export type AdjustmentKind = "percent" | "amount";

export interface Adjustment {
  id: string;
  label: string;
  kind: AdjustmentKind;
  /** Percent (e.g. 12.5) for "percent"; minor units (negative for discounts) for "amount". */
  value: number;
  /** How the extra is shared: in proportion to what each person ordered, or evenly. */
  split: "proportional" | "even";
  /** For percentages: also apply to the extras listed before this one (tip on top of tax). */
  compound: boolean;
}

export interface Bill {
  title: string;
  currency: string;
  people: Person[];
  items: Item[];
  adjustments: Adjustment[];
  paidBy: string | null;
  /** Total printed on the receipt, to check the split against. */
  receiptCents: number | null;
}

export interface Line {
  label: string;
  cents: number;
  /** e.g. "1 of 3 portions" or "proportional share of 10%". */
  detail: string;
}

export interface PersonSplit {
  person: Person;
  itemCents: number;
  extraCents: number;
  totalCents: number;
  lines: Line[];
}

export interface Split {
  people: PersonSplit[];
  itemsCents: number;
  extras: { adjustment: Adjustment; cents: number }[];
  totalCents: number;
  /** Items that nobody can be charged for (there's nobody at the table). */
  unassigned: Item[];
  /** totalCents minus the receipt total, when one was entered. */
  receiptDifference: number | null;
}

export function lineTotal(item: Item): number {
  return item.unitCents * item.quantity;
}

/** The people an item is shared between, with their portions, in table order. */
export function sharersOf(item: Item, people: Person[]): { person: Person; portions: number }[] {
  const named = people
    .map((person) => ({ person, portions: item.shares[person.id] ?? 0 }))
    .filter((entry) => entry.portions > 0);
  return named.length > 0 ? named : people.map((person) => ({ person, portions: 1 }));
}

export function computeSplit(bill: Bill): Split {
  const { people } = bill;
  const index = new Map(people.map((p, i) => [p.id, i]));
  const itemShare = people.map(() => 0);
  const lines: Line[][] = people.map(() => []);
  const unassigned: Item[] = [];
  let itemsCents = 0;

  for (const item of bill.items) {
    const total = lineTotal(item);
    itemsCents += total;
    if (people.length === 0) {
      if (total !== 0) unassigned.push(item);
      continue;
    }
    const sharers = sharersOf(item, people);
    const portions = sharers.map((s) => s.portions);
    const totalPortions = portions.reduce((a, b) => a + b, 0);
    const parts = allocate(total, portions);
    sharers.forEach(({ person, portions: mine }, i) => {
      const at = index.get(person.id)!;
      itemShare[at] += parts[i];
      const label = item.name.trim() || "Untitled item";
      const detail =
        sharers.length === 1
          ? item.quantity > 1 ? `${item.quantity} × unit price` : "all of it"
          : totalPortions === sharers.length
            ? `split ${sharers.length} ways`
            : `${mine} of ${totalPortions} portions`;
      lines[at].push({ label, cents: parts[i], detail });
    });
  }

  const running = [...itemShare];
  const extraShare = people.map(() => 0);
  const extras: Split["extras"] = [];
  let runningTotal = itemsCents;

  for (const adjustment of bill.adjustments) {
    const base = adjustment.kind === "percent" && adjustment.compound ? runningTotal : itemsCents;
    const cents = adjustment.kind === "percent" ? percentOf(base, adjustment.value) : Math.trunc(adjustment.value);
    extras.push({ adjustment, cents });
    runningTotal += cents;
    if (people.length === 0 || cents === 0) continue;

    const weights =
      adjustment.split === "even"
        ? people.map(() => 1)
        : adjustment.kind === "percent" && adjustment.compound
          ? running
          : itemShare;
    const parts = allocate(cents, weights.map((w) => Math.max(0, w)));
    const label = adjustment.label.trim() || (adjustment.kind === "percent" ? `${adjustment.value}%` : "Extra");
    parts.forEach((part, i) => {
      extraShare[i] += part;
      running[i] += part;
      if (part !== 0) {
        lines[i].push({
          label,
          cents: part,
          detail: adjustment.split === "even" ? "split evenly" : "in proportion to your order",
        });
      }
    });
  }

  const split: PersonSplit[] = people.map((person, i) => ({
    person,
    itemCents: itemShare[i],
    extraCents: extraShare[i],
    totalCents: itemShare[i] + extraShare[i],
    lines: lines[i],
  }));

  return {
    people: split,
    itemsCents,
    extras,
    totalCents: runningTotal,
    unassigned,
    receiptDifference: bill.receiptCents == null ? null : runningTotal - bill.receiptCents,
  };
}

/** Who owes the person who paid, and how much. */
export function settleUp(split: Split, paidBy: string | null): { from: Person; to: Person; cents: number }[] {
  if (!paidBy) return [];
  const payer = split.people.find((p) => p.person.id === paidBy)?.person;
  if (!payer) return [];
  return split.people
    .filter((p) => p.person.id !== paidBy && p.totalCents !== 0)
    .map((p) => ({ from: p.person, to: payer, cents: p.totalCents }));
}

export function emptyBill(currency: string): Bill {
  return { title: "", currency, people: [], items: [], adjustments: [], paidBy: null, receiptCents: null };
}
