// Pure logic for Hash Identifier & Integrity Lab. Works in browsers and Node 18+.

const rotl = (x, c) => (x << c) | (x >>> (32 - c));
const K = new Uint32Array(64).map((_, i) => Math.floor(Math.abs(Math.sin(i + 1)) * 2 ** 32));
const S = [7,12,17,22,7,12,17,22,7,12,17,22,7,12,17,22,5,9,14,20,5,9,14,20,5,9,14,20,5,9,14,20,
  4,11,16,23,4,11,16,23,4,11,16,23,4,11,16,23,6,10,15,21,6,10,15,21,6,10,15,21,6,10,15,21];

/** MD5 (RFC 1321). Web Crypto omits MD5, so it is implemented here. */
export function md5(bytes) {
  const len = bytes.length;
  const padded = new Uint8Array(((len + 8) >> 6 << 6) + 64);
  padded.set(bytes); padded[len] = 0x80;
  const dv = new DataView(padded.buffer);
  dv.setUint32(padded.length - 8, (len << 3) >>> 0, true);
  dv.setUint32(padded.length - 4, Math.floor(len / 2 ** 29), true);
  let a0 = 0x67452301, b0 = 0xefcdab89 | 0, c0 = 0x98badcfe | 0, d0 = 0x10325476;
  for (let off = 0; off < padded.length; off += 64) {
    const M = new Uint32Array(16);
    for (let i = 0; i < 16; i++) M[i] = dv.getUint32(off + i * 4, true);
    let A = a0, B = b0, C = c0, D = d0;
    for (let i = 0; i < 64; i++) {
      let F, g;
      if (i < 16) { F = (B & C) | (~B & D); g = i; }
      else if (i < 32) { F = (D & B) | (~D & C); g = (5 * i + 1) % 16; }
      else if (i < 48) { F = B ^ C ^ D; g = (3 * i + 5) % 16; }
      else { F = C ^ (B | ~D); g = (7 * i) % 16; }
      F = (F + A + K[i] + M[g]) | 0;
      A = D; D = C; C = B;
      B = (B + rotl(F, S[i])) | 0;
    }
    a0 = (a0 + A) | 0; b0 = (b0 + B) | 0; c0 = (c0 + C) | 0; d0 = (d0 + D) | 0;
  }
  const out = new Uint8Array(16), o = new DataView(out.buffer);
  [a0, b0, c0, d0].forEach((v, i) => o.setUint32(i * 4, v >>> 0, true));
  return out;
}

export const toHex = (u8) => [...u8].map((b) => b.toString(16).padStart(2, '0')).join('');
export const toBase64 = (u8) => { let s = ''; for (const b of u8) s += String.fromCharCode(b); return btoa(s); };

export const ALGOS = ['MD5', 'SHA-1', 'SHA-256', 'SHA-384', 'SHA-512'];

/** Digest bytes with one algorithm; returns Uint8Array. */
export async function digest(algo, bytes) {
  if (algo === 'MD5') return md5(bytes);
  return new Uint8Array(await globalThis.crypto.subtle.digest(algo, bytes));
}

export async function digestAll(bytes) {
  const r = {};
  for (const a of ALGOS) r[a] = toHex(await digest(a, bytes));
  return r;
}

/** Shannon entropy in bits per byte (0..8). */
export function entropy(bytes) {
  if (!bytes.length) return 0;
  const c = new Array(256).fill(0);
  for (const b of bytes) c[b]++;
  let h = 0;
  for (const n of c) if (n) { const p = n / bytes.length; h -= p * Math.log2(p); }
  return h;
}

export function entropyVerdict(h, size) {
  if (size < 256) return 'Too small for a meaningful reading';
  if (h > 7.9) return 'Looks encrypted or compressed (near-random)';
  if (h > 7.0) return 'Dense data: compressed media, archive or packed binary';
  if (h > 5.0) return 'Typical executable / structured binary';
  if (h > 3.0) return 'Likely natural-language text or source code';
  return 'Highly repetitive data';
}

/** Constant-time-ish comparison of two hex strings (case/whitespace-insensitive). */
export function hashesMatch(a, b) {
  const x = a.trim().toLowerCase().replace(/\s+/g, ''), y = b.trim().toLowerCase().replace(/\s+/g, '');
  let d = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) d |= (x.charCodeAt(i) || 0) ^ (y.charCodeAt(i) || 0);
  return d === 0;
}

const HEX = /^[0-9a-fA-F]+$/;
const B64 = /^[A-Za-z0-9+/]+={0,2}$/;

const hexNames = {
  8: [['CRC-32 / Adler-32', 'Checksum, not a cryptographic hash', 'checksum']],
  16: [['MySQL < 4.1 (OLD_PASSWORD)', 'Broken legacy password hash', 'weak'], ['Half of an MD5 / truncated hash', 'Possibly a 64-bit truncation', 'weak']],
  32: [['MD5', 'Collisions are trivial; never use for security', 'broken'], ['NTLM (Windows)', 'Unsalted MD4 of UTF-16LE password; pass-the-hash risk', 'broken'], ['MD4', 'Obsolete and broken', 'broken'], ['LM (half)', 'Ancient Windows hash', 'broken']],
  40: [['SHA-1', 'Practical collisions exist (SHAttered); avoid for signatures', 'weak'], ['RIPEMD-160', 'Used in Bitcoin addresses', 'ok']],
  56: [['SHA-224', 'Truncated SHA-256', 'ok'], ['SHA3-224', 'Keccak family', 'ok']],
  64: [['SHA-256', 'Solid general-purpose hash; too fast for passwords', 'ok'], ['SHA3-256', 'Keccak family', 'ok'], ['BLAKE2s-256', 'Fast modern hash', 'ok'], ['RIPEMD-256 / Haval-256', 'Rare', 'ok']],
  96: [['SHA-384', 'Truncated SHA-512', 'ok'], ['SHA3-384', 'Keccak family', 'ok']],
  128: [['SHA-512', 'Strong general-purpose hash; too fast for passwords', 'ok'], ['SHA3-512', 'Keccak family', 'ok'], ['BLAKE2b-512', 'Fast modern hash', 'ok'], ['Whirlpool', 'ISO standard, rare', 'ok']],
};

const prefixed = [
  [/^\$2[abxy]?\$(\d{2})\$[./A-Za-z0-9]{53}$/, (m) => ['bcrypt', `Adaptive password hash, cost factor ${m[1]} (2^${m[1]} rounds)`, 'strong']],
  [/^\$argon2(id|i|d)\$/, (m) => ['Argon2' + m[1], 'Memory-hard password hash (PHC winner); recommended', 'strong']],
  [/^\$y\$/, () => ['yescrypt', 'Modern memory-hard Unix password hash', 'strong']],
  [/^\$7\$/, () => ['scrypt (Unix crypt)', 'Memory-hard password hash', 'strong']],
  [/^\$scrypt\$/, () => ['scrypt', 'Memory-hard password hash', 'strong']],
  [/^\$6\$/, () => ['sha512crypt', 'Salted, 5000+ rounds Unix hash; acceptable but not memory-hard', 'ok']],
  [/^\$5\$/, () => ['sha256crypt', 'Salted, iterated Unix hash', 'ok']],
  [/^\$1\$/, () => ['md5crypt', 'Old salted MD5 Unix hash; weak by today\'s GPU speeds', 'weak']],
  [/^\$apr1\$/, () => ['Apache apr1 (MD5)', 'Salted MD5, htpasswd; weak', 'weak']],
  [/^pbkdf2[_-]sha(1|256|512)\$/i, (m) => ['PBKDF2-HMAC-SHA' + m[1] + ' (Django-style)', 'Iterated KDF; check iteration count (OWASP: 600k for SHA-256)', 'ok']],
  [/^\$pbkdf2-sha(1|256|512)\$/, (m) => ['PBKDF2-HMAC-SHA' + m[1] + ' (passlib)', 'Iterated KDF', 'ok']],
  [/^\*[0-9A-Fa-f]{40}$/, () => ['MySQL 4.1+ (double SHA-1)', 'Unsalted; weak against GPU cracking', 'weak']],
  [/^\{SSHA\}/, () => ['LDAP salted SHA-1 (SSHA)', 'Salted but fast hash', 'weak']],
  [/^\{SHA\}/, () => ['LDAP SHA-1', 'Unsalted fast hash', 'broken']],
];

/** Identify a hash string. Returns {kind, candidates:[{name,note,level}]}. */
export function identify(input) {
  const s = (input || '').trim();
  if (!s) return { kind: 'empty', candidates: [] };
  for (const [re, f] of prefixed) {
    const m = s.match(re);
    if (m) { const [name, note, level] = f(m); return { kind: 'prefixed', candidates: [{ name, note, level }] }; }
  }
  if (HEX.test(s) && hexNames[s.length]) {
    return { kind: 'hex', bits: s.length * 4, candidates: hexNames[s.length].map(([name, note, level]) => ({ name, note, level })) };
  }
  if (HEX.test(s)) return { kind: 'hex', bits: s.length * 4, candidates: [] };
  if (B64.test(s) && s.length % 4 === 0) {
    const bytes = { 24: 'MD5', 28: 'SHA-1', 44: 'SHA-256', 64: 'SHA-384', 88: 'SHA-512' }[s.length];
    if (bytes) return { kind: 'base64', candidates: [{ name: bytes + ' (Base64-encoded)', note: 'Same digest as hex, different encoding (common in SRI and HTTP headers)', level: bytes === 'MD5' || bytes === 'SHA-1' ? 'weak' : 'ok' }] };
  }
  return { kind: 'unknown', candidates: [] };
}

/** Rough brute-force time for a fast hash at a given rate (hashes/s) for a charset size and length. */
export function bruteForceSeconds(charset, length, rate) {
  return Math.pow(charset, length) / 2 / rate;
}

export function humanTime(sec) {
  if (sec < 1) return '< 1 second';
  const u = [['years', 31557600], ['days', 86400], ['hours', 3600], ['minutes', 60], ['seconds', 1]];
  for (const [n, d] of u) if (sec >= d) { const v = sec / d; return (v >= 1e6 ? v.toExponential(1) : Math.round(v).toLocaleString('en')) + ' ' + n; }
  return '< 1 second';
}
