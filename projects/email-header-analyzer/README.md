# Email Header Analyzer

Paste raw email headers and get a trust score, SPF/DKIM/DMARC outcomes, spoofing indicators and the hop-by-hop delivery path. 100% client-side.

## How it works
- `analyzer.js` (pure, DOM-free): RFC 5322 header unfolding, `Authentication-Results` / `Received-SPF` parsing, `DKIM-Signature` tag parsing, `Received` chain parsing (reversed to origin→destination, per-hop delay, IPs, TLS).
- Heuristics: From vs Return-Path vs DKIM `d=` alignment (organizational-domain approximation), Reply-To redirection, display-name address spoofing, punycode domains, duplicate From, SHA-1/`l=`/unsigned-From DKIM weaknesses, backwards timestamps (forged Received headers), private/public origin IP.
- `app.js` builds the DOM with `createElement`/`textContent` only, so header contents can never inject HTML.
- `test.mjs`: `node test.mjs` (no dependencies).

## Concepts demonstrated
Email authentication (SPF, DKIM, DMARC alignment), phishing/BEC indicators, header forensics, trust boundaries (only headers added by *your* receiving server are trustworthy).

## Limitations
It cannot verify DKIM signatures or query DNS; it relies on the receiver’s `Authentication-Results`. Organizational domain uses a small built-in public-suffix list, not the full PSL. Scoring is heuristic, not a verdict.
