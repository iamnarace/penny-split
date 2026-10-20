import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { ExtrasSection } from "./components/ExtrasSection";
import { GuestCheck } from "./components/GuestCheck";
import { ItemsSection } from "./components/ItemsSection";
import { PeopleSection } from "./components/PeopleSection";
import { Toast, type ToastMessage } from "./components/Toast";
import { type Bill, computeSplit, emptyBill } from "./lib/bill";
import { CURRENCIES, formatMoney, fractionDigits, guessCurrency } from "./lib/money";
import type { Preset } from "./lib/presets";
import { sampleBill } from "./lib/sample";
import { billFromHash, encodeBill, MAX_LINK_CHARS, ShareError } from "./lib/share";
import { summaryText } from "./lib/summary";
import { convertUnits, newId, reducer } from "./state";

const STORAGE_KEY = "penny-split:bill";

interface Initial {
  bill: Bill;
  notice: ToastMessage | null;
}

function loadInitial(): Initial {
  const fallback = emptyBill(guessCurrency(typeof navigator === "undefined" ? undefined : navigator.language));
  try {
    const fromLink = billFromHash(window.location.hash);
    if (fromLink) {
      return {
        bill: fromLink,
        notice: { id: Date.now(), text: "Opened a shared bill. Your edits stay on this device until you share again." },
      };
    }
  } catch (error) {
    const text = error instanceof ShareError ? error.message : "This link couldn't be opened.";
    return { bill: readSaved() ?? fallback, notice: { id: Date.now(), text, tone: "error" } };
  }
  return { bill: readSaved() ?? fallback, notice: null };
}

function readSaved(): Bill | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    // Saved bills use the same validated format as links.
    return billFromHash(`#b=${raw}`);
  } catch {
    return null;
  }
}

/** A stable four-digit "check number" so a bill is easy to refer to in chat. */
function checkNumberFor(bill: Bill): string {
  const seed = bill.title + bill.people.map((p) => p.id).join("");
  let hash = 7;
  for (const ch of seed) hash = (hash * 31 + ch.charCodeAt(0)) % 10000;
  return String(hash).padStart(4, "0");
}

export default function App() {
  const [initial] = useState(loadInitial);
  const [bill, dispatch] = useReducer(reducer, initial.bill);
  const [toast, setToast] = useState<ToastMessage | null>(initial.notice);
  const split = useMemo(() => computeSplit(bill), [bill]);
  const latest = useRef(bill);
  useEffect(() => {
    latest.current = bill;
  }, [bill]);

  useEffect(() => {
    if (initial.notice && window.location.hash) {
      // The bill now lives in this tab; keep the address bar tidy.
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    }
  }, [initial.notice]);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, encodeBill(bill));
    } catch {
      // Storage can be unavailable (private mode, full quota). The app still works.
    }
  }, [bill]);

  const notify = useCallback((text: string, extra: Partial<ToastMessage> = {}) => {
    setToast({ id: Date.now(), text, ...extra });
  }, []);
  const dismiss = useCallback(() => setToast(null), []);

  /** Run a destructive change and offer to undo it. */
  const withUndo = useCallback(
    (text: string, change: () => void) => {
      const before = latest.current;
      change();
      notify(text, { action: { label: "Undo", run: () => dispatch({ type: "load", bill: before }) } });
    },
    [notify],
  );

  async function copy(text: string, done: string) {
    try {
      await navigator.clipboard.writeText(text);
      notify(done);
    } catch {
      window.prompt("Copy this:", text);
    }
  }

  async function share() {
    const url = `${window.location.origin}${window.location.pathname}#b=${encodeBill(bill)}`;
    if (url.length > MAX_LINK_CHARS) {
      notify("This bill is too long to fit in a link. Use Copy summary instead.", { tone: "error" });
      return;
    }
    const title = bill.title.trim() || "Our bill";
    if (typeof navigator.share === "function" && window.matchMedia("(pointer: coarse)").matches) {
      try {
        await navigator.share({ title, text: `${title}: who owes what`, url });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }
    await copy(url, "Link copied. Anyone with it sees this bill; it isn't stored anywhere else.");
  }

  function addAdjustment(preset: Preset) {
    dispatch({ type: "addAdjustment", adjustment: { id: newId("a"), ...preset } });
  }

  function changeCurrency(currency: string) {
    const units = convertUnits(bill, fractionDigits(bill.currency), fractionDigits(currency));
    dispatch({ type: "setCurrency", currency, units });
  }

  function addItem() {
    dispatch({ type: "addItem", item: { id: newId("i"), name: "", unitCents: 0, quantity: 1, shares: {} } });
    // Focus the new row's name field once it renders.
    requestAnimationFrame(() => {
      const fields = document.querySelectorAll<HTMLInputElement>("[data-item-name]");
      fields[fields.length - 1]?.focus();
    });
  }

  const empty = bill.people.length === 0 && bill.items.length === 0 && bill.adjustments.length === 0;
  const currencyOptions = (CURRENCIES as readonly string[]).includes(bill.currency)
    ? CURRENCIES
    : [bill.currency, ...CURRENCIES];

  return (
    <>
      <a className="skip-link" href="#check">
        Skip to the split
      </a>
      <header className="app-header">
        <div className="brand">
          <span className="logo" aria-hidden="true" />
          <span>penny-split</span>
        </div>
        <div className="header-fields">
          <span className="field title-field">
            <label htmlFor="bill-title" className="visually-hidden">
              Bill name
            </label>
            <input
              id="bill-title"
              value={bill.title}
              placeholder="Name this bill, e.g. Friday dinner"
              autoComplete="off"
              onChange={(e) => dispatch({ type: "setTitle", title: e.target.value })}
            />
          </span>
          <span className="field currency-field">
            <label htmlFor="currency">Currency</label>
            <select id="currency" value={bill.currency} onChange={(e) => changeCurrency(e.target.value)}>
              {currencyOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </span>
          {!empty && (
            <button
              type="button"
              className="button subtle"
              onClick={() =>
                withUndo("Started a new bill.", () => dispatch({ type: "load", bill: emptyBill(bill.currency) }))
              }
            >
              New bill
            </button>
          )}
        </div>
      </header>

      <main className="layout">
        <div className="editor">
          {empty && (
            <section className="intro">
              <h1>Split the bill to the cent.</h1>
              <p>
                Add who was there and what everyone had. Shared dishes, tax, tip and surcharges are divided fairly,
                and the shares always add up to the receipt. Nothing leaves your device unless you share a link.
              </p>
              <button
                type="button"
                className="button"
                onClick={() => dispatch({ type: "load", bill: sampleBill(bill.currency) })}
              >
                Try an example bill
              </button>
            </section>
          )}
          <PeopleSection
            people={bill.people}
            onAdd={(name) => dispatch({ type: "addPerson", id: newId("p"), name })}
            onRename={(id, name) => dispatch({ type: "renamePerson", id, name })}
            onRemove={(person) =>
              withUndo(`Removed ${person.name.trim() || "a person"}.`, () =>
                dispatch({ type: "removePerson", id: person.id }),
              )
            }
          />
          <ItemsSection
            items={bill.items}
            people={bill.people}
            currency={bill.currency}
            onAdd={addItem}
            onUpdate={(id, patch) => dispatch({ type: "updateItem", id, patch })}
            onRemove={(item) =>
              withUndo(`Removed ${item.name.trim() || "an item"}.`, () => dispatch({ type: "removeItem", id: item.id }))
            }
            onToggle={(itemId, personId) => dispatch({ type: "toggleSharer", itemId, personId })}
            onEveryone={(id) => dispatch({ type: "updateItem", id, patch: { shares: {} } })}
            onPortions={(itemId, personId, portions) => dispatch({ type: "setPortions", itemId, personId, portions })}
          />
          <ExtrasSection
            adjustments={bill.adjustments}
            currency={bill.currency}
            onAdd={addAdjustment}
            onUpdate={(id, patch) => dispatch({ type: "updateAdjustment", id, patch })}
            onRemove={(a) =>
              withUndo(`Removed ${a.label.trim() || "an extra"}.`, () => dispatch({ type: "removeAdjustment", id: a.id }))
            }
          />
        </div>

        <aside className="results">
          <GuestCheck
            bill={bill}
            split={split}
            checkNumber={checkNumberFor(bill)}
            onPaidBy={(personId) => dispatch({ type: "setPaidBy", personId })}
            onReceipt={(cents) => dispatch({ type: "setReceipt", cents })}
            onCopySummary={() => copy(summaryText(bill, split), "Summary copied.")}
            onShare={share}
          />
        </aside>
      </main>

      {bill.items.length > 0 && bill.people.length > 0 && (
        <a className="mobile-total" href="#check">
          <span>Total {formatMoney(split.totalCents, bill.currency)}</span>
          <span>See the split</span>
        </a>
      )}

      <footer className="app-footer">
        <p>
          penny-split runs entirely in your browser. Bills are saved on this device; shared links carry the bill in
          the part of the address that browsers never send to a server.{" "}
          <a href="https://github.com/iamnarace/penny-split">Source on GitHub</a>
        </p>
      </footer>

      <Toast toast={toast} onDismiss={dismiss} />
    </>
  );
}
