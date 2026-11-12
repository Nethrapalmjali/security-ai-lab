import { evaluate, parseCsp, EXAMPLES } from './csp.js';

const $ = (id) => document.getElementById(id);
const out = $('out');

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

function render() {
  const text = $('csp').value;
  out.replaceChildren();
  if (!text.trim()) { out.append(el('p', 'sub', 'Paste a policy or click an example.')); return; }
  const r = evaluate(text);
  const card = el('div', 'card');
  const head = el('div', 'head');
  head.append(el('div', 'grade ' + (r.score >= 85 ? 'good' : r.score >= 55 ? 'mid' : 'bad'), r.grade));
  const meta = el('div');
  meta.append(el('div', null, `Score ${r.score}/100`));
  const pills = el('div', 'pills');
  for (const s of ['high', 'medium', 'low', 'info']) pills.append(el('span', null, `${r.counts[s]} ${s}`));
  meta.append(pills);
  head.append(meta);
  card.append(head);
  out.append(card);

  const fc = el('div', 'card');
  fc.append(el('h2', null, 'Findings'));
  const ul = el('ul', 'f');
  if (!r.findings.length) ul.append(el('li', 'info', 'No issues found.'));
  for (const x of r.findings) {
    const li = el('li', x.severity);
    const t = el('strong');
    t.append(el('span', 'sev', x.severity), document.createTextNode(x.title), el('span', 'dir', x.directive));
    li.append(t, el('span', 'd', x.detail));
    if (x.fix) li.append(el('span', 'fix', 'Fix: ' + x.fix));
    ul.append(li);
  }
  fc.append(ul);
  out.append(fc);

  const p = parseCsp(text);
  const pc = el('div', 'card');
  pc.append(el('h2', null, 'Parsed directives'));
  const tb = el('table');
  for (const d of p.order) {
    const tr = el('tr');
    tr.append(el('td', null, d), el('td', null, p.directives[d].join(' ') || '(no values)'));
    tb.append(tr);
  }
  pc.append(tb);
  out.append(pc);
}

$('go').addEventListener('click', render);
$('csp').addEventListener('input', render);
for (const b of document.querySelectorAll('[data-ex]')) {
  b.addEventListener('click', () => { $('csp').value = EXAMPLES[b.dataset.ex]; render(); });
}
