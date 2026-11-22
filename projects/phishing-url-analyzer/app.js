import { analyze } from './phish.js';
const $ = id => document.getElementById(id);
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

function render(r) {
  const out = $('out');
  out.replaceChildren();
  if (!r.ok) { out.append(el('p', 'err', r.error)); return; }
  const card = el('div', 'card');
  card.append(el('div', 'score', `${r.score}/100 — ${r.verdict}`));
  const meter = el('div', 'meter'); const bar = el('div');
  bar.style.width = r.score + '%';
  bar.style.background = r.score >= 60 ? 'var(--critical)' : r.score >= 30 ? 'var(--high)' : r.score >= 10 ? 'var(--medium)' : '#3fb950';
  meter.append(bar); card.append(meter);
  const dl = el('dl', 'meta');
  const m = r.meta;
  for (const [k, v] of [['Scheme', m.scheme], ['Host', m.host], ['Host (Unicode)', m.unicodeHost], ['Registrable domain', m.registrable], ['Port', m.port], ['Path', m.path]]) {
    if (!v) continue;
    dl.append(el('dt', '', k), el('dd', '', v));
  }
  card.append(dl);
  out.append(card);
  const c2 = el('div', 'card');
  c2.append(el('h2', '', `Findings (${r.findings.length})`));
  if (!r.findings.length) c2.append(el('p', '', 'No heuristics triggered. That does not prove the site is safe.'));
  const ul = el('ul', 'f');
  for (const f of r.findings) {
    const li = el('li', f.severity);
    li.append(el('span', 'sev', f.severity), document.createTextNode(f.title), el('span', 'd', f.detail));
    ul.append(li);
  }
  c2.append(ul); out.append(c2);
}
const run = () => render(analyze($('url').value));
$('analyze').addEventListener('click', run);
$('url').addEventListener('keydown', e => { if (e.key === 'Enter') run(); });
document.querySelectorAll('[data-ex]').forEach(b => b.addEventListener('click', () => { $('url').value = b.dataset.ex; run(); }));
