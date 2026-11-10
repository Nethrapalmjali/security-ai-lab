# JWT Inspector & Weakness Checker

Paste a JSON Web Token to decode it and get a scored security audit. 100% client-side — no uploads, no dependencies.

**Live:** https://nethrapalmjali.github.io/security-ai-lab/projects/jwt-inspector/

## What it does
- Decodes header, payload and signature (base64url, strict UTF-8/JSON validation); converts `exp`/`iat`/`nbf` to dates.
- Flags: `alg: none`, empty signature, weak HMAC secrets (dictionary attack with Web Crypto), `jku`/`jwk`/`x5u` key-injection headers, injection-like `kid`, missing/expired/long-lived `exp`, future `nbf`/`iat`, missing `iss`/`aud`/`jti`, sensitive claim names.
- Scores the token 0–100 by severity and verifies HMAC signatures against a secret you type.
- Example tokens (weak secret, well-formed, alg:none, many issues) for instant try-out.

## How it works
`jwt.js` holds pure logic (`parseJwt`, `analyze`, `verifyHmac`, `findWeakSecret`) using `crypto.subtle` HMAC; `app.js` renders results with `textContent` only (no `innerHTML`), so token contents can't inject markup. Run tests with `node test.mjs`.

## Concepts demonstrated
JWT structure, algorithm-confusion and `none` attacks, offline secret cracking of HS256, key-reference injection, claim hygiene (RFC 7519), encoding vs encryption.

## Limitations
Does not verify RSA/ECDSA signatures, does not fetch keys, and the ~35-word dictionary is a demo, not a cracker. Use only on tokens you are authorised to test.
