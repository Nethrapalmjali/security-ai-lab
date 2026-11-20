# Classical Cipher Cryptanalysis Lab

Encrypt text with Caesar, Vigenère or XOR, then break each cipher **without the key** using statistics. Runs 100% client-side.

**Live:** https://nethrapalmjali.github.io/security-ai-lab/projects/classical-cipher-lab/

## How it works
- **Caesar** – all 26 shifts are tried and ranked by chi-squared distance from English letter frequencies.
- **Vigenère** – the index of coincidence (IC) of every n-th letter identifies the key length (smallest length with IC ≥ 0.057, which avoids multiples of the true length). Each column is then solved as a Caesar cipher. A Kasiski examination (factors of distances between repeated trigrams) and a letter-frequency chart are shown as supporting evidence.
- **XOR** – single-byte keys are brute-forced and scored for "englishness"; repeating keys use normalised Hamming distance to rank key sizes, then each column is solved as single-byte XOR (the classic Cryptopals approach).

Logic lives in `cipher.js` (pure, DOM-free); `app.js` renders with `textContent` only. Tests: `node test.mjs`.

## Concepts demonstrated
Frequency analysis, index of coincidence, Kasiski examination, Hamming distance, why key reuse and small keyspaces break ciphers.

## Limitations
- Needs roughly 100+ letters for reliable results; short texts can mislead the statistics.
- English only. Repeating-XOR may return a multiple of the true key (e.g. `ICEICE`), which is equivalent.
- Educational: none of these ciphers should protect real data.
