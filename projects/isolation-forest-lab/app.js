import { fit, scoreAll, score, threshold, parseCSV, normalize, evaluate, auc, makeDataset } from './iforest.js';

const $ = id => document.getElementById(id);
const cv = $('cv'), ctx = cv.getContext('2d');
const S = { X: [], labels: null, header: ['x', 'y'], ax: 0, ay: 1, added: [], model: null, scores: [], th: 1, norm: null, dom: null };
const GRID = 36;

function el(tag, text, cls) { const e = document.createElement(tag); if (text !== undefined) e.textContent = text; if (cls) e.className = cls; return e; }
const fmt = v => (Math.abs(v) >= 1000 || (Math.abs(v) < .01 && v !== 0)) ? v.toExponential(2) : String(+v.toFixed(2));

function allPoints() { return S.X.concat(S.added); }

function heat(t) { // 0..1 -> colour: dark navy -> purple -> orange
  const s = Math.max(0, Math.min(1, (t - 0.35) / 0.4));
  const r = Math.round(13 + 230 * s * s), g = Math.round(17 + 90 * s * (1 - s) + 40 * s * s * s), b = Math.round(23 + 60 * (1 - s) * s * 2);
  return `rgb(${r},${g},${b})`;
}

function refit() {
  const pts = allPoints();
  if (pts.length < 4) { $('note').textContent = 'Need at least 4 numeric rows.'; return; }
  S.norm = normalize(pts);
  const model = fit(S.norm.Z, { trees: +$('trees').value, subsample: +$('psi').value, seed: +$('seed').value });
  S.model = model;
  S.scores = scoreAll(model, S.norm.Z);
  S.th = threshold(S.scores, +$('cont').value / 100);
  const xs = pts.map(p => p[S.ax]), ys = pts.map(p => p[S.ay]);
  const pad = (a) => { const lo = Math.min(...a), hi = Math.max(...a), p = (hi - lo || 1) * 0.08; return [lo - p, hi + p]; };
  S.dom = { x: pad(xs), y: pad(ys) };
  draw(); report();
}

const toPx = (x, y) => [(x - S.dom.x[0]) / (S.dom.x[1] - S.dom.x[0]) * cv.width, cv.height - (y - S.dom.y[0]) / (S.dom.y[1] - S.dom.y[0]) * cv.height];
const fromPx = (px, py) => [S.dom.x[0] + px / cv.width * (S.dom.x[1] - S.dom.x[0]), S.dom.y[0] + (1 - py / cv.height) * (S.dom.y[1] - S.dom.y[0])];

function queryRow(x, y) { // full-dimensional row for heat map: other dims held at the data median (0.5 in scaled space)
  const d = S.X[0].length, r = [];
  for (let j = 0; j < d; j++) {
    if (j === S.ax) r.push(x); else if (j === S.ay) r.push(y);
    else r.push(S.norm.mins[j] + 0.5 * (S.norm.maxs[j] - S.norm.mins[j]));
  }
  return r;
}
function scale(row) { return row.map((v, j) => S.norm.maxs[j] > S.norm.mins[j] ? (v - S.norm.mins[j]) / (S.norm.maxs[j] - S.norm.mins[j]) : 0.5); }

function draw() {
  const W = cv.width, H = cv.height, cw = W / GRID, ch = H / GRID;
  for (let i = 0; i < GRID; i++) for (let j = 0; j < GRID; j++) {
    const [x, y] = fromPx((i + .5) * cw, (j + .5) * ch);
    ctx.fillStyle = heat(score(S.model, scale(queryRow(x, y))));
    ctx.fillRect(i * cw, j * ch, cw + 1, ch + 1);
  }
  const n = S.X.length;
  allPoints().forEach((p, i) => {
    const [px, py] = toPx(p[S.ax], p[S.ay]);
    const flag = S.scores[i] >= S.th;
    ctx.beginPath(); ctx.arc(px, py, flag ? 5 : 3.5, 0, 6.2832);
    ctx.fillStyle = flag ? '#ff5d5d' : '#58a6ff'; ctx.fill();
    ctx.strokeStyle = i >= n ? '#fff' : 'rgba(0,0,0,.5)'; ctx.lineWidth = i >= n ? 2 : 1; ctx.stroke();
    if (S.labels && i < n && S.labels[i]) { ctx.beginPath(); ctx.arc(px, py, 9, 0, 6.2832); ctx.strokeStyle = '#e3b341'; ctx.lineWidth = 2; ctx.stroke(); }
  });
}

function report() {
  const pts = allPoints(), n = S.X.length;
  const flags = S.scores.map(s => s >= S.th);
  const stats = $('stats'); stats.replaceChildren();
  const add = (v, k) => { const d = el('div', '', 'stat'); d.append(el('b', v), el('span', k)); stats.append(d); };
  add(String(pts.length), 'points'); add(String(flags.filter(Boolean).length), 'flagged');
  add(S.th === Infinity ? '—' : S.th.toFixed(3), 'score cut-off');
  if (S.labels) {
    const ev = evaluate(flags.slice(0, n), S.labels);
    add(auc(S.scores.slice(0, n), S.labels).toFixed(3), 'ROC AUC');
    add((ev.precision * 100).toFixed(0) + '%', 'precision'); add((ev.recall * 100).toFixed(0) + '%', 'recall');
  }
  $('note').textContent = S.labels
    ? 'Gold rings mark the injected anomalies. The forest never sees these labels; they only grade the result.'
    : 'Unlabelled data: the cut-off is simply the top percentile of scores.';
  const head = $('thead'); head.replaceChildren(el('th', '#'), el('th', 'score'));
  S.header.forEach(h => head.append(el('th', h)));
  const body = $('tbody'); body.replaceChildren();
  pts.map((p, i) => i).sort((a, b) => S.scores[b] - S.scores[a]).slice(0, 12).forEach(i => {
    const tr = el('tr'); tr.append(el('td', String(i + 1)), el('td', S.scores[i].toFixed(3)));
    pts[i].forEach(v => tr.append(el('td', fmt(v))));
    if (S.labels && i < n && S.labels[i]) tr.style.color = '#e3b341';
    body.append(tr);
  });
}

function loadDataset(name) {
  S.added = [];
  if (name === 'csv') { loadCsv(); return; }
  const d = makeDataset(name);
  S.X = d.X; S.labels = d.labels; S.ax = 0; S.ay = 1;
  S.header = name === 'logins' ? ['logins/hour', 'fail %'] : ['x', 'y'];
  fillAxes(); refit();
}
function fillAxes() {
  for (const [id, v] of [['ax', S.ax], ['ay', S.ay]]) {
    const sel = $(id); sel.replaceChildren();
    S.header.forEach((h, i) => { const o = el('option', h); o.value = i; sel.append(o); });
    sel.value = v;
  }
}
function loadCsv() {
  const p = parseCSV($('csv').value);
  if (p.rows.length < 4 || p.header.length < 2) { $('csvmsg').textContent = 'Need ≥4 rows and ≥2 numeric columns.'; $('csvmsg').className = 'd err'; return; }
  $('csvmsg').className = 'd'; $('csvmsg').textContent = `Loaded ${p.rows.length} rows × ${p.header.length} columns` + (p.skipped ? `, skipped ${p.skipped} malformed` : '') + '.';
  S.X = p.rows; S.labels = null; S.header = p.header; S.ax = 0; S.ay = 1; S.added = [];
  $('ds').value = 'csv'; fillAxes(); refit();
}

function setOut() { for (const k of ['trees', 'psi', 'cont', 'seed']) $('o-' + k).textContent = $(k).value + (k === 'cont' ? '%' : ''); }
for (const k of ['trees', 'psi', 'cont', 'seed']) $(k).addEventListener('input', () => { setOut(); if (S.X.length) refit(); });
$('ds').addEventListener('change', e => loadDataset(e.target.value));
$('refit').addEventListener('click', () => { $('seed').value = 1 + Math.floor(Math.random() * 99); setOut(); refit(); });
$('clear').addEventListener('click', () => { S.added = []; refit(); });
$('load').addEventListener('click', loadCsv);
for (const id of ['ax', 'ay']) $(id).addEventListener('change', () => { S.ax = +$('ax').value; S.ay = +$('ay').value; refit(); });
cv.addEventListener('click', e => {
  if (!S.dom) return;
  const r = cv.getBoundingClientRect(), [x, y] = fromPx((e.clientX - r.left) / r.width * cv.width, (e.clientY - r.top) / r.height * cv.height);
  const row = queryRow(x, y); S.added.push(row); refit();
  const i = allPoints().length - 1;
  $('note').textContent = `Added point (${fmt(x)}, ${fmt(y)}) → anomaly score ${S.scores[i].toFixed(3)} (${S.scores[i] >= S.th ? 'flagged' : 'not flagged'}).`;
});

const PRESETS = {
  logins: () => set({ ds: 'logins', trees: 100, psi: 256, cont: 4 }),
  clusters: () => set({ ds: 'clusters', trees: 150, psi: 256, cont: 3 }),
  ring: () => set({ ds: 'ring', trees: 150, psi: 256, cont: 3 }),
  few: () => set({ ds: 'blob', trees: 10, psi: 256, cont: 4 }),
  small: () => set({ ds: 'blob', trees: 100, psi: 8, cont: 4 }),
};
function set(o) { for (const k of ['trees', 'psi', 'cont']) $(k).value = o[k]; $('ds').value = o.ds; setOut(); loadDataset(o.ds); }
$('presets').addEventListener('click', e => { const b = e.target.closest('button[data-p]'); if (b) PRESETS[b.dataset.p](); });

setOut(); loadDataset('logins');
