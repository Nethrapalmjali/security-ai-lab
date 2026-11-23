import assert from 'node:assert/strict';
import { Network, makeDataset, split, features, mulberry32 } from './nn.js';

assert.equal(mulberry32(3)(), mulberry32(3)());

// Gradient check: backprop vs numerical gradient
{
  const net = new Network([2, 3, 1], 'tanh', 4);
  const batch = [{ x: [0.3, -0.7], y: 1 }, { x: [-0.2, 0.5], y: 0 }];
  const lossAt = () => net.loss(batch);
  const snap = JSON.stringify([net.W, net.b]);
  const eps = 1e-5, num = [];
  for (const [l, j, i] of [[0, 0, 0], [0, 2, 1], [1, 0, 1]]) {
    const o = net.W[l][j][i];
    net.W[l][j][i] = o + eps; const a = lossAt();
    net.W[l][j][i] = o - eps; const b = lossAt();
    net.W[l][j][i] = o; num.push((a - b) / (2 * eps));
  }
  const before = JSON.parse(snap);
  const lr = 1; net.trainBatch(batch, lr);
  const idx = [[0, 0, 0], [0, 2, 1], [1, 0, 1]];
  idx.forEach(([l, j, i], k) => {
    const analytic = (before[0][l][j][i] - net.W[l][j][i]) / lr;
    assert.ok(Math.abs(analytic - num[k]) < 1e-6, `grad mismatch ${analytic} vs ${num[k]}`);
  });
}

// Works with relu & sigmoid too (gradient check on relu-free-ish small net)
for (const act of ['relu', 'sigmoid']) {
  const net = new Network([2, 3, 1], act, 9);
  const batch = [{ x: [0.4, 0.6], y: 1 }];
  const o = net.W[0][1][0], eps = 1e-6;
  net.W[0][1][0] = o + eps; const a = net.loss(batch);
  net.W[0][1][0] = o - eps; const b = net.loss(batch);
  net.W[0][1][0] = o;
  net.trainBatch(batch, 1);
  assert.ok(Math.abs((o - net.W[0][1][0]) - (a - b) / (2 * eps)) < 1e-5, act);
}

// Learns XOR (non-linear)
{
  const data = makeDataset('xor', 200, 0.03, 2);
  const { train, test } = split(data, 0.7, 1);
  const net = new Network([2, 6, 4, 1], 'tanh', 3);
  const l0 = net.loss(train);
  for (let e = 0; e < 600; e++) net.trainBatch(train, 0.5);
  assert.ok(net.loss(train) < l0);
  assert.ok(net.accuracy(test) > 0.9, 'xor acc ' + net.accuracy(test));
}

// A linear model cannot solve XOR but can with x*y feature
{
  const data = makeDataset('xor', 200, 0.03, 2);
  const lin = new Network([2, 1], 'linear', 1);
  for (let e = 0; e < 500; e++) lin.trainBatch(data, 0.5);
  assert.ok(lin.accuracy(data) < 0.75);
  const fd = data.map((d) => ({ x: features(d.x, ['xy']), y: d.y }));
  const net = new Network([1, 1], 'linear', 1);
  for (let e = 0; e < 500; e++) net.trainBatch(fd, 1);
  assert.ok(net.accuracy(fd) > 0.95);
}

// Blobs easy, deterministic datasets, split sizes, param count
assert.deepEqual(makeDataset('circle', 10, 0.1, 5), makeDataset('circle', 10, 0.1, 5));
const s = split(makeDataset('blobs', 100), 0.7);
assert.equal(s.train.length, 70); assert.equal(s.test.length, 30);
assert.equal(new Network([2, 3, 1]).paramCount(), 2 * 3 + 3 + 3 + 1);
assert.deepEqual(features([2, 3], ['x', 'xy', 'y2']), [2, 9, 6]);
console.log('all tests passed');
