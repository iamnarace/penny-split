# Security policy

## Supported versions

Only the latest version on `main` receives fixes.

## Reporting a vulnerability

Please don't open a public issue for security problems. Use GitHub's private vulnerability reporting ("Report a vulnerability" on the repository's **Security** tab). If that isn't available, open an issue asking for a private contact, without details.

## Scope

penny-split is a static page with no backend. In scope: script injection via names, items or share links; crafted links that crash or freeze the page; anything that sends bill data off the device; dependency issues affecting the shipped bundle. Anyone holding a share link can read that bill; that is expected behaviour.
