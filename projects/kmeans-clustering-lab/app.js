import { mulberry32, initCentroids, step, silhouette, elbow, dataset } from './kmeans.js';
const COLORS = ['#58a6ff', '#ff7b72', '#3fb950', '#e3b341', '#d2a8ff', '#ff9a3c', '#39c5cf', '#f778ba'];
const $ = id => document.getElementById(id);
const cv = $('cv'), ctx = cv.getContext('2d');
let points = [], state = null, seed = 1, timer = null;

function resize() { const s = cv.clientWidth * devicePixelRatio; cv.width = cv.height = s; draw(); }
const px = p => [p[0] * cv.width, p[1] * cv.height];

function draw() {
  ctx.clearRect(0, 0, cv.width, cv.height);
  const r = cv.width / 150;
  points.forEach((p, i) => {
    const [x, y] = px(p);
    ctx.beginPath(); ctx.arc(x, y, r, 0, 7);
    ctx.fillStyle = state && state.labels ? COLORS[state.labels[i] % 8] : '#8b949e';
    ctx.globalAlpha = .85; ctx.fill();
  });
  ctx.globalAlpha = 1;
  if (state) state.centroids.forEach((c, i) => {
    const [x, y] = px(c);
    ctx.beginPath(); ctx.arc(x, y, r * 2.4, 0, 7);
    ctx.fillStyle = COLORS[i % 8]; ctx.fill();
    ctx.lineWidth = r * .6; ctx.strokeStyle = '#fff'; ctx.stroke();
  });
}

function stats() {
  const k = +$('k').value;
  $('iter').textContent = state ? state.iter : 0;
  $('inertia').textContent = state && state.inertia !== undefined ? state.inertia.toFixed(3) : '–';
  $('n').textContent = points.length;
  $('sil').textContent = state && state.labels && points.length <= 400 ? silhouette(points, state.labels, k).toFixed(3) : '–';
  $('status').textContent = !state ? 'Add points or load a dataset, then press Initialise.'
    : state.labels && !state.changed ? 'Converged: assignments stopped changing.' : 'Not converged yet — press Step.';
}

function init() {
  stop();
  const k = Math.min(+$('k').value, points.length);
  if (!points.length) { state = null; draw(); return stats(); }
  state = { centroids: initCentroids(points, k, $('init').value, mulberry32(seed++)), labels: null, iter: 0 };
  draw(); stats();
}
function doStep() {
  if (!state) init();
  if (!state) return;
  if (state.labels && !state.changed) return stop();
  state = step(points, state); draw(); stats();
  if (!state.changed) stop();
}
function stop() { clearInterval(timer); timer = null; $('run').textContent = 'Run'; }
function load(name) { stop(); state = null; points = dataset(name, +$('count').value, mulberry32(seed++)); draw(); stats(); drawElbow(null); }

cv.addEventListener('pointerdown', e => {
  const b = cv.getBoundingClientRect();
  points.push([(e.clientX - b.left) / b.width, (e.clientY - b.top) / b.height]);
  if (state) { state.labels = null; state.changed = true; }
  draw(); stats();
});
$('step').onclick = doStep;
$('run').onclick = () => { if (timer) return stop(); $('run').textContent = 'Pause'; timer = setInterval(doStep, 450); };
$('initBtn').onclick = init;
$('clear').onclick = () => { stop(); points = []; state = null; draw(); stats(); drawElbow(null); };
document.querySelectorAll('[data-ds]').forEach(b => b.onclick = () => load(b.dataset.ds));
$('k').oninput = () => { $('kv').textContent = $('k').value; };
$('elbowBtn').onclick = () => { if (points.length < 3) return; drawElbow(elbow(points, 8)); };

function drawElbow(data) {
  const svg = $('elbow'); svg.replaceChildren();
  const ns = 'http://www.w3.org/2000/svg';
  const mk = (t, a, txt) => { const e = document.createElementNS(ns, t); for (const k in a) e.setAttribute(k, a[k]); if (txt) e.textContent = txt; svg.appendChild(e); };
  if (!data) return mk('text', { x: 10, y: 30, fill: '#8b949e', 'font-size': 12 }, 'Press "Elbow plot" to compare k = 1…8');
  const max = data[0].inertia || 1, W = 300, H = 160, pad = 30;
  const X = i => pad + i * (W - pad - 10) / (data.length - 1 || 1), Y = v => H - pad - v / max * (H - pad - 10);
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  mk('polyline', { points: data.map((d, i) => `${X(i)},${Y(d.inertia)}`).join(' '), fill: 'none', stroke: '#58a6ff', 'stroke-width': 2 });
  data.forEach((d, i) => { mk('circle', { cx: X(i), cy: Y(d.inertia), r: 3, fill: '#58a6ff' }); mk('text', { x: X(i), y: H - 12, fill: '#8b949e', 'font-size': 10, 'text-anchor': 'middle' }, d.k); });
  mk('text', { x: 4, y: 12, fill: '#8b949e', 'font-size': 10 }, 'inertia vs k (look for the elbow)');
}

addEventListener('resize', resize);
resize(); load('blobs'); init();
