import { describe, expect, it } from "vitest";
import { formatMoney, fractionDigits, guessCurrency, isValidCurrency, parseMoney, toInputValue } from "./money";

describe("parseMoney", () => {
  it.each([
    ["12", 1200],
    ["12.5", 1250],
    ["12.50", 1250],
    [".99", 99],
    ["$12.50", 1250],
    ["AU$ 1,234.50", 123450],
    ["1 234,50", 123450],
    ["12,50", 1250],
    ["1,234", 123400], // comma followed by three digits is a thousands separator
    ["1.234,56", 123456],
    ["1.234.567", 123456700], // dots as thousands separators
    ["1,234,567.89", 123456789],
    ["0", 0],
  ])("reads %s as %i cents", (input, cents) => {
    expect(parseMoney(input, "AUD")).toBe(cents);
  });

  it.each(["", "  ", "abc", "12.345", "1.2.3", "12..5", "1,2345", "1,23,456", ",123", "$", "1e5", "--5"])("rejects %j", (input) => {
    expect(parseMoney(input, "AUD")).toBeNull();
  });

  it("only accepts negatives when asked", () => {
    expect(parseMoney("-5", "AUD")).toBeNull();
    expect(parseMoney("-5", "AUD", { allowNegative: true })).toBe(-500);
    expect(parseMoney("−5.25", "AUD", { allowNegative: true })).toBe(-525);
  });

  it("respects currencies without minor units", () => {
    expect(parseMoney("1200", "JPY")).toBe(1200);
    expect(parseMoney("1200.5", "JPY")).toBeNull();
    expect(parseMoney("1,200", "JPY")).toBe(1200);
  });
});

describe("formatting", () => {
  it("knows minor units per currency", () => {
    expect(fractionDigits("AUD")).toBe(2);
    expect(fractionDigits("JPY")).toBe(0);
  });

  it("formats for display and for editing", () => {
    expect(formatMoney(123450, "AUD", "en-AU")).toBe("$1,234.50");
    expect(formatMoney(1200, "JPY", "en-US")).toBe("¥1,200");
    expect(toInputValue(1205, "AUD")).toBe("12.05");
    expect(toInputValue(-500, "AUD")).toBe("-5.00");
    expect(toInputValue(1200, "JPY")).toBe("1200");
  });

  it("round-trips every cent value through the input format", () => {
    for (let cents = 0; cents < 2000; cents += 7) {
      expect(parseMoney(toInputValue(cents, "AUD"), "AUD")).toBe(cents);
    }
  });
});

describe("currencies", () => {
  it("guesses from the locale region", () => {
    expect(guessCurrency("en-AU")).toBe("AUD");
    expect(guessCurrency("ne-NP")).toBe("NPR");
    expect(guessCurrency("de-DE")).toBe("EUR");
    expect(guessCurrency("en")).toBe("USD");
    expect(guessCurrency(undefined)).toBe("USD");
  });

  it("validates ISO codes", () => {
    expect(isValidCurrency("AUD")).toBe(true);
    expect(isValidCurrency("aud")).toBe(false);
    expect(isValidCurrency("ZZZZ")).toBe(false);
  });
});
