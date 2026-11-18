// HOTP (RFC 4226) / TOTP (RFC 6238) using Web Crypto. Pure logic, no DOM.
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const ALGOS = { SHA1: 'SHA-1', SHA256: 'SHA-256', SHA512: 'SHA-512' };

export function base32Decode(str) {
  const clean = String(str).toUpperCase().replace(/[\s-]/g, '').replace(/=+$/, '');
  let bits = 0, value = 0;
  const out = [];
  for (const ch of clean) {
    const idx = B32.indexOf(ch);
    if (idx < 0) throw new Error(`Invalid Base32 character "${ch}"`);
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 0xff); bits -= 8; }
  }
  return new Uint8Array(out);
}

export function base32Encode(bytes) {
  let bits = 0, value = 0, out = '';
  for (const b of bytes) {
    value = (value << 8) | b; bits += 8;
    while (bits >= 5) { out += B32[(value >>> (bits - 5)) & 31]; bits -= 5; }
    value &= (1 << bits) - 1;
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

export function randomSecret(byteLen = 20) {
  return base32Encode(globalThis.crypto.getRandomValues(new Uint8Array(byteLen)));
}

export async function hotp(keyBytes, counter, { digits = 6, algorithm = 'SHA1' } = {}) {
  const hash = ALGOS[algorithm];
  if (!hash) throw new Error('Unsupported algorithm ' + algorithm);
  if (digits < 6 || digits > 8) throw new Error('digits must be 6-8');
  const msg = new Uint8Array(8);
  new DataView(msg.buffer).setBigUint64(0, BigInt(counter));
  const key = await globalThis.crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash }, false, ['sign']);
  const mac = new Uint8Array(await globalThis.crypto.subtle.sign('HMAC', key, msg));
  const off = mac[mac.length - 1] & 0x0f; // dynamic truncation
  const bin = ((mac[off] & 0x7f) << 24) | (mac[off + 1] << 16) | (mac[off + 2] << 8) | mac[off + 3];
  return String(bin % 10 ** digits).padStart(digits, '0');
}

export const counterAt = (unixSeconds, period = 30) => Math.floor(unixSeconds / period);
export const secondsRemaining = (unixSeconds, period = 30) => period - (Math.floor(unixSeconds) % period);

export function totp(keyBytes, unixSeconds, opts = {}) {
  return hotp(keyBytes, counterAt(unixSeconds, opts.period || 30), opts);
}

// Constant-time-ish string compare (avoids early exit).
function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

// Accepts codes within +/- window steps; returns the matched drift or null.
export async function verifyTotp(keyBytes, code, unixSeconds, { window = 1, ...opts } = {}) {
  const c = counterAt(unixSeconds, opts.period || 30);
  let match = null;
  for (let d = -window; d <= window; d++) {
    if (c + d < 0) continue;
    const expected = await hotp(keyBytes, c + d, opts);
    if (safeEqual(expected, String(code).trim()) && match === null) match = d;
  }
  return match;
}

export function buildOtpauthUri({ secret, issuer = '', account = 'user', algorithm = 'SHA1', digits = 6, period = 30 }) {
  const label = (issuer ? encodeURIComponent(issuer) + ':' : '') + encodeURIComponent(account);
  const p = new URLSearchParams({ secret: secret.replace(/\s/g, '').toUpperCase(), algorithm, digits: String(digits), period: String(period) });
  if (issuer) p.set('issuer', issuer);
  return `otpauth://totp/${label}?${p.toString()}`;
}

export function parseOtpauthUri(uri) {
  const m = /^otpauth:\/\/(totp|hotp)\/([^?]*)\?(.*)$/i.exec(uri.trim());
  if (!m) throw new Error('Not a valid otpauth:// URI');
  const params = new URLSearchParams(m[3]);
  const label = decodeURIComponent(m[2]);
  const [labelIssuer, account] = label.includes(':') ? [label.split(':')[0], label.split(':').slice(1).join(':').trim()] : ['', label];
  const secret = params.get('secret');
  if (!secret) throw new Error('URI has no secret parameter');
  const algorithm = (params.get('algorithm') || 'SHA1').toUpperCase();
  if (!ALGOS[algorithm]) throw new Error('Unsupported algorithm ' + algorithm);
  return {
    type: m[1].toLowerCase(), secret: secret.toUpperCase(), issuer: params.get('issuer') || labelIssuer, account,
    algorithm, digits: Number(params.get('digits') || 6), period: Number(params.get('period') || 30),
  };
}

// Practical security review of a TOTP configuration.
export function auditConfig({ secret, algorithm = 'SHA1', digits = 6, period = 30, window = 1 }) {
  const findings = [];
  let bytes;
  try { bytes = base32Decode(secret); } catch (e) { return [{ level: 'high', text: e.message }]; }
  const bits = bytes.length * 8;
  if (bits < 80) findings.push({ level: 'high', text: `Secret is only ${bits} bits; RFC 4226 requires at least 128 bits and recommends 160.` });
  else if (bits < 128) findings.push({ level: 'medium', text: `Secret is ${bits} bits; RFC 4226 requires at least 128 bits.` });
  else if (bits < 160) findings.push({ level: 'low', text: `Secret is ${bits} bits; 160 bits is recommended.` });
  else findings.push({ level: 'ok', text: `Secret length ${bits} bits meets the recommendation.` });
  if (new Set(bytes).size < Math.min(4, bytes.length)) findings.push({ level: 'high', text: 'Secret has very low byte diversity and looks guessable.' });
  if (digits === 6) findings.push({ level: 'info', text: '6 digits = 1,000,000 combinations; rely on server-side rate limiting.' });
  if (algorithm === 'SHA1') findings.push({ level: 'info', text: 'SHA-1 is fine for HMAC, but many authenticator apps only support SHA-1.' });
  if (period > 60) findings.push({ level: 'medium', text: `A ${period}s period lengthens the replay window; 30s is standard.` });
  if (window > 1) findings.push({ level: 'medium', text: `Accepting ±${window} steps multiplies brute-force odds by ${2 * window + 1}.` });
  return findings;
}
