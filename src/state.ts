import type { Adjustment, Bill, Item } from "./lib/bill";

export type Action =
  | { type: "load"; bill: Bill }
  | { type: "setTitle"; title: string }
  | { type: "setCurrency"; currency: string; units: Bill }
  | { type: "addPerson"; id: string; name: string }
  | { type: "renamePerson"; id: string; name: string }
  | { type: "removePerson"; id: string }
  | { type: "addItem"; item: Item }
  | { type: "updateItem"; id: string; patch: Partial<Omit<Item, "id">> }
  | { type: "removeItem"; id: string }
  | { type: "toggleSharer"; itemId: string; personId: string }
  | { type: "setPortions"; itemId: string; personId: string; portions: number }
  | { type: "addAdjustment"; adjustment: Adjustment }
  | { type: "updateAdjustment"; id: string; patch: Partial<Omit<Adjustment, "id">> }
  | { type: "removeAdjustment"; id: string }
  | { type: "setPaidBy"; personId: string | null }
  | { type: "setReceipt"; cents: number | null };

export function reducer(bill: Bill, action: Action): Bill {
  switch (action.type) {
    case "load":
      return action.bill;
    case "setTitle":
      return { ...bill, title: action.title };
    case "setCurrency":
      // `units` is the bill already converted to the new currency's minor units.
      return { ...action.units, currency: action.currency };
    case "addPerson":
      return { ...bill, people: [...bill.people, { id: action.id, name: action.name }] };
    case "renamePerson":
      return { ...bill, people: bill.people.map((p) => (p.id === action.id ? { ...p, name: action.name } : p)) };
    case "removePerson": {
      const items = bill.items.map((item) => {
        if (!(action.id in item.shares)) return item;
        const shares = { ...item.shares };
        delete shares[action.id];
        return { ...item, shares };
      });
      return {
        ...bill,
        people: bill.people.filter((p) => p.id !== action.id),
        items,
        paidBy: bill.paidBy === action.id ? null : bill.paidBy,
      };
    }
    case "addItem":
      return { ...bill, items: [...bill.items, action.item] };
    case "updateItem":
      return { ...bill, items: bill.items.map((it) => (it.id === action.id ? { ...it, ...action.patch } : it)) };
    case "removeItem":
      return { ...bill, items: bill.items.filter((it) => it.id !== action.id) };
    case "toggleSharer":
      return {
        ...bill,
        items: bill.items.map((it) => {
          if (it.id !== action.itemId) return it;
          const shares = { ...it.shares };
          if (shares[action.personId]) delete shares[action.personId];
          else shares[action.personId] = 1;
          return { ...it, shares };
        }),
      };
    case "setPortions":
      return {
        ...bill,
        items: bill.items.map((it) => {
          if (it.id !== action.itemId) return it;
          const portions = Math.max(1, Math.min(99, Math.round(action.portions)));
          return { ...it, shares: { ...it.shares, [action.personId]: portions } };
        }),
      };
    case "addAdjustment":
      return { ...bill, adjustments: [...bill.adjustments, action.adjustment] };
    case "updateAdjustment":
      return {
        ...bill,
        adjustments: bill.adjustments.map((a) => (a.id === action.id ? { ...a, ...action.patch } : a)),
      };
    case "removeAdjustment":
      return { ...bill, adjustments: bill.adjustments.filter((a) => a.id !== action.id) };
    case "setPaidBy":
      return { ...bill, paidBy: action.personId };
    case "setReceipt":
      return { ...bill, receiptCents: action.cents };
  }
}

let counter = 0;
/** Short unique ids; they only need to be unique within one bill. */
export function newId(prefix: string): string {
  counter += 1;
  const random = Math.random().toString(36).slice(2, 7);
  return `${prefix}-${random}${counter.toString(36)}`;
}

/** Re-express every amount when the currency's number of decimals changes (e.g. AUD to JPY). */
export function convertUnits(bill: Bill, fromDigits: number, toDigits: number): Bill {
  if (fromDigits === toDigits) return bill;
  const scale = (v: number) =>
    toDigits > fromDigits ? v * 10 ** (toDigits - fromDigits) : Math.round(v / 10 ** (fromDigits - toDigits));
  return {
    ...bill,
    items: bill.items.map((it) => ({ ...it, unitCents: scale(it.unitCents) })),
    adjustments: bill.adjustments.map((a) => (a.kind === "amount" ? { ...a, value: scale(a.value) } : a)),
    receiptCents: bill.receiptCents == null ? null : scale(bill.receiptCents),
  };
}
