import assert from 'node:assert/strict';
import { parseCsp, evaluate, hostMatchesBypass, EXAMPLES } from './csp.js';

const titles = (r) => r.findings.map((x) => x.title);
const has = (r, sev, re) => r.findings.some((x) => x.severity === sev && re.test(x.title));

// parsing
let p = parseCsp("Content-Security-Policy: default-src 'self'; SCRIPT-SRC a.com b.com; script-src c.com;;");
assert.deepEqual(p.directives['script-src'], ['a.com', 'b.com']);
assert.deepEqual(p.duplicates, ['script-src']);
assert.equal(p.reportOnly, false);
assert.equal(parseCsp('Content-Security-Policy-Report-Only: default-src *').reportOnly, true);
assert.deepEqual(parseCsp('').directives, {});

// bypass hosts
assert.equal(hostMatchesBypass('https://ajax.googleapis.com/ajax/libs'), 'ajax.googleapis.com');
assert.ok(hostMatchesBypass('https://foo.herokuapp.com'));
assert.ok(hostMatchesBypass('*.cloudfront.net'));
assert.equal(hostMatchesBypass('https://example.com'), null);
assert.equal(hostMatchesBypass("'self'"), null);

// strict policy
let r = evaluate(EXAMPLES.strict);
assert.equal(r.counts.high, 0); assert.equal(r.counts.medium, 0);
assert.ok(r.score >= 95 && r.grade === 'A+', `strict got ${r.score}`);

// weak policy
r = evaluate(EXAMPLES.weak);
assert.ok(has(r, 'high', /Wildcard/)); assert.ok(has(r, 'high', /unsafe-inline/));
assert.ok(has(r, 'high', /data:/)); assert.ok(has(r, 'medium', /unsafe-eval/));
assert.ok(has(r, 'high', /object-src/)); assert.equal(r.grade, 'F');

// typical: unsafe-inline + cdnjs
r = evaluate(EXAMPLES.typical);
assert.ok(has(r, 'high', /unsafe-inline/)); assert.ok(has(r, 'medium', /cdnjs/));
assert.ok(has(r, 'medium', /object-src is not 'none'/));

// nonce neutralises unsafe-inline
r = evaluate("script-src 'nonce-abcdefghijklmnopqrstuv' 'unsafe-inline'; object-src 'none'; base-uri 'none'");
assert.ok(!has(r, 'high', /unsafe-inline/)); assert.ok(has(r, 'info', /neutralised/));

// short nonce
assert.ok(has(evaluate("script-src 'nonce-abc'; object-src 'none'"), 'low', /Short nonce/));

// strict-dynamic suppresses host-bypass warnings
r = evaluate("script-src 'nonce-abcdefghijklmnopqrstuv' 'strict-dynamic' https://cdnjs.cloudflare.com; object-src 'none'");
assert.ok(!titles(r).some((t) => /cdnjs/.test(t)));

// no script restriction
assert.ok(has(evaluate("img-src 'self'"), 'high', /No script restriction/));
// default-src fallback
r = evaluate("default-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'; upgrade-insecure-requests");
assert.equal(r.counts.high, 0); assert.equal(r.counts.medium, 0);
// report-only / empty / unknown / duplicate
assert.ok(has(evaluate(EXAMPLES.reportonly), 'info', /Report-Only/));
assert.ok(has(evaluate(''), 'high', /Empty/));
assert.ok(has(evaluate("scirpt-src 'self'"), 'info', /Unknown/));
assert.ok(has(evaluate("script-src a.com; script-src b.com"), 'low', /Duplicate/));
// frame-ancestors * and http: source
assert.ok(has(evaluate("script-src http://x.com; frame-ancestors *"), 'medium', /frame-ancestors \*/));
assert.ok(has(evaluate("script-src http://x.com"), 'medium', /Insecure http/));
// sorted by severity
r = evaluate(EXAMPLES.weak);
const rank = { high: 0, medium: 1, low: 2, info: 3 };
for (let i = 1; i < r.findings.length; i++) assert.ok(rank[r.findings[i - 1].severity] <= rank[r.findings[i].severity]);
console.log('csp-evaluator: all tests passed');
