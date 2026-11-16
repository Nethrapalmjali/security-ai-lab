import assert from 'node:assert/strict';
import { parseHeaders, addressDomain, displayName, orgDomain, parseAuthResults, parseReceived, isPrivateIp, analyze } from './analyzer.js';
import { SAMPLES } from './samples.js';

assert.equal(addressDomain('"Bob" <bob@Example.COM>'), 'example.com');
assert.equal(addressDomain('<>'), null);
assert.equal(displayName('"PayPal Support" <a@b.c>'), 'PayPal Support');
assert.equal(orgDomain('mail.bbc.co.uk'), 'bbc.co.uk');
assert.equal(orgDomain('a.b.example.com'), 'example.com');

const h = parseHeaders('Subject: hi\n there\nFrom: a@b.com\n\nbody: not header');
assert.equal(h.length, 2); assert.equal(h[0].value, 'hi there');

const ar = parseAuthResults('mx.google.com; spf=pass smtp.mailfrom=a@b.com; dkim=fail header.d=b.com; dmarc=fail header.from=b.com');
assert.equal(ar.methods.spf[0].result, 'pass');
assert.equal(ar.methods.dkim[0].props['header.d'], 'b.com');
assert.equal(ar.methods.dmarc[0].result, 'fail');

const r = parseReceived('from mail.evil.test (mail.evil.test [203.0.113.9]) by mx.x.com with ESMTPS; Mon, 16 Nov 2026 10:00:00 +0000');
assert.equal(r.from, 'mail.evil.test'); assert.deepEqual(r.ips, ['203.0.113.9']); assert.ok(r.tls); assert.ok(r.ts);
assert.ok(isPrivateIp('192.168.1.1')); assert.ok(!isPrivateIp('8.8.8.8')); assert.ok(isPrivateIp('172.20.0.1')); assert.ok(!isPrivateIp('172.32.0.1'));

const titles = a => a.findings.map(f => f.title);
const legit = analyze(SAMPLES.legit);
assert.ok(legit.score >= 90, 'legit score ' + legit.score);
assert.ok(titles(legit).includes('DMARC passed'));
const phish = analyze(SAMPLES.phish);
assert.ok(phish.score <= 35, 'phish score ' + phish.score);
for (const t of ['SPF result: fail', 'DMARC result: fail', 'Reply-To redirects to a different domain', 'Display name spoofs another address']) assert.ok(titles(phish).includes(t), t);
const forged = analyze(SAMPLES.forged);
assert.ok(titles(forged).includes('Timestamps go backwards'));
assert.equal(forged.hops[0].index, 1);
assert.equal(analyze('').score, null);
console.log('all tests passed');
