import assert from 'node:assert/strict';
import { parseJwt, analyze, signHs256, forgeUnsigned, b64urlToBytes, bytesToB64url, score, fmtDelta, verifyHmac } from './jwt.js';

// RFC-style known vector (jwt.io default token, secret "your-256-bit-secret")
const known = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
const p = parseJwt(known);
assert.equal(p.header.alg, 'HS256');
assert.equal(p.payload.name, 'John Doe');
assert.equal(await verifyHmac(p, 'your-256-bit-secret'), true);
assert.equal(await verifyHmac(p, 'wrong'), false);

assert.deepEqual([...b64urlToBytes(bytesToB64url(Uint8Array.from([251, 255, 0, 1])))], [251, 255, 0, 1]);
assert.throws(() => parseJwt('a.b'));
assert.throws(() => parseJwt('###.###.###'));
assert.equal(parseJwt('Bearer ' + known).payload.sub, '1234567890');

const now = 1_700_000_000;
let r = await analyze(known, now);
assert.ok(r.findings.some(x => x.severity === 'critical' && /Weak/.test(x.title)));
assert.ok(r.findings.some(x => /No expiry/.test(x.title)));
assert.ok(r.score < 50);

const strong = await signHs256({ iss: 'a', aud: 'b', jti: '1', iat: now, exp: now + 900 }, 'k9$Qz!vX2#mLp7@wRt4&Yb8^Nc5*Hd3e');
r = await analyze(strong, now);
assert.ok(!r.findings.some(x => x.severity === 'critical' || x.severity === 'high'));
assert.equal(r.score, 100);

const none = await forgeUnsigned(known);
r = await analyze(none, now);
assert.ok(r.findings.some(x => /none/.test(x.title) && x.severity === 'critical'));

const expired = await signHs256({ exp: now - 7200, iss: 'x', aud: 'y', password: 'hunter2' }, 'k9$Qz!vX2#mLp7@wRt4&Yb8^Nc5*Hd3e');
r = await analyze(expired, now);
assert.ok(r.findings.some(x => /expired/i.test(x.title)));
assert.ok(r.findings.some(x => /Sensitive/.test(x.title)));

const kid = await signHs256({ exp: now + 10 }, 'k9$Qz!vX2#mLp7@wRt4&Yb8^Nc5*Hd3e', { alg: 'HS256', kid: "x' OR 1=1--", jku: 'http://evil' });
r = await analyze(kid, now);
assert.ok(r.findings.some(x => /kid/.test(x.title)));
assert.ok(r.findings.some(x => /jku/.test(x.title)));

assert.equal(score([{ severity: 'critical' }, { severity: 'critical' }, { severity: 'critical' }]), 0);
assert.equal(fmtDelta(7200), '2h');
console.log('All tests passed');
