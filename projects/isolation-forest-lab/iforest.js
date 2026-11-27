// Isolation Forest (Liu, Ting & Zhou 2008), implemented from scratch.
// Pure logic: no DOM, so it can be unit-tested in Node.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const EULER = 0.5772156649015329;

/** Average path length of an unsuccessful BST search over n points: c(n). */
export function c(n) {
  if (n <= 1) return 0;
  if (n === 2) return 1;
  const H = Math.log(n - 1) + EULER;
  return 2 * H - (2 * (n - 1)) / n;
}

/** Draw `k` distinct indices from 0..n-1 (partial Fisher-Yates). */
export function sampleIndices(n, k, rand) {
  const idx = Array.from({ length: n }, (_, i) => i);
  k = Math.min(k, n);
  for (let i = 0; i < k; i++) {
    const j = i + Math.floor(rand() * (n - i));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  return idx.slice(0, k);
}

/** Build one isolation tree over rows `X` (array of arrays). */
export function buildTree(X, rand, depth = 0, maxDepth = 8) {
  const n = X.length;
  if (depth >= maxDepth || n <= 1) return { leaf: true, size: n };
  const d = X[0].length;
  // pick a random feature that actually varies; give up if none does
  const order = sampleIndices(d, d, rand);
  for (const f of order) {
    let lo = Infinity, hi = -Infinity;
    for (const r of X) { if (r[f] < lo) lo = r[f]; if (r[f] > hi) hi = r[f]; }
    if (hi > lo) {
      const split = lo + rand() * (hi - lo);
      const L = [], R = [];
      for (const r of X) (r[f] < split ? L : R).push(r);
      if (!L.length || !R.length) continue; // split == lo exactly; try next feature
      return { leaf: false, f, split, left: buildTree(L, rand, depth + 1, maxDepth), right: buildTree(R, rand, depth + 1, maxDepth) };
    }
  }
  return { leaf: true, size: n };
}

/** Path length of point x in a tree, with the c(size) adjustment at unexpanded leaves. */
export function pathLength(tree, x) {
  let node = tree, h = 0;
  while (!node.leaf) { node = x[node.f] < node.split ? node.left : node.right; h++; }
  return h + c(node.size);
}

/** Fit a forest. Returns {trees, psi}. */
export function fit(X, { trees = 100, subsample = 256, seed = 42 } = {}) {
  if (!X.length) throw new Error('no data');
  const rand = mulberry32(seed);
  const psi = Math.min(subsample, X.length);
  const maxDepth = Math.ceil(Math.log2(Math.max(psi, 2)));
  const ts = [];
  for (let i = 0; i < trees; i++) {
    const sub = sampleIndices(X.length, psi, rand).map(j => X[j]);
    ts.push(buildTree(sub, rand, 0, maxDepth));
  }
  return { trees: ts, psi };
}

/** Anomaly score s = 2^(-E[h]/c(psi)) in (0,1]; ~1 anomalous, ~0.5 normal-ish, <0.5 dense. */
export function score(model, x) {
  let sum = 0;
  for (const t of model.trees) sum += pathLength(t, x);
  const eh = sum / model.trees.length;
  const cn = c(model.psi);
  return cn === 0 ? 0.5 : Math.pow(2, -eh / cn);
}

export function scoreAll(model, X) { return X.map(x => score(model, x)); }

/** Score threshold flagging the top `contamination` fraction (0..1) as anomalies. */
export function threshold(scores, contamination) {
  if (!scores.length) return 1;
  const sorted = [...scores].sort((a, b) => b - a);
  const k = Math.max(0, Math.min(sorted.length, Math.round(contamination * sorted.length)));
  if (k === 0) return Infinity;
  return sorted[k - 1];
}

/** Parse numeric CSV text (optional header). Returns {header, rows, skipped}. */
export function parseCSV(text) {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (!lines.length) return { header: [], rows: [], skipped: 0 };
  const split = l => l.split(/[,;\t]/).map(s => s.trim());
  let first = split(lines[0]);
  let header = null, start = 0;
  if (first.some(v => v === '' || isNaN(Number(v)))) { header = first; start = 1; }
  const width = first.length;
  const rows = []; let skipped = 0;
  for (let i = start; i < lines.length; i++) {
    const p = split(lines[i]);
    const nums = p.map(Number);
    if (p.length !== width || nums.some(v => !Number.isFinite(v))) { skipped++; continue; }
    rows.push(nums);
  }
  if (!header) header = Array.from({ length: width }, (_, i) => 'x' + (i + 1));
  return { header, rows, skipped };
}

/** Min-max scale each column to [0,1] so no feature dominates. */
export function normalize(X) {
  if (!X.length) return { Z: [], mins: [], maxs: [] };
  const d = X[0].length, mins = Array(d).fill(Infinity), maxs = Array(d).fill(-Infinity);
  for (const r of X) for (let j = 0; j < d; j++) { mins[j] = Math.min(mins[j], r[j]); maxs[j] = Math.max(maxs[j], r[j]); }
  const Z = X.map(r => r.map((v, j) => (maxs[j] > mins[j] ? (v - mins[j]) / (maxs[j] - mins[j]) : 0.5)));
  return { Z, mins, maxs };
}

/** Precision / recall / F1 given flags and ground-truth labels (1 = attack). */
export function evaluate(flags, labels) {
  let tp = 0, fp = 0, fn = 0, tn = 0;
  flags.forEach((f, i) => { const y = labels[i]; if (f && y) tp++; else if (f && !y) fp++; else if (!f && y) fn++; else tn++; });
  const precision = tp + fp ? tp / (tp + fp) : 0, recall = tp + fn ? tp / (tp + fn) : 0;
  return { tp, fp, fn, tn, precision, recall, f1: precision + recall ? (2 * precision * recall) / (precision + recall) : 0 };
}

/** Area under ROC via rank statistic (ties get average rank). */
export function auc(scores, labels) {
  const pairs = scores.map((s, i) => [s, labels[i]]).sort((a, b) => a[0] - b[0]);
  let rankSum = 0, pos = 0, i = 0;
  while (i < pairs.length) {
    let j = i; while (j + 1 < pairs.length && pairs[j + 1][0] === pairs[i][0]) j++;
    const avg = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) if (pairs[k][1]) { rankSum += avg; pos++; }
    i = j + 1;
  }
  const neg = pairs.length - pos;
  return pos && neg ? (rankSum - (pos * (pos + 1)) / 2) / (pos * neg) : NaN;
}

// ---------- demo datasets (seeded, labelled: 1 = injected anomaly) ----------
function gauss(rand) { return Math.sqrt(-2 * Math.log(1 - rand())) * Math.cos(2 * Math.PI * rand()); }

export function makeDataset(name, seed = 7) {
  const r = mulberry32(seed), pts = [], lab = [];
  const add = (x, y, l) => { pts.push([x, y]); lab.push(l); };
  if (name === 'blob') {
    for (let i = 0; i < 300; i++) add(50 + 10 * gauss(r), 50 + 10 * gauss(r), 0);
    for (let i = 0; i < 12; i++) add(r() * 100, r() * 100, 1);
  } else if (name === 'clusters') {
    for (let i = 0; i < 150; i++) add(25 + 6 * gauss(r), 30 + 6 * gauss(r), 0);
    for (let i = 0; i < 150; i++) add(72 + 6 * gauss(r), 70 + 6 * gauss(r), 0);
    for (let i = 0; i < 10; i++) add(48 + 4 * gauss(r), 50 + 4 * gauss(r), 1); // sit between the clusters
  } else if (name === 'logins') {
    // x = logins/hour, y = failed-login ratio (%) per account
    for (let i = 0; i < 280; i++) add(Math.max(1, 12 + 6 * gauss(r)) * 2, Math.min(100, Math.max(0, 6 + 4 * gauss(r))), 0);
    for (let i = 0; i < 6; i++) add(150 + 30 * r(), 92 + 8 * r(), 1);   // credential stuffing: huge volume, nearly all fail
    for (let i = 0; i < 6; i++) add(10 + 10 * r(), 80 + 15 * r(), 1);   // targeted guessing: low volume, mostly fail
  } else if (name === 'ring') {
    for (let i = 0; i < 300; i++) { const a = r() * 2 * Math.PI, rad = 35 + 3 * gauss(r); add(50 + rad * Math.cos(a), 50 + rad * Math.sin(a), 0); }
    for (let i = 0; i < 10; i++) add(50 + 6 * gauss(r), 50 + 6 * gauss(r), 1); // hole in the middle
  } else throw new Error('unknown dataset ' + name);
  return { X: pts, labels: lab };
}
