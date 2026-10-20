# Contributing to penny-split

Thanks for helping.

## Setup

```bash
npm install
npm run dev
```

## Before opening a pull request

```bash
npm run typecheck && npm run lint && npm test && npm run build
python e2e/smoke.py dist        # needs: pip install playwright && playwright install chromium
```

## Guidelines

- **Money stays in integer minor units.** Never introduce floating-point arithmetic on amounts; use `allocate`, `percentOf` and `divideRounded` from `src/lib/allocate.ts`.
- Any change to splitting or rounding needs a test showing that shares still sum exactly to the total.
- Input parsing should reject what it can't read unambiguously rather than guess.
- New dependencies need a reason in the pull request; prefer none. Runtime dependencies must work offline and make no network requests.
- Interface text should be plain and specific, and say what to do next.
- Add an entry under "Unreleased" in `CHANGELOG.md`.

## Reporting bugs

A share link to the bill (it contains only what you entered) plus what you expected is the fastest way to reproduce a problem.
