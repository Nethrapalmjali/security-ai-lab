# CSP Policy Evaluator

Paste a `Content-Security-Policy` header and get a 0–100 score, an A+…F grade and a severity-sorted list of weaknesses with concrete fixes. Runs 100% client-side.

**Live:** https://nethrapalmjali.github.io/security-ai-lab/projects/csp-evaluator/

## How it works
- `csp.js` (pure logic): parses the header (case-insensitive names, first duplicate wins per spec, optional `Content-Security-Policy[-Report-Only]:` prefix) and runs rule checks against the *effective* `script-src` (falling back to `default-src`).
- Rules cover `'unsafe-inline'` / `'unsafe-eval'` / `'unsafe-hashes'`, wildcard / scheme-only / `data:` / `blob:` / `http:` sources, allowlisted hosts known to host JSONP/Angular/user content, short nonces, missing `object-src`, `base-uri`, `frame-ancestors`, `form-action`, `upgrade-insecure-requests`, unknown (typo) directives, duplicates and report-only mode.
- Nonces/hashes and `'strict-dynamic'` are modelled: they neutralise `'unsafe-inline'` and host-allowlist bypass warnings, as in CSP Level 3 browsers.
- `app.js` renders results using `textContent` only (no `innerHTML`), so pasted policies can't inject markup.

## Concepts demonstrated
XSS mitigation via CSP, strict CSP (nonce + strict-dynamic), allowlist bypasses, clickjacking (`frame-ancestors`), base-tag injection, defence in depth.

## Tests
`node projects/csp-evaluator/test.mjs`

## Limitations
Static heuristics: it cannot verify that nonces are random per response, doesn't resolve `default-src` fallbacks for every fetch directive, and the bypass-host list is a curated subset. Not a substitute for Google's CSP Evaluator or testing in a browser.
