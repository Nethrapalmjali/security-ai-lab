import { NaiveBayes, evaluate } from './nb.js';
import { SAMPLE } from './data.js';
const $ = id => document.getElementById(id);
let nb;
const el = (tag, text, cls) => { const e = document.createElement(tag); e.textContent = text; if (cls) e.className = cls; return e; };

function build() {
  nb = new NaiveBayes(Math.max(0.01, parseFloat($('alpha').value) || 1));
  for (const d of SAMPLE) nb.train(d.text, d.label);
  status(`Trained on ${nb.docs.spam} spam + ${nb.docs.ham} not-spam messages · vocabulary ${nb.vocab.size} words`);
  tops();
}
function status(t) { $('status').textContent = t; }
function tops() {
  for (const [id, lab] of [['topSpam', 'spam'], ['topHam', 'ham']]) {
    const ul = $(id); ul.replaceChildren();
    for (const w of nb.topWords(lab, 8)) ul.append(el('li', `${w.token}  (+${w.score.toFixed(2)})`));
  }
}
function classify() {
  const text = $('msg').value;
  const out = $('result'); out.replaceChildren();
  if (!text.trim()) { out.append(el('p', 'Enter a message first.', 'err')); return; }
  const r = nb.predict(text);
  out.append(el('div', `${r.label === 'spam' ? '⚠ SPAM' : '✓ NOT SPAM'} — ${(r.probs[r.label] * 100).toFixed(1)}% confidence`, 'verdict ' + r.label));
  const bar = el('div', '', 'bar'); bar.setAttribute('role', 'img'); bar.setAttribute('aria-label', `Spam probability ${(r.probs.spam * 100).toFixed(1)} percent`);
  const fill = document.createElement('span'); fill.style.width = (r.probs.spam * 100) + '%'; bar.append(fill); out.append(bar);
  out.append(el('p', 'Word evidence (log-likelihood ratio; positive pushes toward spam):', 'd'));
  const chips = el('div', '', 'chips');
  if (!r.contributions.length) chips.append(el('span', 'No known words — falling back to the class prior.', 'd'));
  for (const c of r.contributions.slice(0, 20)) chips.append(el('span', `${c.token} ${c.llr > 0 ? '+' : ''}${c.llr.toFixed(2)}`, 'chip ' + (c.llr > 0 ? 's' : 'h')));
  out.append(chips);
}
function teach(label) {
  const t = $('msg').value.trim();
  if (!t) { status('Enter a message first.'); return; }
  nb.train(t, label); tops();
  status(`Learned 1 new ${label} message (${nb.docs.spam} spam / ${nb.docs.ham} ham). Classify again to see the change.`);
}
function runEval() {
  const r = evaluate(SAMPLE, 0.3, parseInt($('seed').value) || 1, Math.max(0.01, parseFloat($('alpha').value) || 1));
  const o = $('evalOut'); o.replaceChildren();
  o.append(el('p', `Trained on ${r.nTrain}, tested on ${r.nTest} unseen messages. Accuracy ${(r.accuracy * 100).toFixed(0)}% · precision ${(r.precision * 100).toFixed(0)}% · recall ${(r.recall * 100).toFixed(0)}% · F1 ${r.f1.toFixed(2)}`));
  const t = document.createElement('table');
  const rows = [['', 'Predicted spam', 'Predicted ham'], ['Actual spam', r.tp, r.fn], ['Actual ham', r.fp, r.tn]];
  for (const row of rows) { const tr = document.createElement('tr'); row.forEach((c, i) => tr.append(el(i && row !== rows[0] ? 'td' : 'th', String(c)))); t.append(tr); }
  o.append(t);
}
$('go').onclick = classify;
$('addSpam').onclick = () => teach('spam');
$('addHam').onclick = () => teach('ham');
$('reset').onclick = build;
$('eval').onclick = runEval;
$('alpha').onchange = build;
document.querySelectorAll('[data-ex]').forEach(b => b.onclick = () => { $('msg').value = b.dataset.ex; classify(); });
build();
