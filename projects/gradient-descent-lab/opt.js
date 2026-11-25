// Gradient-descent optimisers and 2-D test surfaces, pure functions (no DOM).
export const SURFACES = {
  bowl: {
    name: 'Ill-conditioned bowl', f: (x, y) => 0.5 * (x * x + 20 * y * y),
    grad: (x, y) => [x, 20 * y], domain: [-5, 5, -5, 5], start: [-4, 3], minima: [[0, 0]],
    note: 'Curvature is 20× larger along y than x: plain SGD zig-zags, adaptive methods cope.',
    lr: { sgd: 0.09, momentum: 0.03, nesterov: 0.03, adagrad: 1.0, rmsprop: 0.05, adam: 0.3 }
  },
  rosenbrock: {
    name: 'Rosenbrock valley', f: (x, y) => (1 - x) ** 2 + 100 * (y - x * x) ** 2,
    grad: (x, y) => [-2 * (1 - x) - 400 * x * (y - x * x), 200 * (y - x * x)],
    domain: [-2, 2, -1, 3], start: [-1.5, 2], minima: [[1, 1]],
    note: 'A narrow curved valley: easy to enter, slow to follow to the minimum at (1, 1).',
    lr: { sgd: 0.001, momentum: 0.0005, nesterov: 0.0005, adagrad: 0.5, rmsprop: 0.01, adam: 0.05 }
  },
  beale: {
    name: 'Beale function',
    f: (x, y) => (1.5 - x + x * y) ** 2 + (2.25 - x + x * y * y) ** 2 + (2.625 - x + x * y ** 3) ** 2,
    grad: (x, y) => {
      const a = 1.5 - x + x * y, b = 2.25 - x + x * y * y, c = 2.625 - x + x * y ** 3;
      return [2 * a * (y - 1) + 2 * b * (y * y - 1) + 2 * c * (y ** 3 - 1),
        2 * a * x + 2 * b * 2 * x * y + 2 * c * 3 * x * y * y];
    },
    domain: [-4.5, 4.5, -4.5, 4.5], start: [-3, -3], minima: [[3, 0.5]],
    note: 'Flat plateaus with steep walls; the minimum sits at (3, 0.5).',
    lr: { sgd: 0.0001, momentum: 0.00003, nesterov: 0.00003, adagrad: 0.8, rmsprop: 0.03, adam: 0.2 }
  },
  himmelblau: {
    name: 'Himmelblau (4 minima)', f: (x, y) => (x * x + y - 11) ** 2 + (x + y * y - 7) ** 2,
    grad: (x, y) => [4 * x * (x * x + y - 11) + 2 * (x + y * y - 7), 2 * (x * x + y - 11) + 4 * y * (x + y * y - 7)],
    domain: [-5, 5, -5, 5], start: [0, 0], minima: [[3, 2], [-2.805118, 3.131312], [-3.779310, -3.283186], [3.584428, -1.848126]],
    note: 'Four equal minima: where you start decides where you end up. Click to move the start.',
    lr: { sgd: 0.01, momentum: 0.005, nesterov: 0.005, adagrad: 0.5, rmsprop: 0.05, adam: 0.1 }
  },
  saddle: {
    name: 'Saddle point', f: (x, y) => x * x - y * y + 0.25 * y ** 4,
    grad: (x, y) => [2 * x, -2 * y + y ** 3], domain: [-3, 3, -3, 3], start: [2, 0.02], minima: [[0, 1.414214], [0, -1.414214]],
    note: 'Origin is a saddle (gradient 0, not a minimum). Optimisers must escape it to reach (0, ±√2).',
    lr: { sgd: 0.05, momentum: 0.02, nesterov: 0.02, adagrad: 0.5, rmsprop: 0.05, adam: 0.1 }
  },
  rastrigin: {
    name: 'Rastrigin (many local minima)',
    f: (x, y) => 20 + x * x - 10 * Math.cos(2 * Math.PI * x) + y * y - 10 * Math.cos(2 * Math.PI * y),
    grad: (x, y) => [2 * x + 20 * Math.PI * Math.sin(2 * Math.PI * x), 2 * y + 20 * Math.PI * Math.sin(2 * Math.PI * y)],
    domain: [-5.12, 5.12, -5.12, 5.12], start: [3.3, 2.4], minima: [[0, 0]],
    note: 'A grid of local minima traps greedy optimisers; momentum can roll across some of them.',
    lr: { sgd: 0.004, momentum: 0.002, nesterov: 0.002, adagrad: 0.2, rmsprop: 0.02, adam: 0.05 }
  }
};

export const OPTIMIZERS = {
  sgd: { name: 'SGD', color: '#f85149', desc: 'x ← x − η∇f' },
  momentum: { name: 'Momentum', color: '#e3b341', desc: 'v ← βv + ∇f; x ← x − ηv' },
  nesterov: { name: 'Nesterov', color: '#3fb950', desc: 'gradient taken at look-ahead x − ηβv' },
  adagrad: { name: 'AdaGrad', color: '#a371f7', desc: 'divides by √(Σ g²)' },
  rmsprop: { name: 'RMSProp', color: '#39c5cf', desc: 'divides by √(EMA of g²)' },
  adam: { name: 'Adam', color: '#ff7b72', desc: 'momentum + RMS scaling + bias correction' }
};

const clip = (g, max) => {
  if (!max) return g;
  const n = Math.hypot(g[0], g[1]);
  return n > max ? [g[0] * max / n, g[1] * max / n] : g;
};

/** Create an optimiser state. Returns {x, y, step(), steps, diverged, path}. */
export function createOptimizer(kind, surface, start, lr, opts = {}) {
  const { beta = 0.9, beta2 = 0.999, eps = 1e-8, clipNorm = 0 } = opts;
  const S = typeof surface === 'string' ? SURFACES[surface] : surface;
  const st = { kind, x: start[0], y: start[1], steps: 0, diverged: false, path: [[start[0], start[1]]],
    v: [0, 0], s: [0, 0], m: [0, 0], lr };
  st.step = () => {
    if (st.diverged) return st;
    let g;
    if (kind === 'nesterov') g = S.grad(st.x - lr * beta * st.v[0], st.y - lr * beta * st.v[1]);
    else g = S.grad(st.x, st.y);
    g = clip(g, clipNorm);
    const t = ++st.steps;
    let d = [0, 0];
    for (let i = 0; i < 2; i++) {
      switch (kind) {
        case 'sgd': d[i] = lr * g[i]; break;
        case 'momentum': case 'nesterov':
          st.v[i] = beta * st.v[i] + g[i]; d[i] = lr * st.v[i]; break;
        case 'adagrad': st.s[i] += g[i] * g[i]; d[i] = lr * g[i] / (Math.sqrt(st.s[i]) + eps); break;
        case 'rmsprop': st.s[i] = 0.9 * st.s[i] + 0.1 * g[i] * g[i]; d[i] = lr * g[i] / (Math.sqrt(st.s[i]) + eps); break;
        case 'adam': {
          st.m[i] = beta * st.m[i] + (1 - beta) * g[i];
          st.s[i] = beta2 * st.s[i] + (1 - beta2) * g[i] * g[i];
          const mh = st.m[i] / (1 - beta ** t), sh = st.s[i] / (1 - beta2 ** t);
          d[i] = lr * mh / (Math.sqrt(sh) + eps); break;
        }
        default: throw new Error('unknown optimiser ' + kind);
      }
    }
    st.x -= d[0]; st.y -= d[1];
    if (!Number.isFinite(st.x) || !Number.isFinite(st.y) || Math.abs(st.x) > 1e4 || Math.abs(st.y) > 1e4) st.diverged = true;
    else { st.path.push([st.x, st.y]); if (st.path.length > 4000) st.path.shift(); }
    return st;
  };
  return st;
}

export function numericGrad(f, x, y, h = 1e-5) {
  return [(f(x + h, y) - f(x - h, y)) / (2 * h), (f(x, y + h) - f(x, y - h)) / (2 * h)];
}

/** Nearest known minimum and distance. */
export function nearestMinimum(S, x, y) {
  let best = null, bd = Infinity;
  for (const m of S.minima) { const d = Math.hypot(x - m[0], y - m[1]); if (d < bd) { bd = d; best = m; } }
  return { min: best, dist: bd };
}

/** Run n steps and return summary stats. */
export function run(kind, surfaceKey, start, lr, n, opts) {
  const S = SURFACES[surfaceKey], o = createOptimizer(kind, S, start, lr, opts);
  for (let i = 0; i < n && !o.diverged; i++) o.step();
  return { x: o.x, y: o.y, loss: S.f(o.x, o.y), diverged: o.diverged, steps: o.steps, ...nearestMinimum(S, o.x, o.y) };
}
