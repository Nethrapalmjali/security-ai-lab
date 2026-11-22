# Phishing URL Analyzer

Paste a suspicious link and get a 0–100 risk score with an explanation of every signal that fired. **Static analysis only** — the URL is never fetched, opened or sent anywhere.

## What it detects
- Brand typosquatting (`paypa1.com`, `rnicrosoft.com`) via leetspeak normalisation + Levenshtein distance
- Brand in subdomain/path of an unrelated registrable domain (`paypal.com.secure-verify.xyz`)
- `user@host` credential trick (`https://google.com@evil.net`)
- IP-literal hosts, including decimal/hex/octal obfuscation (`http://3232235777`)
- Punycode IDNs and mixed-script homographs (Cyrillic `а` vs Latin `a`), decoded with an RFC 3492 implementation
- URL shorteners, abused TLDs, excess subdomains, hyphen/digit-heavy domains, non-standard ports, plain HTTP
- Embedded redirect parameters, double URL-encoding, executable / double-extension downloads, `javascript:`/`data:` schemes, zero-width characters

## How it works
`phish.js` is a pure module (no DOM). It parses with the WHATWG `URL` class, derives the registrable domain (small multi-part-TLD list instead of the full Public Suffix List), and runs independent checks that each emit `{severity, title, detail}`. Severities map to weights (critical 40, high 22, medium 10, low 4) summed and capped at 100. Raw authority text is read separately because `URL` silently normalises obfuscated IPs. All output is built with `textContent`.

## Concepts
Social engineering via visual deception, homograph attacks (IDN spoofing), edit-distance similarity, explainable rule-based scoring.

## Limitations
Heuristics, not a verdict: no reputation feeds, DNS, certificate or page-content checks. The brand list is small and the TLD handling is approximate, so expect both false positives and false negatives.

## Test
`node test.mjs`
