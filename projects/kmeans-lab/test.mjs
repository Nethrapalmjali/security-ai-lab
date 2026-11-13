import assert from 'node:assert/strict';
import * as K from './kmeans.js';

// RNG determinism
assert.equal(K.mulberry32(5)(), K.mulberry32(5)());
// CSV parsing skips headers/garbage
assert.deepEqual(K.parseCSV('x,y\n1,2\n3 4\nfoo,bar\n5;6\n7'), [[1, 2], [3, 4], [5, 6]]);
// normalize
assert.deepEqual(K.normalize([[0, 10], [10, 20]]), [[0, 0], [1, 1]]);
assert.deepEqual(K.normalize([[3, 3]]), [[0, 0]]);
// assign / update
assert.deepEqual(K.assign([[0, 0], [10, 10]], [[1, 1], [9, 9]]), [0, 1]);
assert.deepEqual(K.update([[0, 0], [2, 2], [10, 10]], [0, 0, 1], [[5, 5], [5, 5]]), [[1, 1], [10, 10]]);
assert.deepEqual(K.update([[0, 0]], [0], [[1, 1], [7, 7]]), [[0, 0], [7, 7]]); // empty cluster kept
// blobs: k=3 recovers 3 groups with high silhouette
const pts = K.makeDataset('blobs', 150, 3);
assert.equal(pts.length, 150);
const r = K.run(pts, 3, { seed: 2 });
assert.ok(r.converged);
const sil = K.silhouette(pts, r.final.labels, 3);
assert.ok(sil > 0.6, 'silhouette ' + sil);
// each true blob (i%3) maps to a single cluster
for (let g = 0; g < 3; g++) {
  const s = new Set(r.final.labels.filter((_, i) => i % 3 === g));
  assert.equal(s.size, 1);
}
// inertia is non-increasing across Lloyd iterations
const inert = r.history.map(h => h.inertia);
for (let i = 1; i < inert.length; i++) assert.ok(inert[i] <= inert[i - 1] + 1e-9);
// elbow decreases, silhouette peaks at 3
const e = K.elbow(pts, 6, { seed: 4 });
for (let i = 1; i < e.length; i++) assert.ok(e[i].inertia <= e[i - 1].inertia + 1e-9);
const bestK = e.slice(1).reduce((a, b) => (b.silhouette > a.silhouette ? b : a)).k;
assert.equal(bestK, 3);
// silhouette known value: two tight far clusters ~ 1
assert.ok(K.silhouette([[0, 0], [0, .01], [9, 9], [9, 9.01]], [0, 0, 1, 1], 2) > 0.99);
// k larger than n is clamped; identical points don't hang
assert.equal(K.run([[1, 1], [1, 1], [1, 1]], 5).final.centroids.length, 3);
// rings: k-means cannot separate them (documented limitation)
const rings = K.makeDataset('rings', 200, 1);
const rr = K.run(rings, 2, { seed: 1 });
const outerLabels = new Set(rr.final.labels.filter((_, i) => i % 2 === 0));
assert.ok(outerLabels.size === 2, 'k-means splits the outer ring');
assert.throws(() => K.makeDataset('nope'));
console.log('all tests passed');
