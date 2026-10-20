import type { Bill, Split } from "./bill";
import { settleUp } from "./bill";
import { formatMoney } from "./money";

/** A plain-text summary that reads well when pasted into a group chat. */
export function summaryText(bill: Bill, split: Split, locale?: string): string {
  const money = (cents: number) => formatMoney(cents, bill.currency, locale);
  const title = bill.title.trim() || "Our bill";
  const lines = [`${title}: ${money(split.totalCents)}`];

  const width = Math.max(...split.people.map((p) => (p.person.name.trim() || "Someone").length), 0);
  for (const p of split.people) {
    lines.push(`${(p.person.name.trim() || "Someone").padEnd(width)}  ${money(p.totalCents)}`);
  }

  const debts = settleUp(split, bill.paidBy);
  if (debts.length > 0) {
    lines.push("");
    lines.push(`${debts[0].to.name.trim() || "The payer"} paid, so:`);
    for (const d of debts) lines.push(`${d.from.name.trim() || "Someone"} owes ${money(d.cents)}`);
  }
  const extras = split.extras.filter((e) => e.cents !== 0);
  if (extras.length > 0) {
    lines.push("");
    lines.push(`Includes ${extras.map((e) => `${e.adjustment.label.trim() || "extras"} ${money(e.cents)}`).join(", ")}`);
  }
  return lines.join("\n");
}
