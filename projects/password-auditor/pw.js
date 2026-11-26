// Password strength auditor: pattern matching + minimum-guess segmentation (zxcvbn-style, simplified).
import { COMMON, WORDS } from './data.js';

const LEET = { '4': 'a', '@': 'a', '8': 'b', '(': 'c', '3': 'e', '6': 'g', '1': 'l', '!': 'i', '0': 'o', '$': 's', '5': 's', '7': 't', '+': 't', '2': 'z' };
const ROWS = ['1234567890', 'qwertyuiop', 'asdfghjkl', 'zxcvbnm', '1qaz2wsx3edc4rfv', 'qazwsxedcrfv'];
const DICT = new Map();
COMMON.forEach((w, i) => { if (!DICT.has(w)) DICT.set(w, i + 1); });
WORDS.forEach((w, i) => { if (!DICT.has(w)) DICT.set(w, 100 + i); });

export const log2 = Math.log2;

export function charsetSize(pw) {
  let n = 0;
  if (/[a-z]/.test(pw)) n += 26;
  if (/[A-Z]/.test(pw)) n += 26;
  if (/[0-9]/.test(pw)) n += 10;
  if (/[ -\/:-@\[-`{-~]/.test(pw)) n += 33;
  if (/[^\x00-\x7f]/.test(pw)) n += 100;
  return n;
}

/** Naive "length x log2(charset)" entropy: what many strength meters show. Overestimates human passwords. */
export function naiveEntropy(pw) {
  const c = charsetSize(pw);
  return c ? [...pw].length * log2(c) : 0;
}

function cardinality(s) { return Math.max(charsetSize(s), 10); }

function dictionaryMatches(pw) {
  const out = [], low = pw.toLowerCase(), n = pw.length;
  for (let i = 0; i < n; i++) {
    for (let j = i + 3; j <= n; j++) {
      const sub = low.slice(i, j);
      const orig = pw.slice(i, j);
      // plain / case-varied
      if (DICT.has(sub)) out.push(mkDict(i, j, orig, sub, sub, false));
      // l33t un-substitution
      let un = '', subs = 0;
      for (const ch of sub) { if (LEET[ch]) { un += LEET[ch]; subs++; } else un += ch; }
      if (subs > 0 && DICT.has(un)) out.push(mkDict(i, j, orig, sub, un, true));
      // reversed
      const rev = [...sub].reverse().join('');
      if (j - i >= 4 && DICT.has(rev) && rev !== sub) out.push({ ...mkDict(i, j, orig, sub, rev, false), kind: 'reversed', guesses: DICT.get(rev) * 2 * caseMult(orig) });
    }
  }
  return out;
}
function caseMult(orig) {
  if (/^[^A-Z]*$/.test(orig) || /^[^a-z]*$/.test(orig)) return /[A-Z]/.test(orig) ? 2 : 1; // all lower=1, ALL UPPER=2
  if (/^[A-Z][^A-Z]*$/.test(orig)) return 2; // Capitalised
  const up = (orig.match(/[A-Z]/g) || []).length, lo = (orig.match(/[a-z]/g) || []).length;
  let m = 0; for (let k = 1; k <= Math.min(up, lo); k++) m += binom(up + lo, k);
  return Math.max(m, 2);
}
function binom(n, k) { let r = 1; for (let i = 1; i <= k; i++) r = r * (n - k + i) / i; return Math.round(r); }
function mkDict(i, j, token, sub, base, leet) {
  let g = DICT.get(base) * caseMult(token);
  let leetN = 1;
  if (leet) {
    let s = 0, u = 0;
    for (const ch of sub) { if (LEET[ch]) s++; else if (/[a-z]/.test(ch) && Object.values(LEET).includes(ch)) u++; }
    leetN = 0; for (let k = 1; k <= Math.min(s, s + u); k++) leetN += binom(s + u, k);
    leetN = Math.max(leetN, 2);
  }
  return { kind: leet ? 'leet' : 'dictionary', i, j: j, token, base, guesses: g * leetN };
}

function sequenceMatches(pw) {
  const out = []; const n = pw.length;
  let i = 0;
  while (i < n - 2) {
    const d = pw.charCodeAt(i + 1) - pw.charCodeAt(i);
    if (Math.abs(d) === 1 || Math.abs(d) === 2) {
      let j = i + 1;
      while (j < n && pw.charCodeAt(j) - pw.charCodeAt(j - 1) === d) j++;
      if (j - i >= 3) {
        const tok = pw.slice(i, j);
        const obvious = /^[a1]/i.test(tok) || /^[z9]/i.test(tok) || /^0/.test(tok);
        const base = obvious ? 4 : /\d/.test(tok[0]) ? 10 : /[a-z]/i.test(tok[0]) ? 26 : 40;
        out.push({ kind: 'sequence', i, j, token: tok, guesses: base * (j - i) * (d < 0 ? 2 : 1) });
        i = j - 1; continue;
      }
    }
    i++;
  }
  return out;
}

function repeatMatches(pw) {
  const out = [];
  const re = /(.+?)\1+/g; let m;
  while ((m = re.exec(pw))) {
    const unit = m[1], tok = m[0]; if (tok.length < 3) continue;
    const times = tok.length / unit.length;
    out.push({ kind: 'repeat', i: m.index, j: m.index + tok.length, token: tok, unit, guesses: Math.max(2, Math.pow(cardinality(unit), unit.length) * times) });
    re.lastIndex = m.index + 1;
  }
  return out;
}

function keyboardMatches(pw) {
  const out = []; const low = pw.toLowerCase(); const n = pw.length;
  for (const row of ROWS) {
    for (const rowStr of [row, [...row].reverse().join('')]) {
      for (let i = 0; i < n - 2; i++) {
        let j = i;
        let k = rowStr.indexOf(low[i]);
        while (k >= 0 && j < n && rowStr[k] === low[j]) { j++; k++; }
        if (j - i >= 3) out.push({ kind: 'keyboard', i, j, token: pw.slice(i, j), guesses: 47 * 4 * (j - i) });
      }
    }
  }
  return out;
}

function yearMatches(pw) {
  const out = []; const re = /(?:19|20)\d\d/g; let m;
  while ((m = re.exec(pw))) out.push({ kind: 'year', i: m.index, j: m.index + 4, token: m[0], guesses: 120 });
  return out;
}

export function findMatches(pw) {
  return [...dictionaryMatches(pw), ...sequenceMatches(pw), ...repeatMatches(pw), ...keyboardMatches(pw), ...yearMatches(pw)];
}

/** Minimum total log2(guesses) segmentation; gaps are brute-forced char by char. */
export function minGuessPath(pw) {
  const chars = [...pw]; // work in UTF-16 indexes consistently with matches: use pw.length
  const n = pw.length; void chars;
  const matches = findMatches(pw);
  const bruteCard = cardinality(pw);
  const best = new Array(n + 1).fill(Infinity), prev = new Array(n + 1).fill(null);
  best[0] = 0;
  const byEnd = new Map();
  for (const m of matches) { if (!byEnd.has(m.j)) byEnd.set(m.j, []); byEnd.get(m.j).push(m); }
  for (let e = 1; e <= n; e++) {
    // brute-force one char
    const b = best[e - 1] + log2(bruteCard);
    if (b < best[e]) { best[e] = b; prev[e] = { brute: true, i: e - 1 }; }
    for (const m of byEnd.get(e) || []) {
      const c = best[m.i] + log2(Math.max(m.guesses, 2)) + 1; // +1 bit: cost of combining/ordering patterns
      if (c < best[e]) { best[e] = c; prev[e] = { match: m, i: m.i }; }
    }
  }
  const path = []; let e = n;
  while (e > 0) {
    const p = prev[e];
    if (p.brute) {
      const last = path[path.length - 1];
      if (last && last.kind === 'bruteforce' && last.i === e) { last.i = e - 1; last.token = pw[e - 1] + last.token; }
      else path.push({ kind: 'bruteforce', i: e - 1, j: e, token: pw[e - 1] });
      e = p.i;
    } else { path.push(p.match); e = p.i; }
  }
  path.reverse();
  for (const s of path) if (s.kind === 'bruteforce') s.guesses = Math.pow(bruteCard, s.token.length);
  return { bits: n ? best[n] : 0, path };
}

export const SCENARIOS = [
  { id: 'online-throttled', label: 'Online, rate-limited login (100 / hour)', rate: 100 / 3600 },
  { id: 'online', label: 'Online, no rate limit (10 / s)', rate: 10 },
  { id: 'offline-slow', label: 'Offline, slow hash e.g. bcrypt/Argon2 (10k / s)', rate: 1e4 },
  { id: 'offline-fast', label: 'Offline, fast hash e.g. MD5/NTLM on GPUs (10 billion / s)', rate: 1e10 },
];

export function humanTime(sec) {
  if (!isFinite(sec)) return 'effectively forever';
  if (sec < 1) return 'instantly';
  const units = [['year', 31557600], ['month', 2629800], ['day', 86400], ['hour', 3600], ['minute', 60], ['second', 1]];
  if (sec >= 31557600 * 1e9) return 'billions of years or more';
  for (const [name, s] of units) {
    if (sec >= s) {
      const v = Math.floor(sec / s);
      if (name === 'year' && v >= 1e6) return `${(v / 1e6).toFixed(1)} million years`;
      return `${v.toLocaleString('en-US')} ${name}${v === 1 ? '' : 's'}`;
    }
  }
  return 'instantly';
}

export function crackTimes(bits) {
  const guesses = Math.pow(2, bits) / 2; // on average, attacker succeeds half-way
  return SCENARIOS.map(s => ({ ...s, seconds: guesses / s.rate, text: humanTime(guesses / s.rate) }));
}

export function score(bits) { return bits < 28 ? 0 : bits < 36 ? 1 : bits < 50 ? 2 : bits < 64 ? 3 : 4; }
export const LABELS = ['Very weak', 'Weak', 'Fair', 'Good', 'Strong'];

export function feedback(pw, path) {
  const tips = [];
  const kinds = new Set(path.map(p => p.kind));
  if (!pw) return tips;
  if (pw.length < 12) tips.push('Use at least 12 characters; length adds more strength than symbols do.');
  if (path.some(p => p.kind === 'dictionary' && p.guesses < 1e4)) tips.push('Contains a very common password or word that appears in cracking wordlists.');
  if (kinds.has('leet')) tips.push('Substitutions like @ for a or 0 for o are built into every cracker; they add almost nothing.');
  if (kinds.has('reversed')) tips.push('Reversed words are checked by crackers too.');
  if (kinds.has('keyboard')) tips.push('Keyboard walks (qwerty, 1qaz2wsx) are among the first guesses.');
  if (kinds.has('sequence')) tips.push('Avoid sequences such as abc, 123 or 987.');
  if (kinds.has('repeat')) tips.push('Repeated chunks (aaa, abcabc) add little.');
  if (kinds.has('year')) tips.push('Years are guessable; only ~120 candidates.');
  if (path.length && path.every(p => p.kind === 'dictionary' || p.kind === 'leet') && path.length <= 2) tips.push('One or two words plus a tweak is predictable. Try 4+ random words (a passphrase).');
  if (!tips.length) tips.push('No obvious patterns found. Store it in a password manager and enable 2FA.');
  return tips;
}

export function analyze(pw) {
  const { bits, path } = minGuessPath(pw);
  const s = pw ? score(bits) : 0;
  return { length: pw.length, naiveBits: naiveEntropy(pw), bits, score: s, label: LABELS[s], path, times: crackTimes(bits), tips: feedback(pw, path) };
}

// ---------- generators (CSPRNG via injectable rng) ----------
export function defaultRng(max) {
  // unbiased integer in [0,max) using rejection sampling
  const lim = Math.floor(0x100000000 / max) * max;
  const buf = new Uint32Array(1);
  for (;;) { globalThis.crypto.getRandomValues(buf); if (buf[0] < lim) return buf[0] % max; }
}
export function passphrase(words = 5, sep = '-', rng = defaultRng) {
  const out = []; for (let i = 0; i < words; i++) out.push(WORDS[rng(WORDS.length)]);
  return { text: out.join(sep), bits: words * log2(WORDS.length) };
}
export function randomPassword(len = 16, rng = defaultRng) {
  const sets = ['abcdefghijklmnopqrstuvwxyz', 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', '0123456789', '!@#$%^&*()-_=+[]{};:,.?'];
  const all = sets.join('');
  let pw;
  do { pw = ''; for (let i = 0; i < len; i++) pw += all[rng(all.length)]; } while (len >= 4 && !sets.every(s => [...s].some(c => pw.includes(c))));
  return { text: pw, bits: len * log2(all.length) };
}
