import { useEffect, useId, useState } from "react";
import { parseMoney, toInputValue } from "../lib/money";

interface Props {
  label: string;
  hideLabel?: boolean;
  cents: number | null;
  currency: string;
  onChange: (cents: number | null) => void;
  allowNegative?: boolean;
  allowEmpty?: boolean;
  placeholder?: string;
  className?: string;
  onEnter?: () => void;
}

/**
 * A text field for money. It keeps whatever the person is typing, commits the
 * value only when it parses, and explains what's wrong otherwise.
 */
export function MoneyInput({
  label,
  hideLabel,
  cents,
  currency,
  onChange,
  allowNegative = false,
  allowEmpty = false,
  placeholder = "0.00",
  className,
  onEnter,
}: Props) {
  const id = useId();
  const [text, setText] = useState(cents == null ? "" : toInputValue(cents, currency));
  const [error, setError] = useState<string | null>(null);

  // Follow outside changes (loading a shared bill, switching currency).
  useEffect(() => {
    setText((current) => {
      const parsed = parseMoney(current, currency, { allowNegative });
      if (parsed === cents || (cents == null && current.trim() === "")) return current;
      return cents == null ? "" : toInputValue(cents, currency);
    });
  }, [cents, currency, allowNegative]);

  function handle(value: string) {
    setText(value);
    if (value.trim() === "") {
      if (allowEmpty) {
        setError(null);
        onChange(null);
      } else {
        setError(null);
        onChange(0);
      }
      return;
    }
    const parsed = parseMoney(value, currency, { allowNegative });
    if (parsed == null) {
      setError(allowNegative ? "Enter an amount like 12.50 or -5" : "Enter an amount like 12.50");
    } else {
      setError(null);
      onChange(parsed);
    }
  }

  return (
    <span className={`field money ${className ?? ""}`}>
      <label htmlFor={id} className={hideLabel ? "visually-hidden" : undefined}>
        {label}
      </label>
      <input
        id={id}
        inputMode="decimal"
        autoComplete="off"
        value={text}
        placeholder={placeholder}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        onChange={(e) => handle(e.target.value)}
        onBlur={() => {
          if (!error && cents != null) setText(toInputValue(cents, currency));
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && onEnter) {
            e.preventDefault();
            onEnter();
          }
        }}
      />
      {error && (
        <span id={`${id}-error`} className="field-error" role="alert">
          {error}
        </span>
      )}
    </span>
  );
}
