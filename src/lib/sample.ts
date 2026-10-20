import type { Bill } from "./bill";

/** A realistic example bill used by "Try an example". */
export function sampleBill(currency: string): Bill {
  return {
    title: "Friday dinner at Lucia's",
    currency,
    people: [
      { id: "p-ana", name: "Ana" },
      { id: "p-ben", name: "Ben" },
      { id: "p-chloe", name: "Chloe" },
      { id: "p-dev", name: "Dev" },
    ],
    items: [
      { id: "i-1", name: "Margherita pizza", unitCents: 2400, quantity: 1, shares: { "p-ana": 1, "p-ben": 1, "p-dev": 2 } },
      { id: "i-2", name: "Lamb ragu pappardelle", unitCents: 3200, quantity: 1, shares: { "p-chloe": 1 } },
      { id: "i-3", name: "Burrata with figs", unitCents: 2200, quantity: 1, shares: {} },
      { id: "i-4", name: "Negroni", unitCents: 1900, quantity: 2, shares: { "p-ana": 1, "p-chloe": 1 } },
      { id: "i-5", name: "Sparkling water", unitCents: 900, quantity: 1, shares: {} },
      { id: "i-6", name: "Tiramisu", unitCents: 1600, quantity: 1, shares: { "p-ben": 1, "p-dev": 1 } },
    ],
    adjustments: [
      { id: "a-1", label: "Weekend surcharge", kind: "percent", value: 10, split: "proportional", compound: false },
      { id: "a-2", label: "Tip", kind: "percent", value: 12.5, split: "proportional", compound: true },
    ],
    paidBy: "p-chloe",
    receiptCents: null,
  };
}
