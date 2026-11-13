// Pure k-means logic (no DOM). Points are [x, y] arrays.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const dist2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2;

function gauss(rng) {
  const u = Math.max(rng(), 1e-12), v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export function makeDataset(name, n = 200, seed = 1) {
  const rng = mulberry32(seed), pts = [];
  if (name === 'blobs') {
    const c = [[0.25, 0.3], [0.75, 0.3], [0.5, 0.78]];
    for (let i = 0; i < n; i++) {
      const m = c[i % 3];
      pts.push([m[0] + gauss(rng) * 0.06, m[1] + gauss(rng) * 0.06]);
    }
  } else if (name === 'moons') {
    for (let i = 0; i < n; i++) {
      const t = rng() * Math.PI, top = i % 2 === 0;
      const x = top ? Math.cos(t) : 1 - Math.cos(t);
      const y = top ? Math.sin(t) : 0.5 - Math.sin(t);
      pts.push([0.25 + x * 0.25 + gauss(rng) * 0.02, 0.3 + y * 0.35 + gauss(rng) * 0.02]);
    }
  } else if (name === 'rings') {
    for (let i = 0; i < n; i++) {
      const r = i % 2 ? 0.17 : 0.4, t = rng() * 2 * Math.PI;
      pts.push([0.5 + r * Math.cos(t) + gauss(rng) * 0.01, 0.5 + r * Math.sin(t) + gauss(rng) * 0.01]);
    }
  } else if (name === 'uniform') {
    for (let i = 0; i < n; i++) pts.push([rng(), rng()]);
  } else throw new Error('unknown dataset ' + name);
  return pts;
}

export function parseCSV(text) {
  const pts = [];
  for (const line of String(text).split(/\r?\n/)) {
    const parts = line.trim().split(/[,\s;]+/);
    if (parts.length < 2) continue;
    const x = Number(parts[0]), y = Number(parts[1]);
    if (parts[0] !== '' && parts[1] !== '' && Number.isFinite(x) && Number.isFinite(y)) pts.push([x, y]);
  }
  return pts;
}

// Scale to the unit square so any CSV renders consistently.
export function normalize(pts) {
  if (!pts.length) return pts;
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  const mnx = Math.min(...xs), mxx = Math.max(...xs), mny = Math.min(...ys), mxy = Math.max(...ys);
  const sx = mxx - mnx || 1, sy = mxy - mny || 1;
  return pts.map(p => [(p[0] - mnx) / sx, (p[1] - mny) / sy]);
}

export function initCentroids(pts, k, method, rng) {
  k = Math.min(k, pts.length);
  if (method === 'random') {
    const idx = new Set();
    while (idx.size < k) idx.add(Math.floor(rng() * pts.length));
    return [...idx].map(i => pts[i].slice());
  }
  // k-means++ : next centre sampled proportional to squared distance to nearest chosen centre
  const cs = [pts[Math.floor(rng() * pts.length)].slice()];
  while (cs.length < k) {
    const d = pts.map(p => Math.min(...cs.map(c => dist2(p, c))));
    const total = d.reduce((a, b) => a + b, 0);
    if (total === 0) { cs.push(pts[Math.floor(rng() * pts.length)].slice()); continue; }
    let r = rng() * total, i = 0;
    while (i < d.length - 1 && (r -= d[i]) > 0) i++;
    cs.push(pts[i].slice());
  }
  return cs;
}

export function assign(pts, cs) {
  return pts.map(p => {
    let best = 0, bd = Infinity;
    for (let j = 0; j < cs.length; j++) {
      const d = dist2(p, cs[j]);
      if (d < bd) { bd = d; best = j; }
    }
    return best;
  });
}

// Move each centroid to the mean of its members; empty clusters keep their position.
export function update(pts, labels, cs) {
  const sum = cs.map(() => [0, 0, 0]);
  pts.forEach((p, i) => { const s = sum[labels[i]]; s[0] += p[0]; s[1] += p[1]; s[2]++; });
  return cs.map((c, j) => (sum[j][2] ? [sum[j][0] / sum[j][2], sum[j][1] / sum[j][2]] : c.slice()));
}

export function inertia(pts, labels, cs) {
  return pts.reduce((s, p, i) => s + dist2(p, cs[labels[i]]), 0);
}

// Mean silhouette coefficient in [-1, 1]; higher = better separated.
export function silhouette(pts, labels, k) {
  const n = pts.length;
  if (k < 2 || n < 3) return 0;
  const sizes = new Array(k).fill(0);
  labels.forEach(l => sizes[l]++);
  let total = 0;
  for (let i = 0; i < n; i++) {
    if (sizes[labels[i]] <= 1) continue; // s = 0 by convention
    const sums = new Array(k).fill(0);
    for (let j = 0; j < n; j++) if (j !== i) sums[labels[j]] += Math.sqrt(dist2(pts[i], pts[j]));
    const a = sums[labels[i]] / (sizes[labels[i]] - 1);
    let b = Infinity;
    for (let c = 0; c < k; c++) if (c !== labels[i] && sizes[c] > 0) b = Math.min(b, sums[c] / sizes[c]);
    total += (b - a) / Math.max(a, b || 1e-12);
  }
  return total / n;
}

// Run Lloyd's algorithm to convergence. Returns every step for replay.
export function run(pts, k, { init = 'kmeans++', seed = 1, maxIter = 100 } = {}) {
  const rng = mulberry32(seed);
  let cs = initCentroids(pts, k, init, rng);
  const history = [];
  let labels = assign(pts, cs);
  history.push({ centroids: cs, labels, inertia: inertia(pts, labels, cs) });
  let converged = false;
  for (let it = 0; it < maxIter; it++) {
    const next = update(pts, labels, cs);
    const nl = assign(pts, next);
    const changed = nl.some((l, i) => l !== labels[i]);
    cs = next; labels = nl;
    history.push({ centroids: cs, labels, inertia: inertia(pts, labels, cs) });
    if (!changed) { converged = true; break; }
  }
  return { history, converged, final: history[history.length - 1] };
}

// Best of several restarts by inertia, for the elbow curve.
export function elbow(pts, kmax = 8, opts = {}) {
  const out = [];
  for (let k = 1; k <= Math.min(kmax, pts.length); k++) {
    let best = null;
    for (let s = 0; s < 5; s++) {
      const r = run(pts, k, { ...opts, seed: (opts.seed ?? 1) + s * 101 });
      if (!best || r.final.inertia < best.final.inertia) best = r;
    }
    out.push({ k, inertia: best.final.inertia, silhouette: silhouette(pts, best.final.labels, k) });
  }
  return out;
}
