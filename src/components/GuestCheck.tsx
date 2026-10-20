import { useId } from "react";
import type { Bill, Split } from "../lib/bill";
import { settleUp } from "../lib/bill";
import { formatMoney } from "../lib/money";
import { MoneyInput } from "./MoneyInput";

interface Props {
  bill: Bill;
  split: Split;
  checkNumber: string;
  onPaidBy: (personId: string | null) => void;
  onReceipt: (cents: number | null) => void;
  onCopySummary: () => void;
  onShare: () => void;
}

/** The results, drawn as a diner guest check. */
export function GuestCheck({ bill, split, checkNumber, onPaidBy, onReceipt, onCopySummary, onShare }: Props) {
  const money = (cents: number) => formatMoney(cents, bill.currency);
  const payerId = useId();
  const debts = settleUp(split, bill.paidBy);
  const diff = split.receiptDifference;
  const hasContent = bill.people.length > 0 && bill.items.length > 0;

  return (
    <section className="check" id="check" aria-labelledby="check-heading">
      <header className="check-head">
        <h2 id="check-heading">Guest check</h2>
        <span className="check-number" aria-label={`Check number ${checkNumber}`}>
          No. {checkNumber}
        </span>
      </header>
      <p className="check-title">{bill.title.trim() || "Untitled bill"}</p>

      {!hasContent ? (
        <p className="check-empty">
          {bill.people.length === 0
            ? "Add the people at the table to see who owes what."
            : "Add what you ordered to see who owes what."}
        </p>
      ) : (
        <>
          <ul className="totals" aria-label="What each person owes">
            {split.people.map((p) => (
              <li key={p.person.id}>
                <details>
                  <summary>
                    <span className="who">{p.person.name.trim() || "Unnamed"}</span>
                    <span className="amount">{money(p.totalCents)}</span>
                  </summary>
                  {p.lines.length === 0 ? (
                    <p className="breakdown-empty">Nothing on this bill yet.</p>
                  ) : (
                    <table className="breakdown">
                      <caption className="visually-hidden">Breakdown for {p.person.name}</caption>
                      <tbody>
                        {p.lines.map((line, i) => (
                          <tr key={i}>
                            <th scope="row">
                              {line.label}
                              <span className="detail">{line.detail}</span>
                            </th>
                            <td>{money(line.cents)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </details>
              </li>
            ))}
          </ul>

          <dl className="sums">
            <div>
              <dt>Food and drink</dt>
              <dd>{money(split.itemsCents)}</dd>
            </div>
            {split.extras.map(({ adjustment, cents }) => (
              <div key={adjustment.id}>
                <dt>
                  {adjustment.label.trim() || "Extra"}
                  {adjustment.kind === "percent" && ` (${adjustment.value}%)`}
                </dt>
                <dd>{money(cents)}</dd>
              </div>
            ))}
            <div className="grand">
              <dt>Total</dt>
              <dd>{money(split.totalCents)}</dd>
            </div>
          </dl>

          <div className="receipt-check">
            <MoneyInput
              label="Total printed on the receipt"
              cents={bill.receiptCents}
              currency={bill.currency}
              allowEmpty
              placeholder="Optional"
              onChange={onReceipt}
            />
            {diff != null && (
              <p className={diff === 0 ? "match" : "mismatch"} role="status">
                {diff === 0
                  ? "Matches the receipt to the cent."
                  : diff > 0
                    ? `${money(diff)} more than the receipt. Check for a duplicated item or an extra that is already included.`
                    : `${money(-diff)} short of the receipt. Check for a missing item, tax or surcharge.`}
              </p>
            )}
          </div>

          <div className="settle">
            <label htmlFor={payerId}>Who paid?</label>
            <select
              id={payerId}
              value={bill.paidBy ?? ""}
              onChange={(e) => onPaidBy(e.target.value || null)}
            >
              <option value="">Nobody yet</option>
              {bill.people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name.trim() || "Unnamed"}
                </option>
              ))}
            </select>
            {debts.length > 0 && (
              <ul className="debts" aria-label="Who owes the payer">
                {debts.map((d) => (
                  <li key={d.from.id}>
                    <span>
                      {d.from.name.trim() || "Unnamed"} pays {d.to.name.trim() || "the payer"}
                    </span>
                    <span className="amount">{money(d.cents)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {split.unassigned.length > 0 && (
            <p className="mismatch" role="status">
              Some items aren’t assigned to anyone.
            </p>
          )}

          <div className="check-actions">
            <button type="button" className="button primary" onClick={onShare}>
              Share link
            </button>
            <button type="button" className="button" onClick={onCopySummary}>
              Copy summary
            </button>
          </div>
        </>
      )}
    </section>
  );
}
