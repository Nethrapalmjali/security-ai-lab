import * as T from './tree.js';

const EX = {
  phish: `has_link,urgent_words,sender_known,attachment,label
1,5,0,exe,phish
1,4,0,none,phish
0,1,1,none,safe
1,0,1,pdf,safe
1,6,0,zip,phish
0,0,1,none,safe
1,3,0,none,phish
0,2,1,pdf,safe
1,5,0,none,phish
0,0,0,none,safe
1,1,1,none,safe
1,7,0,exe,phish
0,3,0,zip,phish
0,0,1,pdf,safe
1,0,0,none,safe
1,2,1,none,safe
1,4,1,none,phish
0,1,0,none,safe
1,5,1,exe,phish
0,0,1,none,safe`,
  iris: `sepal_len,sepal_wid,petal_len,petal_wid,species
5.1,3.5,1.4,0.2,setosa
4.9,3.0,1.4,0.2,setosa
4.7,3.2,1.3,0.2,setosa
5.0,3.6,1.4,0.2,setosa
5.4,3.9,1.7,0.4,setosa
4.6,3.4,1.4,0.3,setosa
7.0,3.2,4.7,1.4,versicolor
6.4,3.2,4.5,1.5,versicolor
6.9,3.1,4.9,1.5,versicolor
5.5,2.3,4.0,1.3,versicolor
6.5,2.8,4.6,1.5,versicolor
5.7,2.8,4.5,1.3,versicolor
6.3,3.3,6.0,2.5,virginica
5.8,2.7,5.1,1.9,virginica
7.1,3.0,5.9,2.1,virginica
6.3,2.9,5.6,1.8,virginica
6.5,3.0,5.8,2.2,virginica
7.6,3.0,6.6,2.1,virginica
4.9,2.5,4.5,1.7,virginica
6.0,2.7,5.1,1.6,versicolor
5.9,3.0,5.1,1.8,virginica
5.6,2.9,3.6,1.3,versicolor`,
  login: `hour,country,failed_attempts,new_device,verdict
3,RU,6,yes,block
14,US,0,no,allow
9,US,1,no,allow
2,CN,8,yes,block
23,US,0,yes,review
11,US,0,no,allow
4,RU,3,yes,block
16,DE,0,no,allow
1,US,5,yes,block
10,DE,1,no,allow
22,CN,0,yes,review
13,US,0,no,allow
3,US,0,yes,review
8,US,2,no,allow
5,CN,7,yes,block
15,DE,0,yes,review
12,US,0,no,allow
2,RU,9,no,block
19,US,1,no,allow
21,DE,0,yes,review`
};

const $ = id => document.getElementById(id);
const NS = 'http://www.w3.org/2000/svg';
const PAL = ['#3fb950', '#f85149', '#58a6ff', '#d29922', '#bc8cff', '#39c5cf', '#ff7b72', '#a5d6ff'];
let model = null;

function el(tag, attrs = {}, text) {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (text !== undefined) e.textContent = text;
  return e;
}
function div(cls, text) { const d = document.createElement('div'); if (cls) d.className = cls; if (text !== undefined) d.textContent = text; return d; }

function loadHeaders() {
  try {
    const { headers } = T.parseCSV($('csv').value);
    const cur = $('target').value;
    $('target').replaceChildren(...headers.map((h, i) => { const o = document.createElement('option'); o.value = i; o.textContent = h; return o; }));
    $('target').value = cur !== '' && +cur < headers.length ? cur : headers.length - 1;
    $('err').textContent = '';
  } catch (e) { $('err').textContent = e.message; }
}

function train() {
  $('err').textContent = '';
  try {
    const { headers, rows } = T.parseCSV($('csv').value);
    const target = +$('target').value;
    const d = T.prepare(headers, rows, target);
    if (d.names.length < 1) throw new Error('Need at least one feature column besides the target');
    if (new Set(d.y).size > 12) throw new Error('Target has more than 12 distinct values; pick a class-like column');
    const sp = T.split(d.X, d.y, +$('test').value / 100, 42);
    const opts = { maxDepth: +$('depth').value, minLeaf: +$('leaf').value, criterion: $('crit').value };
    const tree = T.buildTree(sp.Xtr, sp.ytr, d.types, opts);
    model = { tree, d, headers, rows, classes: [...new Set(d.y)].sort() };
    render(sp);
  } catch (e) { $('err').textContent = e.message; $('out').hidden = true; }
}

function stat(v, l) { const s = div('stat'); const b = document.createElement('b'); b.textContent = v; const sp = document.createElement('span'); sp.textContent = l; s.append(b, sp); return s; }

function render(sp) {
  const { tree, d } = model;
  $('out').hidden = false;
  const pct = x => Number.isNaN(x) ? 'n/a' : (x * 100).toFixed(1) + '%';
  $('stats').replaceChildren(
    stat(pct(T.accuracy(tree, sp.Xtr, sp.ytr)), `train accuracy (${sp.Xtr.length} rows)`),
    stat(pct(T.accuracy(tree, sp.Xte, sp.yte)), `test accuracy (${sp.Xte.length} rows)`),
    stat(T.depth(tree), 'depth'), stat(T.leaves(tree), 'leaves'));
  drawTree(tree, d);
  $('rules').textContent = T.toRules(tree, d.names).join('\n');
  const imp = T.importance(tree, d.names);
  $('imp').replaceChildren(...imp.map(i => {
    const r = div('bar'), n = div('n', i.name), f = div('f'), v = div('v', (i.value * 100).toFixed(1) + '%');
    f.style.width = Math.max(2, i.value * 60) + '%'; r.append(n, f, v); return r;
  }));
  const form = $('form'); form.replaceChildren();
  d.names.forEach((nm, i) => {
    const w = document.createElement('div'), l = document.createElement('label'), inp = document.createElement('input');
    l.textContent = nm; l.htmlFor = 'f' + i; inp.id = 'f' + i;
    if (d.types[i] === 'num') { inp.type = 'number'; inp.step = 'any'; inp.value = d.X[0][i]; }
    else { inp.type = 'text'; inp.setAttribute('list', 'dl' + i); inp.value = d.X[0][i];
      const dl = document.createElement('datalist'); dl.id = 'dl' + i;
      [...new Set(d.X.map(r => r[i]))].forEach(v => { const o = document.createElement('option'); o.value = v; dl.append(o); }); w.append(dl); }
    w.append(l, inp); form.append(w);
  });
  $('predout').textContent = '';
}

function drawTree(tree, d) {
  const classes = [...new Set(d.y)].sort(), col = c => PAL[classes.indexOf(c) % PAL.length];
  const W = 150, H = 64, GX = 14, GY = 40;
  let leafX = 0;
  (function lay(n, dep) { n.dep = dep; if (n.left) { lay(n.left, dep + 1); lay(n.right, dep + 1); n.x = (n.left.x + n.right.x) / 2; } else n.x = leafX++ * (W + GX); })(tree, 0);
  const maxDep = T.depth(tree), width = Math.max(1, leafX) * (W + GX), height = (maxDep + 1) * (H + GY);
  const svg = el('svg', { width, height, viewBox: `0 0 ${width} ${height}`, role: 'img' });
  svg.append(el('title', {}, 'Decision tree'));
  (function draw(n) {
    const x = n.x, y = n.dep * (H + GY);
    if (n.left) for (const [c, lab] of [[n.left, 'yes'], [n.right, 'no']]) {
      svg.append(el('line', { x1: x + W / 2, y1: y + H, x2: c.x + W / 2, y2: c.dep * (H + GY), stroke: '#6e7681' }));
      svg.append(el('text', { x: (x + c.x) / 2 + W / 2 + (lab === 'yes' ? -14 : 14), y: y + H + GY / 2 + 4, fill: '#8b949e', 'font-size': 11, 'text-anchor': 'middle' }, lab));
    }
    const leaf = !n.left;
    svg.append(el('rect', { x, y, width: W, height: H, rx: 6, fill: '#161b22', stroke: leaf ? col(n.label) : '#58a6ff', 'stroke-width': leaf ? 2.5 : 1.2 }));
    const head = leaf ? `→ ${n.label}` : T.condition(n, d.names);
    const cut = s => s.length > 22 ? s.slice(0, 21) + '…' : s;
    svg.append(el('text', { x: x + W / 2, y: y + 20, fill: leaf ? col(n.label) : '#e6edf3', 'font-size': 12, 'font-weight': 700, 'text-anchor': 'middle' }, cut(head)));
    svg.append(el('text', { x: x + W / 2, y: y + 38, fill: '#8b949e', 'font-size': 11, 'text-anchor': 'middle' }, cut(Object.entries(n.counts).map(([k, v]) => `${k}:${v}`).join(' '))));
    svg.append(el('text', { x: x + W / 2, y: y + 54, fill: '#8b949e', 'font-size': 11, 'text-anchor': 'middle' }, `n=${n.n}  imp=${n.impurity.toFixed(2)}`));
    if (n.left) { draw(n.left); draw(n.right); }
  })(tree);
  $('tree').replaceChildren(svg);
}

function predictWhatIf() {
  const { tree, d } = model;
  const x = d.names.map((_, i) => d.types[i] === 'num' ? Number($('f' + i).value) : $('f' + i).value.trim());
  if (x.some((v, i) => d.types[i] === 'num' && Number.isNaN(v))) { $('predout').textContent = 'Enter valid numbers.'; return; }
  const r = T.predictPath(tree, x, d.names);
  $('predout').textContent = `Prediction: ${r.label}. Path: ${r.path.length ? r.path.join('; ') : '(single leaf)'}`;
}

$('go').onclick = train;
$('pred').onclick = predictWhatIf;
$('csv').addEventListener('input', loadHeaders);
for (const [s, o] of [['depth', 'dv'], ['leaf', 'lv'], ['test', 'tv']]) $(s).oninput = () => { $(o).textContent = $(s).value; };
document.querySelectorAll('[data-ex]').forEach(b => b.onclick = () => { $('csv').value = EX[b.dataset.ex]; $('target').value = ''; loadHeaders(); train(); });
$('file').onchange = async e => { const f = e.target.files[0]; if (f) { $('csv').value = await f.text(); $('target').value = ''; loadHeaders(); train(); } };
$('csv').value = EX.phish; loadHeaders(); train();
