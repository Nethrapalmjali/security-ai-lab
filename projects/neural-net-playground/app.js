import { Network, makeDataset, split, features, mulberry32 } from './nn.js';
const $ = (id) => document.getElementById(id);
const FEATS = [['x', 'x'], ['y', 'y'], ['x2', 'x²'], ['y2', 'y²'], ['xy', 'xy'], ['sinx', 'sin(3x)'], ['siny', 'sin(3y)']];
for (const [k, label] of FEATS) {
  const l = document.createElement('label'), i = document.createElement('input');
  i.type = 'checkbox'; i.value = k; i.checked = k === 'x' || k === 'y';
  l.append(i, document.createTextNode(label)); $('feats').append(l);
}
let net, train, test, hist, timer = null, epoch = 0, seed = 1;
const feats = () => [...$('feats').querySelectorAll('input:checked')].map((i) => i.value);
const mapData = (d, f) => d.map((p) => ({ x: features(p.x, f), y: p.y }));
const parseLayers = () => $('layers').value.split(',').map((s) => parseInt(s, 10)).filter((n) => n >= 1 && n <= 16).slice(0, 5);

function build() {
  stop();
  const f = feats();
  if (!f.length) { $('stats').textContent = 'Select at least one input feature.'; return; }
  const raw = makeDataset($('ds').value, 240, +$('noise').value, seed);
  const s = split(raw, 0.7, seed);
  s.rawTrain = s.train; s.rawTest = s.test;
  train = s; test = s.test; // raw (2D) points kept for drawing
  net = new Network([f.length, ...parseLayers(), 1], $('act').value, seed);
  hist = []; epoch = 0; draw(); stats();
}
function trainSteps(n) {
  const f = feats(), tr = mapData(train.train, f), te = mapData(test, f), lr = +$('lr').value, l2 = +$('l2').value;
  const rng = mulberry32(epoch + 7);
  for (let e = 0; e < n; e++) {
    const sh = tr.slice().sort(() => rng() - 0.5);
    for (let i = 0; i < sh.length; i += 16) net.trainBatch(sh.slice(i, i + 16), lr, l2);
    epoch++;
    if (e % 5 === 4 || e === n - 1) hist.push([net.loss(tr), net.loss(te)]);
  }
  draw(); stats();
}
function stats() {
  const f = feats(), tr = mapData(train.train, f), te = mapData(test, f);
  $('stats').textContent = `epoch ${epoch} · params ${net.paramCount()} · train loss ${net.loss(tr).toFixed(3)} acc ${(net.accuracy(tr) * 100).toFixed(1)}% · test loss ${net.loss(te).toFixed(3)} acc ${(net.accuracy(te) * 100).toFixed(1)}%`;
}
function draw() {
  const cv = $('cv'), c = cv.getContext('2d'), W = cv.width, R = 52, f = feats();
  c.clearRect(0, 0, W, W);
  const cell = W / R;
  for (let i = 0; i < R; i++) for (let j = 0; j < R; j++) {
    const x = ((i + 0.5) / R) * 2 - 1, y = 1 - ((j + 0.5) / R) * 2, p = net.predict(features([x, y], f));
    const m = (o, bl) => Math.round(0.65 * [11, 15, 20][0] * 0 + 0.65 * 14 + 0.35 * (o + (bl - o) * p));
    c.fillStyle = `rgb(${m(255, 88)},${m(154, 166)},${m(60, 255)})`;
    c.fillRect(Math.floor(i * cell), Math.floor(j * cell), Math.ceil(cell) + 1, Math.ceil(cell) + 1);
  }
  const dot = (p, hollow) => {
    c.beginPath(); c.arc(((p.x[0] + 1) / 2) * W, ((1 - p.x[1]) / 2) * W, 4, 0, 7);
    const col = p.y ? '#58a6ff' : '#ff9a3c';
    if (hollow) { c.lineWidth = 2; c.strokeStyle = col; c.stroke(); } else { c.fillStyle = col; c.fill(); c.strokeStyle = '#0d1117'; c.lineWidth = 1; c.stroke(); }
  };
  train.train.forEach((p) => dot(p, false)); test.forEach((p) => dot(p, true));
  const lc = $('lc'), g = lc.getContext('2d'); g.clearRect(0, 0, lc.width, lc.height);
  if (hist.length > 1) {
    const mx = Math.max(...hist.flat(), 0.01);
    [[0, '#58a6ff'], [1, '#ff9a3c']].forEach(([k, col]) => {
      g.beginPath(); g.strokeStyle = col; g.lineWidth = 2;
      hist.forEach((h, i) => { const X = (i / (hist.length - 1)) * (lc.width - 10) + 5, Y = lc.height - 8 - (h[k] / mx) * (lc.height - 16); i ? g.lineTo(X, Y) : g.moveTo(X, Y); });
      g.stroke();
    });
    g.fillStyle = '#8b949e'; g.font = '12px sans-serif'; g.fillText('loss — blue: train, orange: test', 8, 14);
  }
}
function stop() { if (timer) { clearInterval(timer); timer = null; } $('play').textContent = 'Train'; $('play').setAttribute('aria-pressed', 'false'); }
$('play').onclick = () => {
  if (timer) return stop();
  if (!net) build(); if (!net) return;
  $('play').textContent = 'Pause'; $('play').setAttribute('aria-pressed', 'true');
  timer = setInterval(() => trainSteps(5), 40);
};
$('step').onclick = () => { if (!net) build(); if (net) trainSteps(50); };
$('reset').onclick = () => { seed++; build(); };
for (const id of ['ds', 'noise', 'layers', 'act']) $(id).addEventListener('change', build);
$('feats').addEventListener('change', build);
for (const [id, o] of [['noise', 'nv'], ['lr', 'lv'], ['l2', 'l2v']]) $(id).addEventListener('input', () => { $(o).textContent = $(id).value; });
document.querySelectorAll('[data-p]').forEach((b) => b.onclick = () => {
  const [ds, layers, act, f] = b.dataset.p.split('|');
  $('ds').value = ds; $('layers').value = layers; $('act').value = act;
  const fs = f.split(','); $('feats').querySelectorAll('input').forEach((i) => { i.checked = fs.includes(i.value); });
  build(); $('play').click();
});
build();
