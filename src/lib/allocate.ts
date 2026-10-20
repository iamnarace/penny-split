/**
 * Split an integer amount (in minor units, e.g. cents) into parts proportional
 * to integer `weights`, so that the parts always add up to exactly `total`.
 *
 * Uses the largest remainder method with exact integer (BigInt) arithmetic:
 * every part gets the floor of its exact share, then the leftover units go one
 * at a time to the parts with the largest remainders. Ties go to the earlier
 * index, so results are stable and predictable (the first person listed
 * absorbs the odd cent).
 *
 * Negative totals (discounts) are allocated by magnitude and negated.
 * If every weight is zero the amount is split evenly.
 */
export function allocate(total: number, weights: readonly number[]): number[] {
  if (!Number.isSafeInteger(total)) throw new RangeError(`total must be a safe integer, got ${total}`);
  if (weights.some((w) => !Number.isSafeInteger(w) || w < 0)) {
    throw new RangeError("weights must be non-negative integers");
  }
  if (weights.length === 0) {
    if (total !== 0) throw new RangeError("cannot allocate a non-zero amount to nobody");
    return [];
  }
  if (total < 0) return allocate(-total, weights).map((part) => (part === 0 ? 0 : -part));

  const effective = weights.every((w) => w === 0) ? weights.map(() => 1) : weights;
  const big = effective.map(BigInt);
  const sum = big.reduce((a, b) => a + b, 0n);
  const amount = BigInt(total);

  const parts = big.map((w) => (amount * w) / sum);
  const remainders = big.map((w, index) => ({ index, remainder: (amount * w) % sum }));
  let leftover = amount - parts.reduce((a, b) => a + b, 0n);

  remainders
    .filter(({ index }) => big[index] > 0n)
    .sort((a, b) => (a.remainder === b.remainder ? a.index - b.index : a.remainder > b.remainder ? -1 : 1))
    .forEach(({ index }) => {
      if (leftover > 0n) {
        parts[index] += 1n;
        leftover -= 1n;
      }
    });

  return parts.map(Number);
}

/**
 * `numerator / denominator` rounded half away from zero, exactly.
 * Used to turn percentages into whole cents.
 */
export function divideRounded(numerator: bigint, denominator: bigint): bigint {
  if (denominator <= 0n) throw new RangeError("denominator must be positive");
  const negative = numerator < 0n;
  const magnitude = negative ? -numerator : numerator;
  const quotient = (magnitude * 2n + denominator) / (denominator * 2n);
  return negative ? -quotient : quotient;
}

/** Percent of an amount in whole minor units. Percent is honoured to 3 decimal places. */
export function percentOf(baseCents: number, percent: number): number {
  const thousandths = BigInt(Math.round(percent * 1000));
  return Number(divideRounded(BigInt(baseCents) * thousandths, 100_000n));
}
