/** Currencies offered in the picker. Any ISO 4217 code also works in shared links. */
export const CURRENCIES = [
  "AUD", "USD", "EUR", "GBP", "NZD", "CAD", "SGD", "INR", "NPR", "JPY",
] as const;

const REGION_CURRENCY: Record<string, string> = {
  AU: "AUD", US: "USD", GB: "GBP", NZ: "NZD", CA: "CAD", SG: "SGD", IN: "INR", NP: "NPR", JP: "JPY",
  IE: "EUR", DE: "EUR", FR: "EUR", ES: "EUR", IT: "EUR", NL: "EUR", PT: "EUR", AT: "EUR", BE: "EUR", FI: "EUR",
};

/** Best guess at the person's currency from a BCP 47 locale such as "en-AU". */
export function guessCurrency(locale: string | undefined): string {
  const region = locale?.split(/[-_]/)[1]?.toUpperCase();
  return (region && REGION_CURRENCY[region]) || "USD";
}

export function isValidCurrency(code: string): boolean {
  if (!/^[A-Z]{3}$/.test(code)) return false;
  try {
    new Intl.NumberFormat("en", { style: "currency", currency: code });
    return true;
  } catch {
    return false;
  }
}

/** Number of minor-unit digits for a currency (2 for AUD, 0 for JPY). */
export function fractionDigits(currency: string): number {
  return new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions().maximumFractionDigits ?? 2;
}

const formatters = new Map<string, Intl.NumberFormat>();

export function formatMoney(minor: number, currency: string, locale?: string): string {
  const key = `${locale ?? ""}|${currency}`;
  let formatter = formatters.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, { style: "currency", currency });
    formatters.set(key, formatter);
  }
  return formatter.format(minor / 10 ** fractionDigits(currency));
}

/** Format minor units as a plain editable number, e.g. 1250 -> "12.50". */
export function toInputValue(minor: number, currency: string): string {
  const digits = fractionDigits(currency);
  const sign = minor < 0 ? "-" : "";
  const abs = Math.abs(minor);
  if (digits === 0) return `${sign}${abs}`;
  const unit = 10 ** digits;
  return `${sign}${Math.floor(abs / unit)}.${String(abs % unit).padStart(digits, "0")}`;
}

/**
 * Parse what someone typed into a price field. Returns minor units, or null if
 * it isn't a usable amount.
 *
 * Accepts "12", "12.5", "$12.50", "1,234.50", "1 234,50" and "12,50" (a comma
 * followed by one or two digits at the end is treated as a decimal separator).
 * Rejects more decimals than the currency allows, letters, and empty input.
 */
export function parseMoney(input: string, currency: string, { allowNegative = false } = {}): number | null {
  const digits = fractionDigits(currency);
  let text = input.trim().replace(/[\s  ']/g, "");
  if (!text) return null;

  let negative = false;
  if (text.startsWith("-") || text.startsWith("−")) {
    negative = true;
    text = text.slice(1);
  }
  text = text.replace(/^[^\d.,]+/, "").replace(/[^\d.,]+$/, ""); // currency symbols or codes
  if (!text || /[^\d.,]/.test(text)) return null;

  const lastComma = text.lastIndexOf(",");
  const lastDot = text.lastIndexOf(".");
  let decimalSep: "." | "," | null = null;
  if (lastDot >= 0 && lastComma >= 0) decimalSep = lastDot > lastComma ? "." : ",";
  else if (lastDot >= 0) decimalSep = text.indexOf(".") === lastDot ? "." : null;
  else if (lastComma >= 0 && /,\d{1,2}$/.test(text) && text.indexOf(",") === lastComma) decimalSep = ",";

  let whole = text;
  let fraction = "";
  if (decimalSep) {
    const at = text.lastIndexOf(decimalSep);
    whole = text.slice(0, at);
    fraction = text.slice(at + 1);
  }
  const groupSep = decimalSep === "," ? "." : ",";
  if (whole.includes(".") && decimalSep !== ",") {
    // Dots without a decimal role must be thousands separators: "1.234.567".
    if (decimalSep === "." || !validGrouping(whole, ".")) return null;
    whole = whole.replaceAll(".", "");
  }
  if (whole.includes(groupSep)) {
    if (!validGrouping(whole, groupSep)) return null;
    whole = whole.replaceAll(groupSep, "");
  }
  if (!/^\d*$/.test(whole) || !/^\d*$/.test(fraction)) return null;
  if (whole === "" && fraction === "") return null;
  if (fraction.length > digits) return null;

  const value = Number(whole || "0") * 10 ** digits + Number(fraction.padEnd(digits, "0") || "0");
  if (!Number.isSafeInteger(value)) return null;
  if (negative && !allowNegative) return null;
  return negative ? -value : value;
}

/** "1,234,567" is valid grouping; "1,23", "12,,5" and ",123" are not. */
function validGrouping(text: string, sep: string): boolean {
  const groups = text.split(sep);
  return /^\d{1,3}$/.test(groups[0]) && groups.slice(1).every((g) => /^\d{3}$/.test(g));
}
