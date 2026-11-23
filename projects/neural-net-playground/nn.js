// Tiny feed-forward neural network with backprop, from scratch. ES module.
export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function gauss(rng) {
  let u = 0; while (u === 0) u = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng());
}

export const ACTIVATIONS = {
  tanh: { f: (x) => Math.tanh(x), d: (y) => 1 - y * y },       // d takes output y
  relu: { f: (x) => (x > 0 ? x : 0), d: (y) => (y > 0 ? 1 : 0) },
  sigmoid: { f: (x) => 1 / (1 + Math.exp(-x)), d: (y) => y * (1 - y) },
  linear: { f: (x) => x, d: () => 1 },
};

// sizes e.g. [2,4,4,1]. Hidden layers use `act`; output is sigmoid (binary classification).
export class Network {
  constructor(sizes, act = 'tanh', seed = 1) {
    this.sizes = sizes; this.act = act;
    const rng = mulberry32(seed);
    this.W = []; this.b = [];
    for (let l = 1; l < sizes.length; l++) {
      const fanIn = sizes[l - 1], s = Math.sqrt(2 / (fanIn + sizes[l])); // Xavier/Glorot
      this.W.push(Array.from({ length: sizes[l] }, () => Array.from({ length: fanIn }, () => gauss(rng) * s)));
      this.b.push(new Array(sizes[l]).fill(0));
    }
  }
  forward(x) {
    const acts = [x.slice()];
    const L = this.W.length;
    for (let l = 0; l < L; l++) {
      const f = l === L - 1 ? ACTIVATIONS.sigmoid.f : ACTIVATIONS[this.act].f;
      const prev = acts[l];
      acts.push(this.W[l].map((row, j) => { let s = this.b[l][j]; for (let i = 0; i < row.length; i++) s += row[i] * prev[i]; return f(s); }));
    }
    return acts;
  }
  predict(x) { const a = this.forward(x); return a[a.length - 1][0]; }
  // One mini-batch gradient step (binary cross-entropy). Returns mean loss.
  trainBatch(batch, lr, l2 = 0) {
    const L = this.W.length;
    const gW = this.W.map((m) => m.map((r) => r.map(() => 0)));
    const gb = this.b.map((v) => v.map(() => 0));
    let loss = 0;
    for (const { x, y } of batch) {
      const acts = this.forward(x);
      const p = Math.min(Math.max(acts[L][0], 1e-12), 1 - 1e-12);
      loss += -(y * Math.log(p) + (1 - y) * Math.log(1 - p));
      let delta = [acts[L][0] - y]; // dL/dz for sigmoid + BCE
      for (let l = L - 1; l >= 0; l--) {
        for (let j = 0; j < delta.length; j++) {
          gb[l][j] += delta[j];
          for (let i = 0; i < acts[l].length; i++) gW[l][j][i] += delta[j] * acts[l][i];
        }
        if (l > 0) {
          const d = ACTIVATIONS[this.act].d;
          const nd = new Array(acts[l].length).fill(0);
          for (let i = 0; i < nd.length; i++) {
            let s = 0; for (let j = 0; j < delta.length; j++) s += this.W[l][j][i] * delta[j];
            nd[i] = s * d(acts[l][i]);
          }
          delta = nd;
        }
      }
    }
    const n = batch.length;
    for (let l = 0; l < L; l++) for (let j = 0; j < this.W[l].length; j++) {
      this.b[l][j] -= (lr * gb[l][j]) / n;
      for (let i = 0; i < this.W[l][j].length; i++) this.W[l][j][i] -= lr * (gW[l][j][i] / n + l2 * this.W[l][j][i]);
    }
    return loss / n;
  }
  loss(data) {
    let s = 0;
    for (const { x, y } of data) { const p = Math.min(Math.max(this.predict(x), 1e-12), 1 - 1e-12); s += -(y * Math.log(p) + (1 - y) * Math.log(1 - p)); }
    return s / data.length;
  }
  accuracy(data) { return data.filter(({ x, y }) => (this.predict(x) >= 0.5 ? 1 : 0) === y).length / data.length; }
  paramCount() { return this.W.reduce((a, m, l) => a + m.length * m[0].length + this.b[l].length, 0); }
}

// Datasets: points in [-1,1]^2, label 0/1
export function makeDataset(name, n = 200, noise = 0.05, seed = 1) {
  const rng = mulberry32(seed), out = [];
  const nz = () => gauss(rng) * noise;
  for (let i = 0; i < n; i++) {
    const y = i % 2;
    let x;
    if (name === 'circle') {
      const r = y ? 0.25 + rng() * 0.15 : 0.65 + rng() * 0.25, t = rng() * 2 * Math.PI;
      x = [r * Math.cos(t) + nz(), r * Math.sin(t) + nz()];
    } else if (name === 'xor') {
      const sx = rng() < 0.5 ? -1 : 1, sy = y ? -sx : sx;
      x = [sx * (0.15 + rng() * 0.75) + nz(), sy * (0.15 + rng() * 0.75) + nz()];
    } else if (name === 'spiral') {
      const t = (i / 2 / (n / 2)) * 3.2 + 0.3, a = t * 1.9 + (y ? Math.PI : 0), r = t / 3.6;
      x = [r * Math.cos(a) + nz(), r * Math.sin(a) + nz()];
    } else { // blobs (linearly separable)
      const c = y ? 0.5 : -0.5; x = [c + gauss(rng) * 0.2 + nz(), c + gauss(rng) * 0.2 + nz()];
    }
    out.push({ x, y });
  }
  return out;
}

// Deterministic shuffle + train/test split
export function split(data, frac = 0.7, seed = 1) {
  const rng = mulberry32(seed), a = data.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  const k = Math.floor(a.length * frac);
  return { train: a.slice(0, k), test: a.slice(k) };
}

// Feature expansion so a single neuron can solve non-linear tasks
export function features(p, names) {
  const [x, y] = p, f = [];
  if (names.includes('x')) f.push(x);
  if (names.includes('y')) f.push(y);
  if (names.includes('x2')) f.push(x * x);
  if (names.includes('y2')) f.push(y * y);
  if (names.includes('xy')) f.push(x * y);
  if (names.includes('sinx')) f.push(Math.sin(3 * x));
  if (names.includes('siny')) f.push(Math.sin(3 * y));
  return f;
}
