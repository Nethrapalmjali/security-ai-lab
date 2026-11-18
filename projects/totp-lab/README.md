# TOTP / HOTP Lab

Generate and verify time-based one-time passwords (the codes in Google Authenticator, Authy, etc.), audit a 2FA configuration and build/import `otpauth://` URIs — 100% client-side.

## How it works
- `totp.js` implements RFC 4648 Base32, RFC 4226 HOTP (HMAC + dynamic truncation) and RFC 6238 TOTP (counter = floor(unix time / period)) on the Web Crypto API (SHA-1/256/512).
- Verification checks a configurable ± step window and reports the clock drift matched, using a non-early-exit comparison.
- The audit flags short secrets (< 128 bits per RFC 4226), low diversity, long periods and wide windows.
- `test.mjs` validates against the official RFC 4226 Appendix D and RFC 6238 Appendix B vectors for all three hashes.

Run tests: `node projects/totp-lab/test.mjs`

## Concepts demonstrated
HMAC, shared-secret MFA, replay windows, clock drift, brute-force odds of short codes, secret entropy.

## Limitations
Educational: use demo secrets, not real account secrets. No QR rendering; HOTP counter mode is library-only. Server-side rate limiting and replay protection (reject reused codes) are not modelled.
