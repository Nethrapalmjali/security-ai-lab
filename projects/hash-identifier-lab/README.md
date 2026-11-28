# Hash Identifier & Integrity Lab

Identify what kind of hash you are looking at, compute MD5/SHA digests of text or dropped files, verify a download against a vendor hash, measure file entropy and see why fast hashes are unsuitable for passwords — 100% client-side.

## How it works
- `hashlab.js` holds the pure logic. MD5 is implemented from RFC 1321 (Web Crypto omits it); SHA-1/256/384/512 use `crypto.subtle.digest`.
- `identify()` recognises self-describing formats by prefix (bcrypt with cost factor, Argon2i/d/id, yescrypt, scrypt, sha256/512crypt, md5crypt, apr1, PBKDF2, MySQL 4.1+, LDAP SSHA) and otherwise guesses from hex length or Base64 length, returning every plausible candidate with a strength rating.
- Shannon entropy (bits/byte) classifies data as text, binary, compressed or encrypted-looking.
- Verification compares the expected hash against all digests (hex or Base64) with a branch-free comparison.
- The benchmark measures this device's SHA-256 rate and one 600k-iteration PBKDF2 call to illustrate key stretching and brute-force economics.
- `test.mjs` checks RFC 1321 vectors, MD5 padding boundaries against Node's crypto, SHA known answers, entropy, identification and time maths.

Run tests: `node projects/hash-identifier-lab/test.mjs`

## Concepts demonstrated
Hash vs. password hash, salting, work factors, memory-hard KDFs, collisions (MD5/SHA-1), file integrity vs. authenticity, entropy as a forensic signal.

## Limitations
Hash identification by length is inherently ambiguous. Files are hashed in memory (500 MB cap). No cracking functionality is included. Entropy thresholds are heuristics.
