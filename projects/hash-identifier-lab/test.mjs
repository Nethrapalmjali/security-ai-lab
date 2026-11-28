import assert from 'node:assert/strict';
import * as h from './hashlab.js';

const enc = (s) => new TextEncoder().encode(s);
// RFC 1321 vectors
const md5v = { '': 'd41d8cd98f00b204e9800998ecf8427e', 'a': '0cc175b9c0f1b6a831c399e269772661', 'abc': '900150983cd24fb0d6963f7d28e17f72',
  'message digest': 'f96b697d7cb7938d525a2f31aaf161d0', 'abcdefghijklmnopqrstuvwxyz': 'c3fcd3d76192e4007dfb496cca67e13b',
  '12345678901234567890123456789012345678901234567890123456789012345678901234567890': '57edf4a22be3c955ac49da2e2107b67a' };
for (const [k, v] of Object.entries(md5v)) assert.equal(h.toHex(h.md5(enc(k))), v, 'md5 ' + k);
// boundary lengths (55,56,63,64,65) should not throw and be 16 bytes; compare with node crypto
import { createHash } from 'node:crypto';
for (const n of [0, 1, 55, 56, 63, 64, 65, 119, 120, 1000]) {
  const b = new Uint8Array(n).map((_, i) => (i * 7) & 255);
  assert.equal(h.toHex(h.md5(b)), createHash('md5').update(b).digest('hex'), 'len ' + n);
}
const all = await h.digestAll(enc('abc'));
assert.equal(all['SHA-1'], 'a9993e364706816aba3e25717850c26c9cd0d89d');
assert.equal(all['SHA-256'], 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
assert.equal(all['MD5'], md5v.abc);
assert.equal(h.toBase64(await h.digest('SHA-256', enc('abc'))), 'ungWv48Bz+pBQUDeXa4iI7ADYaOWF3qctBD/YfIAFa0=');

// entropy
assert.equal(h.entropy(new Uint8Array(0)), 0);
assert.equal(h.entropy(new Uint8Array(1000)), 0);
const all256 = new Uint8Array(256 * 4).map((_, i) => i & 255);
assert.ok(Math.abs(h.entropy(all256) - 8) < 1e-9);
assert.ok(h.entropy(enc('the quick brown fox jumps over the lazy dog '.repeat(10))) < 5);
assert.match(h.entropyVerdict(7.99, 5000), /encrypted/);

// compare
assert.ok(h.hashesMatch(' ABC123 ', 'abc123'));
assert.ok(!h.hashesMatch('abc123', 'abc124'));
assert.ok(!h.hashesMatch('abc', 'abcd'));

// identify
const names = (s) => h.identify(s).candidates.map((c) => c.name);
assert.ok(names(md5v.abc).includes('MD5') && names(md5v.abc).includes('NTLM (Windows)'));
assert.ok(names(all['SHA-1']).includes('SHA-1'));
assert.ok(names(all['SHA-256']).includes('SHA-256'));
assert.ok(names(all['SHA-512']).includes('SHA-512'));
assert.equal(names('$2b$12$' + 'a'.repeat(53))[0], 'bcrypt');
assert.match(h.identify('$2b$12$' + 'a'.repeat(53)).candidates[0].note, /cost factor 12/);
assert.equal(names('$argon2id$v=19$m=65536,t=3,p=4$c2FsdA$aGFzaA')[0], 'Argon2id');
assert.equal(names('$6$salt$hash')[0], 'sha512crypt');
assert.equal(names('$1$salt$hash')[0], 'md5crypt');
assert.equal(names('*' + 'A'.repeat(40))[0], 'MySQL 4.1+ (double SHA-1)');
assert.match(names('ungWv48Bz+pBQUDeXa4iI7ADYaOWF3qctBD/YfIAFa0=')[0], /SHA-256 \(Base64/);
assert.equal(h.identify('hello world!').kind, 'unknown');
assert.equal(h.identify('').kind, 'empty');
assert.equal(h.identify('abc').candidates.length, 0);

// brute force
assert.equal(h.bruteForceSeconds(10, 4, 1e4), 0.5);
assert.equal(h.humanTime(0.5), '< 1 second');
assert.equal(h.humanTime(7200), '2 hours');
console.log('all hash-identifier-lab tests passed');
