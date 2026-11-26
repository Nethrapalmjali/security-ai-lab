import assert from 'node:assert/strict';
import * as p from './pw.js';
import { WORDS } from './data.js';

assert.equal(WORDS.length, 256); assert.equal(new Set(WORDS).size, 256);
assert.equal(p.charsetSize('abc'), 26); assert.equal(p.charsetSize('aB3!'), 26 + 26 + 10 + 33); assert.equal(p.charsetSize(''), 0);
assert.ok(Math.abs(p.naiveEntropy('abcdefgh') - 8 * Math.log2(26)) < 1e-9);

const a = (s) => p.analyze(s);
// common password: tiny
assert.ok(a('password').bits < 15, 'password'); assert.equal(a('password').score, 0);
assert.ok(a('123456').bits < 15);
// l33t does not help much
const leet = a('P@ssw0rd'); assert.ok(leet.path.some(x => x.kind === 'leet'), 'leet'); assert.ok(leet.bits < 25); assert.ok(leet.naiveBits > 40, 'naive overestimates');
assert.ok(leet.tips.some(t => /Substitutions/.test(t)));
// keyboard walk, sequence, repeat, year
assert.ok(a('qwertyuiop').path.some(x => x.kind === 'keyboard') || a('qwertyuiop').bits < 15);
assert.ok(a('xabcdefx').path.some(x => x.kind === 'sequence'));
assert.ok(a('zzzzzzzz').path.some(x => x.kind === 'repeat')); assert.ok(a('zzzzzzzz').bits < 20);
assert.ok(a('xk1987').path.some(x => x.kind === 'year'));
// reversed
assert.ok(a('drowssap').bits < 20 && a('drowssap').path[0].kind === 'reversed');
// random-ish long password is strong; segmentation covers entire string
const strong = a('v9#Lq!2xZp@7Wm4k'); assert.equal(strong.score, 4); assert.ok(strong.bits > 70);
for (const s of ['Tr0ub4dor&3', 'correcthorsebatterystaple', 'abc123XYZ!', 'a', 'ünïcödé']) {
  assert.equal(a(s).path.map(x => x.token).join(''), s, s);
}
// passphrase of common words beats a short complex password
assert.ok(a('lantern-orbit-velvet-meadow-quartz').bits > a('Summer2019!').bits);
// monotonic: appending random chars never reduces bits (by more than combining bit)
assert.ok(a('password' + 'q8Z!').bits > a('password').bits);
// empty
const e = a(''); assert.equal(e.bits, 0); assert.equal(e.score, 0);
// humanTime / crack
assert.equal(p.humanTime(0.1), 'instantly'); assert.equal(p.humanTime(90), '1 minute'); assert.equal(p.humanTime(86400 * 3), '3 days');
assert.equal(p.humanTime(Infinity), 'effectively forever');
const ct = p.crackTimes(40); assert.equal(ct.length, 4); assert.ok(ct[0].seconds > ct[3].seconds);
assert.ok(Math.abs(ct[3].seconds - Math.pow(2, 39) / 1e10) < 1e-6);
assert.equal(p.score(10), 0); assert.equal(p.score(70), 4);
// generators with deterministic rng
let ctr = 0; const rng = (m) => (ctr++ * 7) % m;
const pp = p.passphrase(4, ' ', rng); assert.equal(pp.text.split(' ').length, 4); assert.equal(pp.bits, 32);
const rp = p.randomPassword(20); assert.equal(rp.text.length, 20); assert.ok(/[a-z]/.test(rp.text) && /[A-Z]/.test(rp.text) && /\d/.test(rp.text) && /[^\w]/.test(rp.text));
// real CSPRNG unbiased range
for (let i = 0; i < 500; i++) { const v = p.defaultRng(7); assert.ok(v >= 0 && v < 7); }
console.log('password-auditor: all tests passed');
assert.ok(a('Summer2019!').bits < 30);
console.log('extra ok');
