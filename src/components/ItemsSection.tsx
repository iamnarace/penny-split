import type { Item, Person } from "../lib/bill";
import { lineTotal } from "../lib/bill";
import { formatMoney } from "../lib/money";
import { MoneyInput } from "./MoneyInput";

interface Props {
  items: Item[];
  people: Person[];
  currency: string;
  onAdd: () => void;
  onUpdate: (id: string, patch: Partial<Omit<Item, "id">>) => void;
  onRemove: (item: Item) => void;
  onToggle: (itemId: string, personId: string) => void;
  onEveryone: (itemId: string) => void;
  onPortions: (itemId: string, personId: string, portions: number) => void;
}

export function ItemsSection(props: Props) {
  const { items, people, currency, onAdd } = props;
  return (
    <section className="panel" aria-labelledby="items-heading">
      <h2 id="items-heading">What you ordered</h2>
      {items.length === 0 ? (
        <p className="hint">Add each line from the receipt, then tap who had it. Shared dishes split evenly unless you set portions.</p>
      ) : (
        <ol className="items">
          {items.map((item, index) => (
            <ItemRow key={item.id} item={item} index={index} {...props} isLast={index === items.length - 1} />
          ))}
        </ol>
      )}
      <button type="button" className="button" onClick={onAdd}>
        Add item
      </button>
    </section>
  );
}

function ItemRow({
  item,
  index,
  people,
  currency,
  isLast,
  onAdd,
  onUpdate,
  onRemove,
  onToggle,
  onEveryone,
  onPortions,
}: Props & { item: Item; index: number; isLast: boolean }) {
  const chosen = people.filter((p) => (item.shares[p.id] ?? 0) > 0);
  const everyone = chosen.length === 0;
  const uneven = chosen.some((p) => item.shares[p.id] !== 1);
  const label = item.name.trim() || `item ${index + 1}`;

  return (
    <li className="item">
      <div className="item-main">
        <span className="field item-name">
          <label htmlFor={`${item.id}-name`} className="visually-hidden">
            Item {index + 1} name
          </label>
          <input
            id={`${item.id}-name`}
            value={item.name}
            placeholder="What was it?"
            autoComplete="off"
            data-item-name
            onChange={(e) => onUpdate(item.id, { name: e.target.value })}
          />
        </span>
        <span className="field qty">
          <label htmlFor={`${item.id}-qty`}>Qty</label>
          <input
            id={`${item.id}-qty`}
            type="number"
            inputMode="numeric"
            min={1}
            max={999}
            value={item.quantity}
            onChange={(e) => {
              const q = Math.round(Number(e.target.value));
              if (Number.isFinite(q) && q >= 1 && q <= 999) onUpdate(item.id, { quantity: q });
            }}
          />
        </span>
        <MoneyInput
          label={item.quantity > 1 ? "Each" : "Price"}
          className="price"
          cents={item.unitCents}
          currency={currency}
          onChange={(cents) => onUpdate(item.id, { unitCents: cents ?? 0 })}
          onEnter={isLast ? onAdd : undefined}
        />
        <span className="line-total" aria-label={`Line total for ${label}`}>
          {formatMoney(lineTotal(item), currency)}
        </span>
        <button type="button" className="icon-button" aria-label={`Remove ${label}`} onClick={() => onRemove(item)}>
          ×
        </button>
      </div>

      {people.length > 0 && (
        <div className="sharers" role="group" aria-label={`Who had ${label}`}>
          <button
            type="button"
            className="chip"
            aria-pressed={everyone}
            onClick={() => onEveryone(item.id)}
          >
            Everyone
          </button>
          {people.map((p) => {
            const portions = item.shares[p.id] ?? 0;
            const on = portions > 0;
            return (
              <span key={p.id} className={`chip-group${on && uneven ? " with-portions" : ""}`}>
                <button type="button" className="chip" aria-pressed={on} onClick={() => onToggle(item.id, p.id)}>
                  {p.name.trim() || "Unnamed"}
                </button>
                {on && chosen.length > 1 && (
                  <span className="portions">
                    <button
                      type="button"
                      className="portion-button"
                      aria-label={`Fewer portions for ${p.name}`}
                      disabled={portions <= 1}
                      onClick={() => onPortions(item.id, p.id, portions - 1)}
                    >
                      −
                    </button>
                    <span aria-live="polite" aria-label={`${p.name} has ${portions} portion${portions === 1 ? "" : "s"}`}>
                      {portions}
                    </span>
                    <button
                      type="button"
                      className="portion-button"
                      aria-label={`More portions for ${p.name}`}
                      disabled={portions >= 99}
                      onClick={() => onPortions(item.id, p.id, portions + 1)}
                    >
                      +
                    </button>
                  </span>
                )}
              </span>
            );
          })}
        </div>
      )}
    </li>
  );
}
