import assert from 'node:assert/strict';
import { mulberry32, c, sampleIndices, buildTree, pathLength, fit, score, scoreAll, threshold, parseCSV, normalize, evaluate, auc, makeDataset } from './iforest.js';

const near = (a, b, e = 1e-9) => assert.ok(Math.abs(a - b) < e, `${a} !~ ${b}`);

// c(n)
assert.equal(c(1), 0); assert.equal(c(2), 1);
near(c(256), 10.2447, 1e-3);           // value used in the paper (~10.24)
assert.ok(c(100) > c(50));

// PRNG determinism and range
const a = mulberry32(1), b = mulberry32(1);
for (let i = 0; i < 20; i++) { const x = a(); assert.equal(x, b()); assert.ok(x >= 0 && x < 1); }

// sampling without replacement
const s = sampleIndices(50, 20, mulberry32(3));
assert.equal(s.length, 20); assert.equal(new Set(s).size, 20); assert.ok(s.every(i => i >= 0 && i < 50));
assert.equal(sampleIndices(5, 99, mulberry32(3)).length, 5);

// tree: identical points can't be split -> single leaf
assert.deepEqual(buildTree([[1, 1], [1, 1], [1, 1]], mulberry32(1)), { leaf: true, size: 3 });
// path length of a leaf of size 1 is depth + 0
const t = buildTree([[0], [1]], mulberry32(1), 0, 5);
assert.ok(!t.leaf);
near(pathLength(t, [0]), 1); near(pathLength(t, [1]), 1);

// scores in range, obvious outlier scores higher than centre
const X = [];
const r = mulberry32(9);
for (let i = 0; i < 300; i++) X.push([50 + (r() - .5) * 10, 50 + (r() - .5) * 10]);
const m = fit(X, { trees: 100, subsample: 256, seed: 1 });
const sc = scoreAll(m, X);
assert.ok(sc.every(v => v > 0 && v <= 1));
const sOut = score(m, [500, 500]), sCen = score(m, [50, 50]);
assert.ok(sOut > 0.6, 'outlier ' + sOut); assert.ok(sCen < 0.5 && sOut - sCen > 0.15, 'centre ' + sCen); assert.ok(sOut > sCen);
// determinism
assert.equal(score(fit(X, { seed: 5 }), [60, 60]), score(fit(X, { seed: 5 }), [60, 60]));

// threshold flags the requested fraction
const th = threshold([0.1, 0.9, 0.5, 0.7, 0.3, 0.6, 0.2, 0.4, 0.8, 0.95], 0.2);
near(th, 0.9); assert.equal(threshold([1, 2], 0), Infinity);

// CSV
let p = parseCSV('a,b\n1,2\n3,4\nx,5\n6\n');
assert.deepEqual(p.header, ['a', 'b']); assert.deepEqual(p.rows, [[1, 2], [3, 4]]); assert.equal(p.skipped, 2);
p = parseCSV('1;2\n3;4'); assert.deepEqual(p.header, ['x1', 'x2']); assert.equal(p.rows.length, 2);
assert.equal(parseCSV('').rows.length, 0);

// normalize
const nz = normalize([[0, 5], [10, 5], [5, 5]]);
assert.deepEqual(nz.Z, [[0, .5], [1, .5], [.5, .5]]);

// evaluate / auc
const ev = evaluate([true, true, false, false], [1, 0, 1, 0]);
assert.deepEqual([ev.tp, ev.fp, ev.fn, ev.tn], [1, 1, 1, 1]); near(ev.f1, 0.5);
near(auc([0.9, 0.8, 0.2, 0.1], [1, 1, 0, 0]), 1);
near(auc([0.1, 0.2, 0.8, 0.9], [1, 1, 0, 0]), 0);
near(auc([0.5, 0.5, 0.5, 0.5], [1, 0, 1, 0]), 0.5);

// end-to-end: every demo dataset is detected with strong AUC
for (const [name, minAuc] of [['blob', 0.9], ['clusters', 0.85], ['logins', 0.95], ['ring', 0.8]]) {
  const { X: D, labels } = makeDataset(name);
  const { Z } = normalize(D);
  const mm = fit(Z, { trees: 150, subsample: 256, seed: 42 });
  const a = auc(scoreAll(mm, Z), labels);
  console.log(name, 'AUC', a.toFixed(3));
  assert.ok(a >= minAuc, `${name} AUC ${a}`);
}
console.log('all tests passed');
