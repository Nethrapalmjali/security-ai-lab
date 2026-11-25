import assert from 'node:assert/strict';
import { SURFACES, OPTIMIZERS, createOptimizer, numericGrad, run, nearestMinimum } from './opt.js';

// 1. analytic gradients match finite differences on every surface
for (const [k, S] of Object.entries(SURFACES)) {
  for (const [x, y] of [[0.3, -0.7], [1.2, 0.8], [-2, 1.5], [2.5, -1]]) {
    const a = S.grad(x, y), n = numericGrad(S.f, x, y);
    for (let i = 0; i < 2; i++) assert.ok(Math.abs(a[i] - n[i]) <= 1e-4 * Math.max(1, Math.abs(a[i])), `${k} grad[${i}] at ${x},${y}: ${a[i]} vs ${n[i]}`);
  }
  // gradient ~0 at each listed minimum
  for (const m of S.minima) { const g = S.grad(...m); assert.ok(Math.hypot(...g) < 1e-3, `${k} minimum ${m} grad ${g}`); }
}

// 2. every optimiser has a default lr for every surface
for (const S of Object.values(SURFACES)) for (const o in OPTIMIZERS) assert.ok(S.lr[o] > 0);

// 3. hand-computed single steps
let o = createOptimizer('sgd', SURFACES.bowl, [2, 1], 0.1); o.step();
assert.ok(Math.abs(o.x - 1.8) < 1e-12 && Math.abs(o.y - (1 - 0.1 * 20)) < 1e-12);
o = createOptimizer('momentum', SURFACES.bowl, [2, 0], 0.1); o.step(); o.step();
// step1: v=2, x=1.8 ; step2: v=.9*2+1.8=3.6, x=1.8-.36=1.44
assert.ok(Math.abs(o.x - 1.44) < 1e-12);
o = createOptimizer('adam', SURFACES.bowl, [2, 0], 0.1); o.step();
// first Adam step is ≈ lr * sign(g) because of bias correction
assert.ok(Math.abs(o.x - 1.9) < 1e-6, String(o.x));
o = createOptimizer('adagrad', SURFACES.bowl, [2, 0], 0.5); o.step();
assert.ok(Math.abs(o.x - 1.5) < 1e-6);
o = createOptimizer('rmsprop', SURFACES.bowl, [2, 0], 0.1); o.step();
// s = .1*4=.4, step = .1*2/sqrt(.4)
assert.ok(Math.abs(o.x - (2 - 0.2 / Math.sqrt(0.4))) < 1e-6);
o = createOptimizer('nesterov', SURFACES.bowl, [2, 0], 0.1); o.step(); o.step();
// step1 identical to momentum (v=0): x=1.8,v=2 ; step2 look-ahead x=1.8-.1*.9*2=1.62 -> g=1.62, v=3.42, x=1.8-.342
assert.ok(Math.abs(o.x - 1.458) < 1e-9, String(o.x));

// 4. convergence
for (const k of ['sgd', 'momentum', 'nesterov', 'adagrad', 'adam']) {
  const r = run(k, 'bowl', SURFACES.bowl.start, SURFACES.bowl.lr[k], 2000);
  assert.ok(!r.diverged && r.dist < 0.01, `bowl ${k} ${r.dist}`);
}
assert.ok(run('adam', 'rosenbrock', SURFACES.rosenbrock.start, 0.05, 2000).dist < 0.05);
assert.ok(run('momentum', 'rosenbrock', SURFACES.rosenbrock.start, 0.0005, 2000).dist < 0.1);
// momentum beats plain SGD on Rosenbrock at equal step budget
assert.ok(run('momentum', 'rosenbrock', SURFACES.rosenbrock.start, 0.0005, 2000).dist < run('sgd', 'rosenbrock', SURFACES.rosenbrock.start, 0.001, 2000).dist);
// saddle behaviour
const stuck = run('sgd', 'saddle', [0, 0], 0.05, 200); assert.equal(stuck.x, 0); assert.equal(stuck.y, 0); // exact saddle is a fixed point
assert.ok(run('sgd', 'saddle', [0.5, 0.02], 0.05, 500).dist < 0.01);
// Himmelblau: different starts reach different minima
const a = run('adam', 'himmelblau', [1, 1], 0.1, 1500), b = run('adam', 'himmelblau', [-1, -1], 0.1, 1500);
assert.ok(a.dist < 0.01 && b.dist < 0.01 && a.min !== b.min);

// 5. divergence is detected, not left as NaN
const dv = run('sgd', 'bowl', [4, 3], 0.5, 200);
assert.ok(dv.diverged);
// gradient clipping tames it
const cl = createOptimizer('sgd', SURFACES.rosenbrock, [-1.5, 2], 0.01, { clipNorm: 1 });
for (let i = 0; i < 50; i++) cl.step(); assert.ok(!cl.diverged);

// 6. unknown optimiser and nearestMinimum
assert.throws(() => createOptimizer('lbfgs', SURFACES.bowl, [1, 1], 0.1).step());
assert.deepEqual(nearestMinimum(SURFACES.himmelblau, 3.1, 2.1).min, [3, 2]);
// path length bounded
const long = createOptimizer('adam', SURFACES.bowl, [1, 1], 0.001); for (let i = 0; i < 5000; i++) long.step();
assert.ok(long.path.length <= 4000);
console.log('all gradient-descent-lab tests passed');
