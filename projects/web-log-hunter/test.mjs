import assert from 'node:assert/strict';
import { parseLine, parseTime, safeDecode, detect, bruteForce, analyze, EXAMPLE } from './hunter.js';

const l = parseLine('1.2.3.4 - bob [10/Oct/2026:13:55:36 -0700] "GET /a?b=1 HTTP/1.1" 200 2326 "http://r/" "UA/1"');
assert.equal(l.ip, '1.2.3.4'); assert.equal(l.status, 200); assert.equal(l.path, '/a?b=1'); assert.equal(l.ua, 'UA/1');
assert.equal(l.time, Date.UTC(2026, 9, 10, 20, 55, 36));
assert.equal(parseLine('garbage'), null);
assert.equal(parseTime('bad'), null);
assert.equal(safeDecode('%2527'), "'");
assert.equal(safeDecode('%E0%A4%A'), '%E0%A4%A'.replace(/%([0-9a-f]{2})/gi, (_, h) => String.fromCharCode(parseInt(h, 16))));

const d = (p, ua = 'x') => detect({ path: p, ua });
assert.ok(d("/p?id=1' OR '1'='1").includes('sqli'));
assert.ok(d('/p?id=1%20UNION%20SELECT%201,2').includes('sqli'));
assert.ok(d('/p?q=%253Cscript%253E').includes('xss'));
assert.ok(d('/f?x=..%2f..%2fetc%2fpasswd').includes('traversal'));
assert.ok(d('/x?c=;cat /etc/hosts').includes('cmdi'));
assert.ok(d('/?x=${jndi:ldap://a/b}').includes('log4shell'));
assert.ok(d('/.git/config').includes('sensitive'));
assert.ok(d('/wp-login.php').includes('admin'));
assert.ok(d('/', 'sqlmap/1.0').includes('scanner'));
assert.deepEqual(d('/index.html?page=2&q=select+a+shirt'), []);
assert.deepEqual(d('/blog/how-to-select-a-laptop'), []);

const mk = (t, s = 401) => ({ ip: '9.9.9.9', path: '/login', status: s, time: t * 1000 });
assert.equal(bruteForce([1, 2, 3, 4, 5].map((t) => mk(t))).length, 1);
assert.equal(bruteForce([1, 100, 200, 300, 400].map((t) => mk(t))).length, 0);
assert.equal(bruteForce([1, 2, 3, 4, 5].map((t) => mk(t, 200))).length, 0);

const r = analyze(EXAMPLE + '\nnot a log line');
assert.equal(r.total, 15); assert.equal(r.parsed, 14); assert.equal(r.unparsed, 1);
assert.equal(r.brute.length, 1); assert.equal(r.brute[0].ip, '192.0.2.44');
assert.ok(r.counts.sqli >= 2 && r.counts.xss === 1 && r.counts.traversal === 1 && r.counts.log4shell === 1 && r.counts.scanner >= 2);
assert.ok(!r.ips.find((i) => i.ip === '203.0.113.7'));
assert.ok(r.ips[0].score >= r.ips[r.ips.length - 1].score);
console.log('all tests passed');
