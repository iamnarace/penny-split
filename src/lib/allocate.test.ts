import { describe, expect, it } from "vitest";
import { allocate, divideRounded, percentOf } from "./allocate";

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

describe("allocate", () => {
  it("splits evenly and gives the odd cent to the first person", () => {
    expect(allocate(100, [1, 1, 1])).toEqual([34, 33, 33]);
    expect(allocate(1000, [1, 1, 1])).toEqual([334, 333, 333]);
  });

  it("splits in proportion to weights", () => {
    expect(allocate(2400, [1, 1, 2])).toEqual([600, 600, 1200]);
    expect(allocate(1000, [2, 1])).toEqual([667, 333]);
  });

  it("gives leftover cents to the largest remainders, not just the first", () => {
    // Exact shares 1.0, 2.5, 6.5 -> the two halves get the two leftover... only one left over.
    expect(allocate(10, [10, 25, 65])).toEqual([1, 3, 6]);
    expect(sum(allocate(10, [10, 25, 65]))).toBe(10);
  });

  it("handles negative totals symmetrically", () => {
    expect(allocate(-100, [1, 1, 1])).toEqual([-34, -33, -33]);
  });

  it("splits evenly when every weight is zero", () => {
    expect(allocate(9, [0, 0, 0])).toEqual([3, 3, 3]);
  });

  it("never gives anything to a zero weight when others are positive", () => {
    expect(allocate(101, [0, 1, 0, 1])).toEqual([0, 51, 0, 50]);
  });

  it("always adds up exactly (randomised)", () => {
    let seed = 42;
    const rand = () => {
      seed = (seed * 1103515245 + 12345) % 2 ** 31;
      return seed / 2 ** 31;
    };
    for (let run = 0; run < 2000; run++) {
      const n = 1 + Math.floor(rand() * 9);
      const weights = Array.from({ length: n }, () => Math.floor(rand() * 5000));
      const total = Math.floor(rand() * 2_000_000) - 500_000;
      const parts = allocate(total, weights);
      expect(sum(parts)).toBe(total);
      // No part differs from its exact share by a cent or more.
      const wsum = sum(weights) || n;
      parts.forEach((part, i) => {
        const exact = (total * (sum(weights) ? weights[i] : 1)) / wsum;
        expect(Math.abs(part - exact)).toBeLessThan(1);
      });
    }
  });

  it("works with amounts far beyond floating-point comfort", () => {
    const parts = allocate(9_007_199_254_740, [3, 7, 11]);
    expect(sum(parts)).toBe(9_007_199_254_740);
  });

  it("rejects invalid input", () => {
    expect(() => allocate(1.5, [1])).toThrow(RangeError);
    expect(() => allocate(1, [-1])).toThrow(RangeError);
    expect(() => allocate(1, [0.5])).toThrow(RangeError);
    expect(() => allocate(5, [])).toThrow(RangeError);
    expect(allocate(0, [])).toEqual([]);
  });
});

describe("percentOf", () => {
  it("rounds half away from zero to the cent", () => {
    expect(percentOf(1005, 10)).toBe(101); // 100.5 -> 101
    expect(percentOf(1004, 10)).toBe(100);
    expect(percentOf(-1005, 10)).toBe(-101);
  });

  it("keeps three decimal places of the percentage", () => {
    expect(percentOf(10000, 8.875)).toBe(888); // 887.5 -> 888
    expect(percentOf(10000, 12.5)).toBe(1250);
    expect(percentOf(333, 1.5)).toBe(5); // 4.995 -> 5
  });

  it("is exact where floating point is not", () => {
    // 1.15 * 100 = 114.99999999999999 in floating point.
    expect(percentOf(115, 100)).toBe(115);
    expect(percentOf(29, 50)).toBe(15); // 14.5 -> 15
  });
});

describe("divideRounded", () => {
  it("rounds to the nearest integer, halves away from zero", () => {
    expect(divideRounded(5n, 2n)).toBe(3n);
    expect(divideRounded(-5n, 2n)).toBe(-3n);
    expect(divideRounded(4n, 3n)).toBe(1n);
  });
});
