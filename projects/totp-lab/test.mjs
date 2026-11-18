import assert from 'node:assert/strict';
import * as t from './totp.js';

const enc = (s) => new TextEncoder().encode(s);
// RFC 4648 vectors
assert.equal(t.base32Encode(enc('foobar')), 'MZXW6YTBOI');
assert.equal(new TextDecoder().decode(t.base32Decode('MZXW6YTBOI======')), 'foobar');
assert.equal(t.base32Encode(enc('f')), 'MY');
assert.throws(() => t.base32Decode('abc1'));
const rs = t.randomSecret(); assert.equal(t.base32Decode(rs).length, 20);

// RFC 4226 Appendix D (6 digits)
const k = enc('12345678901234567890');
const exp = ['755224','287082','359152','969429','338314','254676','287922','162583','399871','520489'];
for (let i = 0; i < 10; i++) assert.equal(await t.hotp(k, i), exp[i]);

// RFC 6238 Appendix B (8 digits)
const k256 = enc('12345678901234567890123456789012');
const k512 = enc('1234567890123456789012345678901234567890123456789012345678901234');
const o = (algorithm) => ({ digits: 8, algorithm });
for (const [ts, a, b, c] of [[59,'94287082','46119246','90693936'],[1111111109,'07081804','68084774','25091201'],
  [1111111111,'14050471','67062674','99943326'],[1234567890,'89005924','91819424','93441116'],
  [2000000000,'69279037','90698825','38618901'],[20000000000,'65353130','77737706','47863826']]) {
  assert.equal(await t.totp(k, ts, o('SHA1')), a);
  assert.equal(await t.totp(k256, ts, o('SHA256')), b);
  assert.equal(await t.totp(k512, ts, o('SHA512')), c);
}

// verification window
const code = await t.totp(k, 1000);
assert.equal(await t.verifyTotp(k, code, 1000), 0);
assert.equal(await t.verifyTotp(k, code, 1030), -1);
assert.equal(await t.verifyTotp(k, code, 970), 1);
assert.equal(await t.verifyTotp(k, code, 1100), null);
assert.equal(await t.verifyTotp(k, code, 1000 + 30, { window: 0 }), null);
assert.equal(t.secondsRemaining(59), 1);
assert.equal(t.secondsRemaining(60), 30);

// otpauth round trip
const uri = t.buildOtpauthUri({ secret: 'jbsw y3dp ehpk 3pxp', issuer: 'Acme Co', account: 'a@b.com', digits: 8, algorithm: 'SHA256' });
const p = t.parseOtpauthUri(uri);
assert.deepEqual([p.secret, p.issuer, p.account, p.digits, p.algorithm, p.period], ['JBSWY3DPEHPK3PXP', 'Acme Co', 'a@b.com', 8, 'SHA256', 30]);
assert.throws(() => t.parseOtpauthUri('http://x'));

// audit
assert.equal(t.auditConfig({ secret: 'JBSWY3DPEHPK3PXP' })[0].level, 'medium');
assert.equal(t.auditConfig({ secret: t.randomSecret(20) })[0].level, 'ok');
assert.equal(t.auditConfig({ secret: '1' })[0].level, 'high');
console.log('All TOTP tests passed');
