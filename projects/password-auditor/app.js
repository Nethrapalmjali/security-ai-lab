import { analyze, passphrase, randomPassword } from './pw.js';
const $ = (id) => document.getElementById(id);
const pw = $('pw');

function render() {
  const r = analyze(pw.value);
  [...$('meter').children].forEach((el, i) => { el.className = pw.value && i <= r.score ? 'on' + r.score : ''; });
  $('meter').setAttribute('aria-label', 'Strength: ' + r.label);
  $('label').textContent = pw.value ? r.label : 'Type a password';
  $('bits').textContent = pw.value ? `≈ ${r.bits.toFixed(1)} bits of real guessing effort` : '';
  $('naive').textContent = pw.value ? `A naive meter (length × log₂ charset) would claim ${r.naiveBits.toFixed(0)} bits — ${r.naiveBits - r.bits > 8 ? 'an overestimate of ' + (r.naiveBits - r.bits).toFixed(0) + ' bits because of predictable patterns.' : 'close to reality here.'}` : '';
  const segs = $('segs'); segs.replaceChildren();
  for (const s of r.path) {
    const d = document.createElement('span'); d.className = 'seg ' + s.kind;
    const t = document.createElement('span'); t.textContent = s.token;
    const m = document.createElement('small'); m.textContent = `${s.kind} · 2^${Math.log2(s.guesses).toFixed(1)}`;
    d.append(t, m); segs.append(d);
  }
  const tips = $('tips'); tips.replaceChildren();
  for (const t of r.tips) { const li = document.createElement('li'); li.textContent = t; tips.append(li); }
  const tb = $('times'); tb.replaceChildren();
  for (const s of r.times) {
    const tr = document.createElement('tr'), th = document.createElement('th'), td = document.createElement('td');
    th.textContent = s.label; td.textContent = pw.value ? s.text : '—'; tr.append(th, td); tb.append(tr);
  }
}
pw.addEventListener('input', render);
$('show').addEventListener('click', (e) => {
  const show = pw.type === 'password'; pw.type = show ? 'text' : 'password';
  e.target.textContent = show ? 'Hide' : 'Show'; e.target.setAttribute('aria-pressed', String(show));
});
document.querySelectorAll('[data-ex]').forEach(b => b.addEventListener('click', () => { pw.value = b.dataset.ex; render(); }));
function gen(g) { $('gen').textContent = `${g.text}\n(${g.bits.toFixed(0)} bits, uniformly random)`; $('audit-gen').hidden = false; $('audit-gen').onclick = () => { pw.value = g.text; render(); }; }
$('genpp').addEventListener('click', () => gen(passphrase(5)));
$('genpw').addEventListener('click', () => gen(randomPassword(16)));
render();
