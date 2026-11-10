// Pure JWT analysis logic (no DOM). Works in browsers and Node 18+.
const enc = new TextEncoder();

export function b64urlToBytes(s) {
  if (typeof s !== 'string' || !/^[A-Za-z0-9_-]*$/.test(s)) throw new Error('Invalid base64url');
  if (s.length % 4 === 1) throw new Error('Invalid base64url length');
  const b = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4);
  const bin = atob(b);
  return Uint8Array.from(bin, c => c.charCodeAt(0));
}

export function bytesToB64url(bytes) {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decodeJson(part, name) {
  try {
    const obj = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(b64urlToBytes(part)));
    if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) throw new Error('not an object');
    return obj;
  } catch (e) {
    throw new Error(`Could not decode ${name}: ${e.message}`);
  }
}

export function parseJwt(token) {
  const t = String(token).trim().replace(/^Bearer\s+/i, '');
  const parts = t.split('.');
  if (parts.length !== 3) throw new Error(`A JWT has 3 dot-separated parts; found ${parts.length}`);
  return {
    header: decodeJson(parts[0], 'header'),
    payload: decodeJson(parts[1], 'payload'),
    signature: parts[2],
    signingInput: parts[0] + '.' + parts[1],
  };
}

export const WEAK_SECRETS = [
  'secret', 'password', '123456', '12345678', 'changeme', 'admin', 'jwt', 'jwtsecret', 'jwt_secret',
  'mysecret', 'my_secret', 'supersecret', 'secretkey', 'secret_key', 'key', 'test', 'default',
  'qwerty', 'letmein', 'your-256-bit-secret', 'your-secret-key', 'shhhhh', 's3cr3t', 'token',
  'hmac', 'hs256', 'private', 'topsecret', 'dev', 'development', 'production', 'example', 'abc123',
];

const HASHES = { HS256: 'SHA-256', HS384: 'SHA-384', HS512: 'SHA-512' };

export async function hmacSign(alg, secret, signingInput) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret),
    { name: 'HMAC', hash: HASHES[alg] }, false, ['sign']);
  return bytesToB64url(new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(signingInput))));
}

export async function verifyHmac(parsed, secret) {
  const alg = parsed.header.alg;
  if (!HASHES[alg] || !secret) return false; // Web Crypto rejects empty HMAC keys
  const expected = await hmacSign(alg, secret, parsed.signingInput);
  // constant-time-ish comparison
  if (expected.length !== parsed.signature.length) return false;
  let d = 0;
  for (let i = 0; i < expected.length; i++) d |= expected.charCodeAt(i) ^ parsed.signature.charCodeAt(i);
  return d === 0;
}

export async function findWeakSecret(parsed, extra = []) {
  if (!HASHES[parsed.header.alg]) return null;
  for (const s of [...WEAK_SECRETS, ...extra]) {
    if (await verifyHmac(parsed, s)) return s;
  }
  return null;
}

const SENSITIVE = /pass(word|wd)?|secret|ssn|card|cvv|private|api[_-]?key/i;

// severity: critical | high | medium | low | info
export async function analyze(token, now = Math.floor(Date.now() / 1000)) {
  const p = parseJwt(token);
  const f = [];
  const add = (severity, title, detail) => f.push({ severity, title, detail });
  const { header: h, payload: pl } = p;
  const alg = typeof h.alg === 'string' ? h.alg : undefined;

  if (!alg) add('high', 'Missing "alg" header', 'Verifiers must not guess the algorithm.');
  else if (alg.toLowerCase() === 'none') add('critical', 'Algorithm "none"', 'Unsigned token. Any party can forge it if the server accepts "none".');
  else if (HASHES[alg]) {
    add('info', `Symmetric algorithm ${alg}`, 'Signer and verifier share one secret; it must be long and random.');
    const weak = await findWeakSecret(p);
    if (weak !== null) add('critical', 'Weak signing secret cracked', `Signature verifies with the common secret "${weak}". Attackers can mint arbitrary tokens.`);
  } else if (/^(RS|PS|ES)/.test(alg)) {
    add('info', `Asymmetric algorithm ${alg}`, 'Servers must pin the expected algorithm to avoid RS256→HS256 key-confusion attacks.');
  } else if (alg !== 'EdDSA') add('medium', `Unrecognised algorithm "${alg}"`, 'Unusual algorithms are poorly supported and often misimplemented.');

  if (alg && alg.toLowerCase() !== 'none' && p.signature === '') add('high', 'Empty signature', 'Token declares an algorithm but carries no signature.');
  if (alg && alg.toLowerCase() === 'none' && p.signature !== '') add('medium', 'Signature present with alg none', 'Inconsistent token; some parsers mishandle this.');

  for (const k of ['jku', 'jwk', 'x5u', 'x5c']) {
    if (k in h) add('high', `Header "${k}" present`, 'Attacker-controlled key references can let a forger supply their own verification key. Servers must ignore or strictly allow-list these.');
  }
  if (typeof h.kid === 'string' && /['"`;|&$<>]|\.\.[\\/]|\x00|--/.test(h.kid))
    add('high', 'Suspicious "kid" value', 'Contains characters used in SQL injection / path traversal / command injection against key lookup.');

  if (typeof pl.exp !== 'number') add('medium', 'No expiry (exp)', 'A stolen token stays valid forever unless revoked server-side.');
  else {
    if (pl.exp < now) add('info', 'Token expired', `Expired ${fmtDelta(now - pl.exp)} ago.`);
    const iat = typeof pl.iat === 'number' ? pl.iat : null;
    const life = pl.exp - (iat ?? now);
    if (pl.exp >= now && life > 30 * 86400) add('low', 'Long-lived token', `Expires in ${fmtDelta(pl.exp - now)}. Prefer short-lived access tokens plus refresh tokens.`);
  }
  if (typeof pl.nbf === 'number' && pl.nbf > now) add('info', 'Not yet valid (nbf)', `Becomes valid in ${fmtDelta(pl.nbf - now)}.`);
  if (typeof pl.iat === 'number' && pl.iat > now + 300) add('low', 'iat in the future', 'Issued-at is later than the current time — clock skew or forged token.');
  if (!('iss' in pl)) add('low', 'No issuer (iss)', 'Verifiers cannot confirm which service minted the token.');
  if (!('aud' in pl)) add('low', 'No audience (aud)', 'Token may be replayable against other services.');
  if (!('jti' in pl)) add('info', 'No token ID (jti)', 'Individual tokens cannot be revoked or replay-detected by ID.');

  for (const k of Object.keys(pl)) {
    if (SENSITIVE.test(k)) add('high', `Sensitive-looking claim "${k}"`, 'JWT payloads are only encoded, not encrypted — anyone holding the token can read them.');
  }
  const order = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
  f.sort((a, b) => order[a.severity] - order[b.severity]);
  return { parsed: p, findings: f, score: score(f) };
}

export function score(findings) {
  const w = { critical: 40, high: 20, medium: 10, low: 4, info: 0 };
  const s = 100 - findings.reduce((a, x) => a + w[x.severity], 0);
  return Math.max(0, s);
}

export function fmtDelta(sec) {
  sec = Math.abs(Math.round(sec));
  const u = [['d', 86400], ['h', 3600], ['m', 60], ['s', 1]];
  for (const [n, v] of u) if (sec >= v) return `${Math.floor(sec / v)}${n}`;
  return '0s';
}

export async function forgeUnsigned(token) {
  const p = parseJwt(token);
  const h = bytesToB64url(enc.encode(JSON.stringify({ ...p.header, alg: 'none' })));
  return `${h}.${bytesToB64url(enc.encode(JSON.stringify(p.payload)))}.`;
}

export async function signHs256(payload, secret, header = { alg: 'HS256', typ: 'JWT' }) {
  const si = bytesToB64url(enc.encode(JSON.stringify(header))) + '.' + bytesToB64url(enc.encode(JSON.stringify(payload)));
  return si + '.' + await hmacSign('HS256', secret, si);
}
