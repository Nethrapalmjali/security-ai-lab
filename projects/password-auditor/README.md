# Password Strength & Cracking-Time Auditor

Audits a password the way an attacker would guess it: by finding the cheapest combination of known patterns, then estimating cracking time under four attack scenarios. 100% client-side; nothing is stored or sent.

**Live:** https://nethrapalmjali.github.io/security-ai-lab/projects/password-auditor/

## How it works
- `pw.js` (pure logic) detects **dictionary words** (common passwords + words, ranked by frequency), **l33t substitutions** (`@`→a, `0`→o), **reversed words**, **sequences** (abc, 987), **repeats**, **keyboard walks** (qwerty, 1qaz2wsx) and **years**.
- Each pattern gets a guess-count estimate (rank × case/l33t variants, etc.). A dynamic-programming pass finds the segmentation with minimum total log2(guesses); leftover characters are brute-forced. This is a simplified take on the zxcvbn idea.
- Crack time = average guesses ÷ rate for online (throttled / unthrottled) and offline (slow hash / fast hash) attackers.
- The UI contrasts the result with the "naive entropy" (length × log2 charset) many meters use.
- Generators use `crypto.getRandomValues` with rejection sampling (no modulo bias): a 256-word passphrase (8 bits/word) and a 16-char random password.

## Concepts demonstrated
Entropy vs. real guessability, why complexity rules fail, wordlist/rule-based cracking, hash speed (bcrypt vs MD5), CSPRNG use, unbiased sampling.

## Limitations
Small embedded dictionaries (~200 common passwords, ~250 words) — real attackers use billions of leaked passwords. No dates, names, or non-English wordlists. Estimates are indicative only. Don't paste real passwords into any website.

## Tests
`node projects/password-auditor/test.mjs`
