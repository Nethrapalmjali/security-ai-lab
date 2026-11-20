// Classical cipher cryptanalysis: pure logic, no DOM.
export const EN_FREQ = [8.167,1.492,2.782,4.253,12.702,2.228,2.015,6.094,6.966,0.153,0.772,4.025,2.406,
  6.749,7.507,1.929,0.095,5.987,6.327,9.056,2.758,0.978,2.360,0.150,1.974,0.074]; // A..Z, percent
const A = 65;

export const lettersOnly = (t) => t.toUpperCase().replace(/[^A-Z]/g, '');

export function shiftChar(ch, k) {
  const c = ch.charCodeAt(0);
  if (c >= 65 && c <= 90) return String.fromCharCode(((c - 65 + k) % 26 + 26) % 26 + 65);
  if (c >= 97 && c <= 122) return String.fromCharCode(((c - 97 + k) % 26 + 26) % 26 + 97);
  return ch;
}
export const caesar = (text, shift) => Array.from(text, (ch) => shiftChar(ch, shift)).join('');

export function vigenere(text, key, decrypt = false) {
  const k = lettersOnly(key);
  if (!k) throw new Error('Key must contain at least one letter');
  let i = 0;
  return Array.from(text, (ch) => {
    if (!/[A-Za-z]/.test(ch)) return ch;
    const s = k.charCodeAt(i++ % k.length) - A;
    return shiftChar(ch, decrypt ? -s : s);
  }).join('');
}

export function counts(letters) {
  const c = new Array(26).fill(0);
  for (const ch of letters) c[ch.charCodeAt(0) - A]++;
  return c;
}

// Chi-squared distance from English letter frequencies (lower = more English-like).
export function chiSquared(letters) {
  const n = letters.length;
  if (!n) return Infinity;
  const c = counts(letters);
  let x = 0;
  for (let i = 0; i < 26; i++) {
    const e = (EN_FREQ[i] / 100) * n;
    x += (c[i] - e) ** 2 / e;
  }
  return x;
}

// Index of coincidence: ~0.0667 for English, ~0.0385 for uniform random letters.
export function indexOfCoincidence(letters) {
  const n = letters.length;
  if (n < 2) return 0;
  const c = counts(letters);
  return c.reduce((s, f) => s + f * (f - 1), 0) / (n * (n - 1));
}

// Try all 26 shifts; return candidates ranked best-first.
export function breakCaesar(text) {
  const L = lettersOnly(text);
  const out = [];
  for (let shift = 0; shift < 26; shift++) {
    const plain = caesar(text, -shift);
    out.push({ shift, score: chiSquared(lettersOnly(plain)), plain });
  }
  return out.sort((a, b) => a.score - b.score);
}

// Kasiski examination: distances between repeated n-grams, tallied by factor.
export function kasiski(text, maxLen = 20, ngram = 3) {
  const L = lettersOnly(text);
  const seen = new Map();
  const factors = new Array(maxLen + 1).fill(0);
  for (let i = 0; i + ngram <= L.length; i++) {
    const g = L.substr(i, ngram);
    if (seen.has(g)) {
      for (const p of seen.get(g)) {
        const d = i - p;
        for (let f = 2; f <= maxLen; f++) if (d % f === 0) factors[f]++;
      }
      seen.get(g).push(i);
    } else seen.set(g, [i]);
  }
  return factors.map((count, len) => ({ len, count })).filter((x) => x.len >= 2).sort((a, b) => b.count - a.count || a.len - b.len);
}

// Average IC of the columns for each candidate key length.
export function keyLengthScores(text, maxLen = 20) {
  const L = lettersOnly(text);
  const res = [];
  for (let len = 1; len <= maxLen; len++) {
    const cols = Array.from({ length: len }, () => '');
    for (let i = 0; i < L.length; i++) cols[i % len] += L[i];
    res.push({ len, ic: cols.reduce((s, c) => s + indexOfCoincidence(c), 0) / len });
  }
  return res;
}

// Smallest length whose columns look like English (IC >= 0.057); otherwise the best-scoring length.
// "Smallest" avoids picking multiples of the true length, which score equally well.
export function guessKeyLength(text, maxLen = 20) {
  const s = keyLengthScores(text, maxLen);
  const hit = s.find((x) => x.ic >= 0.057);
  if (hit) return hit.len;
  return s.reduce((m, x) => (x.ic > m.ic ? x : m)).len;
}

export function recoverKey(text, len) {
  const L = lettersOnly(text);
  let key = '';
  for (let j = 0; j < len; j++) {
    let col = '';
    for (let i = j; i < L.length; i += len) col += L[i];
    key += String.fromCharCode(A + breakCaesar(col)[0].shift);
  }
  return key;
}

export function breakVigenere(text, maxLen = 20, forcedLen) {
  const len = forcedLen || guessKeyLength(text, maxLen);
  const key = recoverKey(text, len);
  return { len, key, plain: vigenere(text, key, true) };
}

// ---- XOR ----
export function hexToBytes(hex) {
  const h = hex.replace(/[^0-9a-fA-F]/g, '');
  if (h.length % 2) throw new Error('Hex string has odd length');
  return Uint8Array.from(h.match(/../g) || [], (b) => parseInt(b, 16));
}
export const bytesToHex = (b) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
export const xorBytes = (bytes, key) => Uint8Array.from(bytes, (b, i) => b ^ key[i % key.length]);
export const textToBytes = (s) => new TextEncoder().encode(s);

// Score bytes as English text: reward letters/spaces by frequency, punish non-printables.
export function englishness(bytes) {
  let s = 0;
  for (const b of bytes) {
    if (b === 32) s += 13;
    else if ((b | 32) >= 97 && (b | 32) <= 122) s += EN_FREQ[(b | 32) - 97];
    else if (b >= 48 && b <= 57) s += 1;
    else if (b === 44 || b === 46 || b === 39 || b === 10) s += 1;
    else if (b < 32 || b > 126) s -= 50;
    else s -= 3;
  }
  return s / (bytes.length || 1);
}

export function breakSingleByteXor(bytes) {
  const out = [];
  for (let k = 0; k < 256; k++) {
    const plain = xorBytes(bytes, [k]);
    out.push({ key: k, score: englishness(plain), plain });
  }
  return out.sort((a, b) => b.score - a.score);
}

export function hamming(a, b) {
  let d = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    let x = a[i] ^ b[i];
    while (x) { d += x & 1; x >>= 1; }
  }
  return d;
}

// Repeating-key XOR: rank key sizes by normalised Hamming distance, then solve each column.
export function breakRepeatingXor(bytes, maxLen = 16) {
  const scored = [];
  for (let ks = 2; ks <= Math.min(maxLen, Math.floor(bytes.length / 4)); ks++) {
    const blocks = Math.min(4, Math.floor(bytes.length / ks));
    let tot = 0, pairs = 0;
    for (let i = 0; i < blocks; i++) for (let j = i + 1; j < blocks; j++) {
      tot += hamming(bytes.slice(i * ks, (i + 1) * ks), bytes.slice(j * ks, (j + 1) * ks)) / ks;
      pairs++;
    }
    scored.push({ len: ks, dist: tot / pairs });
  }
  scored.sort((a, b) => a.dist - b.dist);
  // consider top 3 sizes, keep the one whose decryption looks most English
  let best = null;
  for (const { len } of scored.slice(0, 3)) {
    const key = [];
    for (let j = 0; j < len; j++) {
      const col = bytes.filter((_, i) => i % len === j);
      key.push(breakSingleByteXor(col)[0].key);
    }
    const plain = xorBytes(bytes, key);
    const score = englishness(plain);
    if (!best || score > best.score) best = { len, key, score, plain };
  }
  return best;
}
