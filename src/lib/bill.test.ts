import { describe, expect, it } from "vitest";
import { type Bill, computeSplit, emptyBill, settleUp } from "./bill";
import { sampleBill } from "./sample";

const people = [
  { id: "a", name: "Ana" },
  { id: "b", name: "Ben" },
  { id: "c", name: "Chloe" },
];

function bill(overrides: Partial<Bill>): Bill {
  return { ...emptyBill("AUD"), people, ...overrides };
}

const totalsOf = (b: Bill) => computeSplit(b).people.map((p) => p.totalCents);

describe("computeSplit", () => {
  it("charges single-person items to that person", () => {
    const b = bill({ items: [{ id: "1", name: "Pasta", unitCents: 2500, quantity: 1, shares: { b: 1 } }] });
    expect(totalsOf(b)).toEqual([0, 2500, 0]);
  });

  it("shares unassigned items between everyone", () => {
    const b = bill({ items: [{ id: "1", name: "Bread", unitCents: 1000, quantity: 1, shares: {} }] });
    expect(totalsOf(b)).toEqual([334, 333, 333]);
  });

  it("uses quantity times unit price", () => {
    const b = bill({ items: [{ id: "1", name: "Beer", unitCents: 950, quantity: 3, shares: { a: 1 } }] });
    expect(totalsOf(b)).toEqual([2850, 0, 0]);
  });

  it("honours uneven portions", () => {
    const b = bill({ items: [{ id: "1", name: "Pizza", unitCents: 2400, quantity: 1, shares: { a: 1, c: 2 } }] });
    expect(totalsOf(b)).toEqual([800, 0, 1600]);
    const line = computeSplit(b).people[2].lines[0];
    expect(line.detail).toBe("2 of 3 portions");
  });

  it("shares percentage extras in proportion to what each person ordered", () => {
    const b = bill({
      items: [
        { id: "1", name: "Steak", unitCents: 6000, quantity: 1, shares: { a: 1 } },
        { id: "2", name: "Salad", unitCents: 2000, quantity: 1, shares: { b: 1 } },
        { id: "3", name: "Soup", unitCents: 2000, quantity: 1, shares: { c: 1 } },
      ],
      adjustments: [{ id: "t", label: "Tip", kind: "percent", value: 10, split: "proportional", compound: false }],
    });
    const split = computeSplit(b);
    expect(split.extras[0].cents).toBe(1000);
    expect(totalsOf(b)).toEqual([6600, 2200, 2200]);
    expect(split.totalCents).toBe(11000);
  });

  it("splits fixed extras evenly when asked", () => {
    const b = bill({
      items: [{ id: "1", name: "Curry", unitCents: 3000, quantity: 1, shares: { a: 1 } }],
      adjustments: [{ id: "d", label: "Delivery", kind: "amount", value: 700, split: "even", compound: false }],
    });
    expect(totalsOf(b)).toEqual([3234, 233, 233]);
  });

  it("applies discounts as negative amounts", () => {
    const b = bill({
      items: [
        { id: "1", name: "A", unitCents: 3000, quantity: 1, shares: { a: 1 } },
        { id: "2", name: "B", unitCents: 1000, quantity: 1, shares: { b: 1 } },
      ],
      adjustments: [{ id: "x", label: "Voucher", kind: "amount", value: -1000, split: "proportional", compound: false }],
    });
    expect(totalsOf(b)).toEqual([2250, 750, 0]);
  });

  it("compounds a tip on top of earlier extras only when asked", () => {
    const items = [{ id: "1", name: "Meal", unitCents: 10000, quantity: 1, shares: {} }];
    const tax = { id: "tax", label: "Tax", kind: "percent" as const, value: 10, split: "proportional" as const, compound: false };
    const tip = { id: "tip", label: "Tip", kind: "percent" as const, value: 20, split: "proportional" as const };
    expect(computeSplit(bill({ items, adjustments: [tax, { ...tip, compound: false }] })).totalCents).toBe(13000);
    expect(computeSplit(bill({ items, adjustments: [tax, { ...tip, compound: true }] })).totalCents).toBe(13200);
  });

  it("always reconciles: shares add up to the total (sample bill)", () => {
    const sample = sampleBill("AUD");
    const split = computeSplit(sample);
    expect(split.people.reduce((a, p) => a + p.totalCents, 0)).toBe(split.totalCents);
    // Items 141.00, +10% surcharge = 14.10, +12.5% tip on 155.10 = 19.3875 -> 19.39
    expect(split.itemsCents).toBe(14100);
    expect(split.extras.map((e) => e.cents)).toEqual([1410, 1939]);
    expect(split.totalCents).toBe(17449);
  });

  it("reconciles across many awkward bills", () => {
    for (let n = 1; n <= 7; n++) {
      const ps = Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `P${i}` }));
      const b: Bill = {
        ...emptyBill("AUD"),
        people: ps,
        items: [
          { id: "1", name: "x", unitCents: 1001, quantity: 1, shares: {} },
          { id: "2", name: "y", unitCents: 333, quantity: 3, shares: { p0: 3, [`p${n - 1}`]: 1 } },
        ],
        adjustments: [
          { id: "a", label: "Tax", kind: "percent", value: 8.875, split: "proportional", compound: false },
          { id: "b", label: "Tip", kind: "percent", value: 17.5, split: "proportional", compound: true },
          { id: "c", label: "Fee", kind: "amount", value: 199, split: "even", compound: false },
        ],
      };
      const split = computeSplit(b);
      expect(split.people.reduce((a, p) => a + p.totalCents, 0)).toBe(split.totalCents);
    }
  });

  it("compares against the receipt", () => {
    const b = bill({
      items: [{ id: "1", name: "Pie", unitCents: 1000, quantity: 1, shares: {} }],
      receiptCents: 1050,
    });
    expect(computeSplit(b).receiptDifference).toBe(-50);
  });

  it("flags items when nobody is at the table", () => {
    const b: Bill = { ...emptyBill("AUD"), items: [{ id: "1", name: "Pie", unitCents: 1000, quantity: 1, shares: {} }] };
    const split = computeSplit(b);
    expect(split.unassigned).toHaveLength(1);
    expect(split.totalCents).toBe(1000);
  });

  it("ignores shares for people who are no longer at the table", () => {
    const b = bill({ items: [{ id: "1", name: "Pie", unitCents: 900, quantity: 1, shares: { gone: 1 } }] });
    expect(totalsOf(b)).toEqual([300, 300, 300]);
  });
});

describe("settleUp", () => {
  it("lists what everyone else owes the payer", () => {
    const b = bill({
      items: [{ id: "1", name: "Pie", unitCents: 900, quantity: 1, shares: {} }],
      paidBy: "b",
    });
    const debts = settleUp(computeSplit(b), "b");
    expect(debts.map((d) => [d.from.name, d.to.name, d.cents])).toEqual([
      ["Ana", "Ben", 300],
      ["Chloe", "Ben", 300],
    ]);
    expect(settleUp(computeSplit(b), null)).toEqual([]);
    expect(settleUp(computeSplit(b), "nobody")).toEqual([]);
  });
});
