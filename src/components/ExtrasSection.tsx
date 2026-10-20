import { useId } from "react";
import type { Adjustment } from "../lib/bill";
import { PRESETS, type Preset } from "../lib/presets";
import { MoneyInput } from "./MoneyInput";

interface Props {
  adjustments: Adjustment[];
  currency: string;
  onAdd: (preset: Preset) => void;
  onUpdate: (id: string, patch: Partial<Omit<Adjustment, "id">>) => void;
  onRemove: (adjustment: Adjustment) => void;
}

export function ExtrasSection({ adjustments, currency, onAdd, onUpdate, onRemove }: Props) {
  return (
    <section className="panel" aria-labelledby="extras-heading">
      <h2 id="extras-heading">Tax, tip and other extras</h2>
      {adjustments.length === 0 && (
        <p className="hint">
          Skip this if the receipt’s prices already include everything. Percentages are shared in proportion to what
          each person ordered.
        </p>
      )}
      {adjustments.length > 0 && (
        <ol className="extras">
          {adjustments.map((a, index) => (
            <ExtraRow
              key={a.id}
              adjustment={a}
              first={index === 0}
              currency={currency}
              onUpdate={onUpdate}
              onRemove={onRemove}
            />
          ))}
        </ol>
      )}
      <div className="presets" role="group" aria-label="Add an extra">
        {PRESETS.map((preset) => (
          <button key={preset.label} type="button" className="button subtle" onClick={() => onAdd(preset)}>
            + {preset.label}
          </button>
        ))}
      </div>
    </section>
  );
}

function ExtraRow({
  adjustment: a,
  first,
  currency,
  onUpdate,
  onRemove,
}: {
  adjustment: Adjustment;
  first: boolean;
  currency: string;
  onUpdate: Props["onUpdate"];
  onRemove: Props["onRemove"];
}) {
  const id = useId();
  const name = a.label.trim() || "this extra";
  return (
    <li className="extra">
      <span className="field extra-label">
        <label htmlFor={`${id}-label`} className="visually-hidden">
          Name of extra
        </label>
        <input
          id={`${id}-label`}
          value={a.label}
          placeholder="Name"
          onChange={(e) => onUpdate(a.id, { label: e.target.value })}
        />
      </span>

      <span className="segmented" role="group" aria-label={`How ${name} is entered`}>
        <button
          type="button"
          aria-pressed={a.kind === "percent"}
          onClick={() => a.kind !== "percent" && onUpdate(a.id, { kind: "percent", value: 10 })}
        >
          %
        </button>
        <button
          type="button"
          aria-pressed={a.kind === "amount"}
          onClick={() => a.kind !== "amount" && onUpdate(a.id, { kind: "amount", value: 0, compound: false })}
        >
          Amount
        </button>
      </span>

      {a.kind === "percent" ? (
        <span className="field percent">
          <label htmlFor={`${id}-pct`} className="visually-hidden">
            Percent for {name}
          </label>
          <input
            id={`${id}-pct`}
            type="number"
            inputMode="decimal"
            step="0.5"
            min={-100}
            max={1000}
            value={a.value}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (e.target.value !== "" && Number.isFinite(v) && v >= -100 && v <= 1000) {
                onUpdate(a.id, { value: Math.round(v * 1000) / 1000 });
              }
            }}
          />
          <span aria-hidden="true">%</span>
        </span>
      ) : (
        <MoneyInput
          label={`Amount for ${name}`}
          hideLabel
          className="amount"
          cents={a.value}
          currency={currency}
          allowNegative
          placeholder="-5.00 for a discount"
          onChange={(cents) => onUpdate(a.id, { value: cents ?? 0 })}
        />
      )}

      <span className="field split-select">
        <label htmlFor={`${id}-split`} className="visually-hidden">
          How {name} is shared
        </label>
        <select
          id={`${id}-split`}
          value={a.split}
          onChange={(e) => onUpdate(a.id, { split: e.target.value as Adjustment["split"] })}
        >
          <option value="proportional">By what each ordered</option>
          <option value="even">Evenly</option>
        </select>
      </span>

      {a.kind === "percent" && !first && (
        <label className="check-option">
          <input type="checkbox" checked={a.compound} onChange={(e) => onUpdate(a.id, { compound: e.target.checked })} />
          Apply to extras above
        </label>
      )}

      <button type="button" className="icon-button" aria-label={`Remove ${name}`} onClick={() => onRemove(a)}>
        ×
      </button>
    </li>
  );
}
