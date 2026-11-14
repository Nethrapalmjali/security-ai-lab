import { analyze, EXAMPLE } from './hunter.js';

const $ = (id) => document.getElementById(id);
const out = $('out');
function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}
function table(headers, rows) {
  const w = el('div', 'tablewrap'), t = el('table');
  const hr = el('tr');
  for (const h of headers) hr.append(el('th', null, h));
  t.append(hr);
  for (const r of rows) {
    const tr = el('tr');
    r.forEach((c) => tr.append(el('td', null, String(c))));
    t.append(tr);
  }
  w.append(t);
  return w;
}

function render() {
  out.replaceChildren();
  const text = $('log').value;
  if (!text.trim()) { out.append(el('p', 'sub', 'Paste a log or load the example.')); return; }
  const r = analyze(text, {
    threshold: Math.max(2, +$('thr').value || 5),
    windowSec: Math.max(1, +$('win').value || 60),
  });
  const s = el('div', 'card');
  s.append(el('h2', null, 'Summary'));
  const st = el('div', 'stats');
  for (const [k, v] of [['Lines', r.total], ['Parsed', r.parsed], ['Unparsed', r.unparsed], ['Findings', r.findings.length], ['Brute-force sources', r.brute.length]]) {
    const d = el('div', 'stat'); d.append(el('b', null, v), el('span', 'sub2', k)); st.append(d);
  }
  s.append(st);
  const pills = el('div', 'pills');
  for (const [k, v] of Object.entries(r.counts)) pills.append(el('span', null, `${k}: ${v}`));
  s.append(pills);
  out.append(s);

  const c1 = el('div', 'card');
  c1.append(el('h2', null, 'Suspicious sources (by risk score)'));
  if (r.ips.length) c1.append(table(['IP', 'Score', 'Requests', 'Errors', 'Categories'], r.ips.map((i) => [i.ip, i.score, i.requests, i.errors, i.categories.join(', ')])));
  else c1.append(el('p', 'sub', 'No suspicious sources found.'));
  out.append(c1);

  if (r.brute.length) {
    const c2 = el('div', 'card');
    c2.append(el('h2', null, 'Brute-force bursts'));
    c2.append(table(['IP', 'Path', 'Failed attempts', 'Peak in window'], r.brute.map((b) => [b.ip, b.path, b.attempts, b.peak])));
    out.append(c2);
  }

  const c3 = el('div', 'card');
  c3.append(el('h2', null, 'Findings'));
  if (r.findings.length) {
    const ul = el('ul', 'f');
    for (const f of r.findings.slice(0, 200)) {
      const li = el('li', f.severity);
      li.append(el('span', 'sev', f.severity), el('strong', null, f.name), el('span', 'dir', `${f.ip} · HTTP ${f.status}`), el('code', 'd', f.path));
      ul.append(li);
    }
    c3.append(ul);
    if (r.findings.length > 200) c3.append(el('p', 'sub', `Showing first 200 of ${r.findings.length}.`));
  } else c3.append(el('p', 'sub', 'No attack signatures matched.'));
  out.append(c3);
}

$('go').onclick = render;
$('thr').onchange = $('win').onchange = render;
$('ex').onclick = () => { $('log').value = EXAMPLE; render(); };
$('clr').onclick = () => { $('log').value = ''; render(); };
render();
