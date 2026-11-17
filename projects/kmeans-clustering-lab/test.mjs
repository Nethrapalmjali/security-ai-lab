import assert from 'node:assert/strict';
import { mulberry32, dist2, initCentroids, assign, update, inertia, step, run, silhouette, elbow, dataset } from './kmeans.js';

// RNG determinism
assert.equal(mulberry32(5)(), mulberry32(5)());
assert.notEqual(mulberry32(5)(), mulberry32(6)());

// Hand-computed example
const P = [[0, 0], [0, 2], [10, 0], [10, 2]];
assert.equal(dist2([0, 0], [3, 4]), 25);
const lab = assign(P, [[0, 1], [10, 1]]);
assert.deepEqual(lab, [0, 0, 1, 1]);
assert.deepEqual(update(P, lab, [[0, 1], [10, 1]]), [[0, 1], [10, 1]]);
assert.equal(inertia(P, lab, [[0, 1], [10, 1]]), 4);
// empty cluster keeps its position
assert.deepEqual(update(P, [0, 0, 0, 0], [[5, 1], [99, 99]])[1], [99, 99]);

// Convergence on well-separated blobs recovers 3 clusters
const pts = dataset('blobs', 90, mulberry32(3));
const r = run(pts, 3, { seed: 2 });
assert.equal(r.changed, false);
const groups = [0, 1, 2].map(g => new Set(r.labels.filter((_, i) => i % 3 === g)));
groups.forEach(s => assert.equal(s.size, 1)); // all points from one true blob share a label
assert.equal(new Set(r.labels).size, 3);
assert.ok(silhouette(pts, r.labels, 3) > 0.7);

// Inertia never increases across iterations (Lloyd's guarantee)
let s = { centroids: initCentroids(pts, 3, 'random', mulberry32(9)), labels: null, iter: 0 }, prev = Infinity;
for (let i = 0; i < 15; i++) { s = step(pts, s); assert.ok(s.inertia <= prev + 1e-9); prev = s.inertia; }

// Elbow: inertia non-increasing in k, sharp drop up to the true k=3
const e = elbow(pts, 6);
for (let i = 1; i < e.length; i++) assert.ok(e[i].inertia <= e[i - 1].inertia + 1e-9);
assert.ok(e[1].inertia - e[2].inertia > 5 * (e[2].inertia - e[3].inertia));

// Silhouette picks k=3 over k=2 and k=5
const sil = k => silhouette(pts, run(pts, k, { seed: 1 }).labels, k);
assert.ok(sil(3) > sil(2) && sil(3) > sil(5));

// k-means++ yields distinct seeds, k clamped to n
assert.equal(initCentroids([[0, 0], [1, 1]], 5, 'kmeans++', mulberry32(1)).length, 2);
assert.deepEqual(initCentroids([], 3, 'random', mulberry32(1)), []);
// Silhouette edge cases
assert.equal(silhouette([[0, 0]], [0], 1), 0);
// Identical points don't crash k-means++
assert.equal(initCentroids([[1, 1], [1, 1], [1, 1]], 2, 'kmeans++', mulberry32(1)).length, 2);

console.log('all kmeans tests passed');
