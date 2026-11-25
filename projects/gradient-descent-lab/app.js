import { SURFACES, OPTIMIZERS, createOptimizer, nearestMinimum } from './opt.js';
const $ = id => document.getElementById(id);
const cv = $('cv'), ctx = cv.getContext('2d'), W = cv.width, H = cv.height;
let surfKey = 'bowl', start = [...SURFACES.bowl.start], racers = [], playing = false, bg = null;
const enabled = {}, rates = {};

for (const k in SURFACES) { const o = document.createElement('option'); o.value = k; o.textContent = SURFACES[k].name; $('surf').append(o); }
for (const k in OPTIMIZERS) {
  enabled[k] = true;
  const row = document.createElement('div'); row.className = 'opt';
  const lab = document.createElement('label'); const cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = true; cb.id = 'on-' + k;
  const dot = document.createElement('span'); dot.className = 'dot'; dot.style.background = OPTIMIZERS[k].color;
  const nm = document.createElement('span'); nm.textContent = OPTIMIZERS[k].name; lab.append(cb, dot, nm); lab.htmlFor = cb.id;
  const d = document.createElement('span'); d.className = 'd'; d.textContent = OPTIMIZERS[k].desc;
  const inp = document.createElement('input'); inp.type = 'number'; inp.step = 'any'; inp.min = '0'; inp.id = 'lr-' + k; inp.setAttribute('aria-label', OPTIMIZERS[k].name + ' learning rate');
  cb.onchange = () => { enabled[k] = cb.checked; reset(); };
  inp.onchange = () => { const v = parseFloat(inp.value); if (v > 0 && isFinite(v)) rates[k] = v; else inp.value = rates[k]; reset(); };
  row.append(lab, d, inp); $('opts').append(row);
}
// layout: name | desc | lr  -> put desc under via wrap on narrow; simple approach
const toX = x => (x - S().domain[0]) / (S().domain[1] - S().domain[0]) * W;
const toY = y => H - (y - S().domain[2]) / (S().domain[3] - S().domain[2]) * H;
const S = () => SURFACES[surfKey];

function loadDefaults() { for (const k in OPTIMIZERS) { rates[k] = S().lr[k]; $('lr-' + k).value = rates[k]; } }

function drawBackground() {
  const s = S(), N = 140, img = ctx.createImageData(N, N), vals = new Float64Array(N * N);
  let lo = Infinity, hi = -Infinity;
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const x = s.domain[0] + (i + .5) / N * (s.domain[1] - s.domain[0]), y = s.domain[3] - (j + .5) / N * (s.domain[3] - s.domain[2]);
    const v = Math.log1p(Math.max(0, s.f(x, y))); vals[j * N + i] = v; if (v < lo) lo = v; if (v > hi) hi = v;
  }
  for (let p = 0; p < N * N; p++) {
    const t = (vals[p] - lo) / (hi - lo || 1), band = Math.abs(((t * 14) % 1) - .5) < .04 ? 18 : 0;
    img.data[p * 4] = 14 + 60 * t + band; img.data[p * 4 + 1] = 20 + 70 * t ** .8 + band; img.data[p * 4 + 2] = 40 + 150 * t ** .7 + band; img.data[p * 4 + 3] = 255;
  }
  const off = document.createElement('canvas'); off.width = off.height = N; off.getContext('2d').putImageData(img, 0, 0);
  bg = off;
}

function draw() {
  ctx.imageSmoothingEnabled = true; ctx.drawImage(bg, 0, 0, W, H);
  ctx.lineWidth = 2; ctx.strokeStyle = '#fff';
  for (const m of S().minima) { ctx.beginPath(); ctx.arc(toX(m[0]), toY(m[1]), 7, 0, 7); ctx.stroke(); }
  ctx.lineWidth = 1.5; ctx.beginPath(); const sx = toX(start[0]), sy = toY(start[1]);
  ctx.moveTo(sx - 5, sy - 5); ctx.lineTo(sx + 5, sy + 5); ctx.moveTo(sx + 5, sy - 5); ctx.lineTo(sx - 5, sy + 5); ctx.stroke();
  for (const r of racers) {
    ctx.strokeStyle = OPTIMIZERS[r.kind].color; ctx.lineWidth = 1.8; ctx.beginPath();
    r.path.forEach((p, i) => i ? ctx.lineTo(toX(p[0]), toY(p[1])) : ctx.moveTo(toX(p[0]), toY(p[1]))); ctx.stroke();
    if (!r.diverged) { ctx.fillStyle = OPTIMIZERS[r.kind].color; ctx.beginPath(); ctx.arc(toX(r.x), toY(r.y), 5, 0, 7); ctx.fill(); ctx.strokeStyle = '#000'; ctx.lineWidth = 1; ctx.stroke(); }
  }
}

function table() {
  const body = $('res'); body.replaceChildren();
  for (const r of racers) {
    const tr = body.insertRow(), s = S();
    const loss = s.f(r.x, r.y), { dist } = nearestMinimum(s, r.x, r.y);
    const status = r.diverged ? 'diverged' : dist < 0.01 ? 'converged' : r.steps ? 'running…' : 'ready';
    const c0 = tr.insertCell(); c0.textContent = OPTIMIZERS[r.kind].name; c0.style.color = OPTIMIZERS[r.kind].color;
    tr.insertCell().textContent = r.steps;
    tr.insertCell().textContent = r.diverged ? '∞' : loss.toExponential(2);
    tr.insertCell().textContent = r.diverged ? '—' : dist.toFixed(4);
    tr.insertCell().textContent = status;
  }
}

function reset() {
  racers = Object.keys(OPTIMIZERS).filter(k => enabled[k]).map(k => createOptimizer(k, S(), start, rates[k], { beta: +$('beta').value, clipNorm: $('clip').checked ? 5 : 0 }));
  draw(); table();
}
function stepAll(n) { for (let i = 0; i < n; i++) for (const r of racers) r.step(); draw(); table(); }
function setPlaying(p) { playing = p; $('play').textContent = p ? 'Pause' : 'Run'; $('play').setAttribute('aria-pressed', p); if (p) loop(); }
function loop() { if (!playing) return; stepAll(+$('speed').value); if (racers.every(r => r.diverged || r.steps > 20000)) return setPlaying(false); requestAnimationFrame(loop); }

function setSurface(k, keepStart) {
  surfKey = k; $('surf').value = k; if (!keepStart) start = [...S().start];
  $('note').textContent = S().note; drawBackground(); loadDefaults(); reset();
}

$('surf').onchange = e => { setPlaying(false); setSurface(e.target.value); };
$('play').onclick = () => setPlaying(!playing);
$('step').onclick = () => { setPlaying(false); stepAll(1); };
$('reset').onclick = () => { setPlaying(false); reset(); };
$('defaults').onclick = () => { setPlaying(false); loadDefaults(); reset(); };
$('beta').oninput = e => { $('bv').textContent = e.target.value; reset(); };
$('speed').oninput = e => { $('sv').textContent = e.target.value; };
$('clip').onchange = reset;
cv.addEventListener('click', e => {
  const r = cv.getBoundingClientRect(), s = S();
  const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
  start = [s.domain[0] + px * (s.domain[1] - s.domain[0]), s.domain[3] - py * (s.domain[3] - s.domain[2])];
  setPlaying(false); reset();
});
$('presets').addEventListener('click', e => {
  const p = e.target.dataset && e.target.dataset.p; if (!p) return; setPlaying(false);
  if (p === 'explode') { setSurface('bowl'); for (const k of ['sgd', 'momentum', 'nesterov']) { rates[k] = 0.12; $('lr-' + k).value = 0.12; } reset(); }
  else setSurface(p);
  setPlaying(true);
});
setSurface('bowl');
