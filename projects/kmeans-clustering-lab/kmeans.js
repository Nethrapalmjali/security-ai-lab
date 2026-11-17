// Pure k-means logic (no DOM). Points are [x, y] arrays.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const dist2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2;

export function initCentroids(points, k, method, rnd) {
  if (!points.length || k < 1) return [];
  k = Math.min(k, points.length);
  if (method === 'random') {
    const idx = points.map((_, i) => i);
    for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
    return idx.slice(0, k).map(i => points[i].slice());
  }
  // k-means++: pick next centroid with probability proportional to D(x)^2
  const c = [points[Math.floor(rnd() * points.length)].slice()];
  while (c.length < k) {
    const d = points.map(p => Math.min(...c.map(q => dist2(p, q))));
    const total = d.reduce((s, v) => s + v, 0);
    if (total === 0) { c.push(points[Math.floor(rnd() * points.length)].slice()); continue; }
    let r = rnd() * total, i = 0;
    while (i < d.length - 1 && (r -= d[i]) > 0) i++;
    c.push(points[i].slice());
  }
  return c;
}

export function assign(points, centroids) {
  return points.map(p => {
    let best = 0, bd = Infinity;
    centroids.forEach((c, i) => { const d = dist2(p, c); if (d < bd) { bd = d; best = i; } });
    return best;
  });
}

// Move each centroid to the mean of its members; empty clusters keep their position.
export function update(points, labels, centroids) {
  const sums = centroids.map(() => [0, 0, 0]);
  points.forEach((p, i) => { const s = sums[labels[i]]; s[0] += p[0]; s[1] += p[1]; s[2]++; });
  return sums.map((s, i) => s[2] ? [s[0] / s[2], s[1] / s[2]] : centroids[i].slice());
}

export function inertia(points, labels, centroids) {
  return points.reduce((s, p, i) => s + dist2(p, centroids[labels[i]]), 0);
}

// One full iteration. Returns new state and whether assignments stopped changing.
export function step(points, state) {
  const labels = assign(points, state.centroids);
  const changed = !state.labels || labels.some((l, i) => l !== state.labels[i]);
  const centroids = update(points, labels, state.centroids);
  return { labels, centroids, changed, iter: (state.iter || 0) + 1, inertia: inertia(points, labels, centroids) };
}

export function run(points, k, { method = 'kmeans++', seed = 1, maxIter = 100 } = {}) {
  const rnd = mulberry32(seed);
  let s = { centroids: initCentroids(points, k, method, rnd), labels: null, iter: 0 };
  while (s.iter < maxIter) {
    s = step(points, s);
    if (!s.changed) break;
  }
  return s;
}

// Mean silhouette coefficient in [-1, 1]; higher = better separated clusters.
export function silhouette(points, labels, k) {
  const n = points.length;
  if (n < 2 || k < 2) return 0;
  const sizes = Array(k).fill(0);
  labels.forEach(l => sizes[l]++);
  let total = 0;
  for (let i = 0; i < n; i++) {
    const sum = Array(k).fill(0);
    for (let j = 0; j < n; j++) if (j !== i) sum[labels[j]] += Math.sqrt(dist2(points[i], points[j]));
    const own = labels[i];
    if (sizes[own] <= 1) continue; // singleton: s = 0
    const a = sum[own] / (sizes[own] - 1);
    let b = Infinity;
    for (let c = 0; c < k; c++) if (c !== own && sizes[c]) b = Math.min(b, sum[c] / sizes[c]);
    if (b === Infinity) continue;
    total += (b - a) / Math.max(a, b);
  }
  return total / n;
}

// Elbow data: best-of-n inertia for each k.
export function elbow(points, maxK, seed = 1, restarts = 5) {
  const out = [];
  for (let k = 1; k <= Math.min(maxK, points.length); k++) {
    let best = Infinity;
    for (let r = 0; r < restarts; r++) best = Math.min(best, run(points, k, { seed: seed + r * 101 }).inertia);
    out.push({ k, inertia: best });
  }
  return out;
}

// Synthetic datasets in the unit square-ish range [0,1].
export function dataset(name, n, rnd) {
  const gauss = () => Math.sqrt(-2 * Math.log(1 - rnd())) * Math.cos(2 * Math.PI * rnd());
  const pts = [];
  if (name === 'blobs') {
    const centers = [[.2, .25], [.75, .3], [.5, .8]];
    for (let i = 0; i < n; i++) { const c = centers[i % 3]; pts.push([c[0] + gauss() * .06, c[1] + gauss() * .06]); }
  } else if (name === 'moons') {
    for (let i = 0; i < n; i++) {
      const t = rnd() * Math.PI, top = i % 2 === 0;
      pts.push(top ? [.3 + .25 * Math.cos(t) + gauss() * .02, .5 - .25 * Math.sin(t) + .1 + gauss() * .02]
                   : [.55 + .25 * Math.cos(t + Math.PI) * -1 + gauss() * .02, .5 + .25 * Math.sin(t) - .1 + gauss() * .02]);
    }
  } else if (name === 'rings') {
    for (let i = 0; i < n; i++) { const r = i % 2 ? .38 : .13, t = rnd() * 2 * Math.PI; pts.push([.5 + r * Math.cos(t) + gauss() * .01, .5 + r * Math.sin(t) + gauss() * .01]); }
  } else { // uniform
    for (let i = 0; i < n; i++) pts.push([rnd(), rnd()]);
  }
  return pts;
}
