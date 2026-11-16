import { analyze } from './analyzer.js';
import { SAMPLES } from './samples.js';

const $ = id => document.getElementById(id);
function el(tag, props = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) k === 'class' ? (e.className = v) : e.setAttribute(k, v);
  for (const k of kids) e.append(k);
  return e;
}
const pill = (label, v) => el('span', { class: v === 'pass' ? 'pass' : v ? (['fail', 'softfail', 'permerror'].includes(v) ? 'fail' : 'none') : 'none' }, `${label}: ${v || 'n/a'}`);
const fmtDelay = s => s == null ? '—' : (s >= 0 ? '+' : '') + s + 's';

function render(r) {
  const out = $('out'); out.replaceChildren();
  if (r.score == null) { out.append(el('div', { class: 'card' }, r.findings[0].detail)); return; }
  const cls = r.score >= 75 ? 'good' : r.score >= 55 ? 'mid' : 'bad';
  const pills = el('div', { class: 'pills' }, pill('SPF', r.auth.spf), pill('DKIM', r.auth.dkim), pill('DMARC', r.auth.dmarc));
  out.append(el('div', { class: 'card head' }, el('div', { class: 'grade ' + cls, 'aria-label': 'Grade ' + r.grade }, r.grade),
    el('div', {}, el('strong', {}, `Trust score ${r.score}/100`), pills)));
  const order = { bad: 0, warn: 1, info: 2, good: 3 };
  const ul = el('ul', { class: 'f' });
  for (const f of [...r.findings].sort((a, b) => order[a.severity] - order[b.severity]))
    ul.append(el('li', { class: f.severity }, el('span', { class: 'sev' }, f.severity), el('strong', {}, f.title), el('span', { class: 'd' }, f.detail)));
  out.append(el('div', { class: 'card' }, el('h2', {}, 'Findings'), ul));
  const i = r.identities;
  const idRows = [['From', i.from], ['Return-Path', i.returnPath], ['Reply-To', i.replyTo], ['Message-ID', i.msgId]].filter(x => x[1]);
  const tb = el('table'); for (const [k, v] of idRows) tb.append(el('tr', {}, el('td', {}, k), el('td', {}, v)));
  out.append(el('div', { class: 'card' }, el('h2', {}, 'Identities'), tb));
  if (r.hops.length) {
    const t = el('table', { 'aria-label': 'Received chain' }, el('tr', {}, ...['#', 'From', 'By', 'IPs', 'Delay', 'TLS'].map(h => el('th', {}, h))));
    for (const h of r.hops) t.append(el('tr', {}, el('td', {}, String(h.index)), el('td', {}, h.from || '?'), el('td', {}, h.by || '?'), el('td', {}, h.ips.join(', ') || '—'), el('td', {}, fmtDelay(h.delay)), el('td', {}, h.tls ? 'yes' : 'no')));
    out.append(el('div', { class: 'card' }, el('h2', {}, 'Delivery path (origin → you)'), t));
  }
}
const run = () => render(analyze($('hdr').value));
$('go').addEventListener('click', run);
document.querySelectorAll('[data-ex]').forEach(b => b.addEventListener('click', () => { $('hdr').value = SAMPLES[b.dataset.ex]; run(); }));
