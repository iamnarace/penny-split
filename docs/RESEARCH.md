# Research notes

Research carried out on 2026-10-20.

## Problem and users

People eating out in groups need to split one bill fairly: some items are personal, some shared, sometimes unevenly, and tax, tip, surcharges and discounts sit on top. Even splits are unfair; hand calculations are slow and rarely add up to the receipt.

**Intended users:** friends and colleagues splitting a restaurant, bar or takeaway bill; travellers; anyone who wants a quick, fair split without creating an account.

## Comparable solutions

| Solution | Strengths | How penny-split differs |
|---|---|---|
| Spliit (open source, MIT) | Group ledgers, balances, uneven splits, PWA, optional receipt scanning | Needs a Next.js server and PostgreSQL; receipt scanning uses an external AI API; focused on running balances, not a single receipt's line items |
| Splitwise | Very widely used running balances between friends | Account-based and proprietary |
| App-store single-bill splitters (e.g. Splittz, Tab, various "bill splitter" apps) | Quick receipt splitting, some with scanning | Mostly closed source; rounding behaviour is rarely documented |

penny-split doesn't claim to be the first itemised splitter. Its specific angle:

- **Exactness you can verify.** It uses integer arithmetic and largest-remainder allocation, documented and covered by randomised tests, so shares always equal the total.
- **A receipt check** against the printed total.
- **Nothing to sign up for or host.** It's a static page, and the bill travels inside the link.

## Technical decisions

- **Integer minor units and BigInt.** Prevents floating-point drift (`0.1 + 0.2`) and makes proportional allocation exact even for large totals.
- **Largest remainder with stable tie-breaking.** Exact sum, each share within one cent of its exact value, and predictable results (the first person listed absorbs the odd cent).
- **Percentages to three decimals, rounded half away from zero.** This matches how people round money by hand, and supports rates like 8.875%.
- **Strict input parsing.** Supports common grouping and decimal conventions but rejects ambiguous input instead of guessing (found and fixed during testing: `1.2.3` was once read as 123.00).
- **URL-fragment sharing** with a version prefix and field-by-field validation; no backend.
- **Self-hosted, OFL-licensed fonts** so the app makes no third-party requests.

## Sources

- Spliit repository: https://github.com/spliit-app/spliit
- Spliit on Open Collective: https://opencollective.com/spliit
- Splittz on the App Store (comparable app): https://apps.apple.com/app/id6753856271
- Largest remainder method: https://en.wikipedia.org/wiki/Largest_remainders_method
- MDN, `Intl.NumberFormat`: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/NumberFormat
- Fontsource: https://fontsource.org/
