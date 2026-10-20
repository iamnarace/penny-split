# Changelog

All notable changes are documented here, following [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.1.0] - 2026-10-20

### Added

- Item-by-item splitting with shared items, uneven portions and quantities.
- Extras as percentages or amounts (tip, tax, service charge, card surcharge, delivery, discounts), shared proportionally or evenly, optionally compounding.
- Exact allocation in integer minor units with the largest-remainder method.
- Receipt-total check, settle-up for the person who paid, copy-as-text summary.
- Versioned, validated share links in the URL fragment; local persistence; undo for removals.
- Currency picker with correct minor units (including JPY).
- Vitest suite, Playwright browser tests, and CI with registry signature and advisory checks.
