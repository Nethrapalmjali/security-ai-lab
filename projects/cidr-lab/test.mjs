import assert from 'node:assert/strict';
import * as c from './cidr.js';

assert.equal(c.parseIPv4('192.168.1.10'), 3232235786);
assert.equal(c.ipToStr(3232235786), '192.168.1.10');
assert.equal(c.ipToStr(c.parseIPv4('255.255.255.255')), '255.255.255.255');
for (const bad of ['1.2.3', '256.1.1.1', '1.2.3.4.5', '01.2.3.4', 'a.b.c.d', '']) assert.throws(() => c.parseIPv4(bad), bad);
assert.throws(() => c.parseCidr('10.0.0.0/33'));

let d = c.describe('192.168.1.77/24');
assert.equal(d.network, '192.168.1.0'); assert.equal(d.broadcast, '192.168.1.255');
assert.equal(d.netmask, '255.255.255.0'); assert.equal(d.wildcard, '0.0.0.255');
assert.equal(d.firstHost, '192.168.1.1'); assert.equal(d.lastHost, '192.168.1.254');
assert.equal(d.usable, 254); assert.equal(d.total, 256); assert.equal(d.canonical, false);
assert.equal(d.range.kind, 'private');
d = c.describe('10.0.0.0/8'); assert.equal(d.usable, 16777214); assert.equal(d.netmask, '255.0.0.0');
d = c.describe('0.0.0.0/0'); assert.equal(d.total, 4294967296); assert.equal(d.netmask, '0.0.0.0'); assert.equal(d.broadcast, '255.255.255.255');
d = c.describe('10.1.1.1/32'); assert.equal(d.usable, 1); assert.equal(d.firstHost, '10.1.1.1');
d = c.describe('10.1.1.0/31'); assert.equal(d.usable, 2); assert.equal(d.broadcast, null);
d = c.describe('172.31.255.255/12'); assert.equal(d.network, '172.16.0.0'); assert.equal(d.range.kind, 'private');
assert.equal(c.describe('172.32.0.1').range.kind, 'public');
assert.equal(c.describe('8.8.8.8/32').range.kind, 'public');
assert.equal(c.describe('169.254.169.254').range.kind, 'special');
assert.equal(c.describe('100.64.0.0/10').range.kind, 'private');

const p = (s) => c.parseCidr(s);
assert.equal(c.relation(p('10.0.0.0/8'), p('10.1.0.0/16')), 'contains');
assert.equal(c.relation(p('10.1.0.0/16'), p('10.0.0.0/8')), 'inside');
assert.equal(c.relation(p('10.0.0.0/8'), p('10.0.0.0/8')), 'equal');
assert.equal(c.relation(p('10.0.0.0/9'), p('10.128.0.0/9')), 'disjoint');
assert.equal(c.contains('192.168.0.0/16', '192.168.255.255'), true);
assert.equal(c.contains('192.168.0.0/16', '192.169.0.0'), false);

assert.deepEqual(c.split('192.168.0.0/24', 26), ['192.168.0.0/26', '192.168.0.64/26', '192.168.0.128/26', '192.168.0.192/26']);
assert.throws(() => c.split('10.0.0.0/24', 23));
assert.throws(() => c.split('10.0.0.0/8', 32));

assert.deepEqual(c.rangeToCidrs('192.168.1.0', '192.168.1.255'), ['192.168.1.0/24']);
assert.deepEqual(c.rangeToCidrs('10.0.0.1', '10.0.0.6'), ['10.0.0.1/32', '10.0.0.2/31', '10.0.0.4/31', '10.0.0.6/32']);
assert.deepEqual(c.rangeToCidrs('0.0.0.0', '255.255.255.255'), ['0.0.0.0/0']);
assert.deepEqual(c.rangeToCidrs('1.1.1.1', '1.1.1.1'), ['1.1.1.1/32']);

assert.deepEqual(c.summarize(['192.168.0.0/25', '192.168.0.128/25']), ['192.168.0.0/24']);
assert.deepEqual(c.summarize(['10.0.0.0/24', '10.0.0.0/16', '10.2.0.0/16']), ['10.0.0.0/16', '10.2.0.0/16']);
assert.deepEqual(c.summarize(['10.0.0.0/16', '10.1.0.0/16']), ['10.0.0.0/15']);

const a = c.audit(['# sources', '0.0.0.0/0', '10.0.0.0/8', '10.1.2.0/24', '192.168.1.5/24', '300.1.1.1', '8.8.8.8', '8.8.8.8/32']);
const has = (re) => a.findings.some((f) => re.test(f.msg));
assert.ok(has(/entire internet/)); assert.ok(has(/redundant: already covered by 10\.0\.0\.0\/8/));
assert.ok(has(/host bits set.*192\.168\.1\.0\/24/)); assert.ok(has(/duplicates line 7/));
assert.ok(a.findings.some((f) => f.sev === 'error' && f.line === 6));
assert.equal(a.findings[0].sev, 'high');
assert.deepEqual(a.summary, ['0.0.0.0/0']);
assert.deepEqual(c.audit(['203.0.113.0/24']).findings.filter((f) => f.sev === 'high'), []);
console.log('cidr-lab: all tests passed');
