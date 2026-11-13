import * as K from './kmeans.js';

const COLORS = ['#58a6ff', '#ff7b72', '#3fb950', '#e3b341', '#d2a8ff', '#ffa657', '#79c0ff', '#f778ba'];
const $ = id => document.getElementById(id);
const cv = $('cv'), ctx = cv.getContext('2d');
let pts = K.makeDataset('blobs', 180, 1);
let state = null; // {history, i, converged}
let timer = null;

const opts = () => ({ init: $('init').value, seed: Number($('seed').value) || 0 });
const k = () => Number($('k').value);

function draw() {
  const W = cv.width;
  ctx.clearRect(0, 0, W, W);
  const cur = state && state.history[state.i];
  const P = 24, S = W - 2 * P;
  const px = p => [P + p[0] * S, P + (1 - p[1]) * S];
  pts.forEach((p, i) => {
    const [x, y] = px(p);
    ctx.fillStyle = cur ? COLORS[cur.labels[i] % 8] : '#8b949e';
    ctx.globalAlpha = 0.8;
    ctx.beginPath(); ctx.arc(x, y, 5, 0, 7); ctx.fill();
  });
  ctx.globalAlpha = 1;
  if (cur) cur.centroids.forEach((c, j) => {
    const [x, y] = px(c);
    ctx.fillStyle = COLORS[j % 8]; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x, y - 12); ctx.lineTo(x + 12, y); ctx.lineTo(x, y + 12); ctx.lineTo(x - 12, y); ctx.closePath();
    ctx.fill(); ctx.stroke();
  });
  const s = $('stats');
  s.textContent = '';
  const line = (label, val) => { const d = document.createElement('div'); d.append(label + ': '); const b = document.createElement('b'); b.textContent = val; d.append(b); s.append(d); };
  line('Points', pts.length);
  if (cur) {
    line('Iteration', `${state.i} / ${state.history.length - 1}`);
    line('Inertia (SSE)', cur.inertia.toFixed(4));
    line('Silhouette', K.silhouette(pts, cur.labels, cur.centroids.length).toFixed(3));
    line('Status', state.converged && state.i === state.history.length - 1 ? 'converged' : 'running');
  }
}

function start() {
  stop();
  if (pts.length < 2) { $('msg').textContent = 'Need at least 2 points.'; return; }
  state = { ...K.run(pts, k(), opts()), i: 0 };
  draw();
}
function step() {
  if (!state) start();
  if (state.i < state.history.length - 1) state.i++;
  draw();
  return state.i < state.history.length - 1;
}
function stop() { clearInterval(timer); timer = null; }
function play() {
  if (!state) start();
  stop();
  timer = setInterval(() => { if (!step()) stop(); }, 450);
}

function setPts(p, note) {
  pts = p; state = null; stop(); $('elbowOut').textContent = ''; $('msg').textContent = note || ''; draw();
}

cv.addEventListener('click', e => {
  const r = cv.getBoundingClientRect(), P = 24 / cv.width;
  const fx = (e.clientX - r.left) / r.width, fy = (e.clientY - r.top) / r.height;
  const x = Math.min(1, Math.max(0, (fx - P) / (1 - 2 * P))), y = Math.min(1, Math.max(0, 1 - (fy - P) / (1 - 2 * P)));
  pts.push([x, y]); state = null; stop(); draw();
});
document.querySelectorAll('[data-ds]').forEach(b => b.addEventListener('click', () => setPts(K.makeDataset(b.dataset.ds, 180, Number($('seed').value) || 1), b.dataset.ds + ' dataset loaded.')));
$('clear').onclick = () => setPts([], 'Cleared. Click the plot to add points.');
$('k').oninput = () => { $('kv').textContent = $('k').value; state = null; stop(); draw(); };
$('start').onclick = start;
$('step').onclick = step;
$('play').onclick = play;
$('load').onclick = () => {
  const p = K.parseCSV($('csv').value);
  if (p.length < 2) { $('msg').textContent = 'No valid x,y rows found.'; return; }
  setPts(K.normalize(p), `Loaded ${p.length} points (scaled to the unit square).`);
};
$('elbow').onclick = () => {
  const out = $('elbowOut');
  out.textContent = '';
  if (pts.length < 3) { out.textContent = 'Need at least 3 points.'; return; }
  const rows = K.elbow(pts, 8, opts());
  const best = rows.slice(1).reduce((a, b) => (b.silhouette > a.silhouette ? b : a), rows[1] || rows[0]);
  const max = rows[0].inertia || 1;
  const t = document.createElement('table');
  const hr = t.insertRow();
  ['k', 'Inertia', '', 'Silhouette'].forEach(h => { const th = document.createElement('th'); th.textContent = h; hr.append(th); });
  rows.forEach(r => {
    const tr = t.insertRow();
    if (r.k === best.k) tr.className = 'best';
    tr.insertCell().textContent = r.k;
    tr.insertCell().textContent = r.inertia.toFixed(3);
    const bc = tr.insertCell(); const bar = document.createElement('span'); bar.className = 'b'; bar.style.width = (80 * r.inertia / max) + 'px'; bc.append(bar);
    tr.insertCell().textContent = r.k === 1 ? '—' : r.silhouette.toFixed(3);
  });
  out.append(t);
  const p = document.createElement('p'); p.className = 'd'; p.textContent = `Highest silhouette: k = ${best.k}.`; out.append(p);
};
draw();
