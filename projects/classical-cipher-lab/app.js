import * as c from './cipher.js';
const $ = (id) => document.getElementById(id);
const SAMPLE = 'It was the best of times, it was the worst of times, it was the age of wisdom, it was the age of foolishness, it was the epoch of belief, it was the epoch of incredulity, it was the season of Light, it was the season of Darkness, it was the spring of hope, it was the winter of despair. We had everything before us, we had nothing before us.';
const EXAMPLES = ['Meet me at the old bridge after midnight and bring the documents with you, because the guards change shift at dawn.',
  'Security through obscurity is not security at all, and a secret algorithm is a weakness rather than a strength for any cipher.'];

function el(tag, text, cls) { const e = document.createElement(tag); if (text !== undefined) e.textContent = text; if (cls) e.className = cls; return e; }
function table(headers, rows) {
  const t = el('table'); const h = el('tr');
  headers.forEach((x) => h.append(el('th', x))); t.append(h);
  rows.forEach((r) => { const tr = el('tr'); r.forEach((x) => tr.append(el('td', String(x)))); t.append(tr); });
  return t;
}
function freqChart(text, title) {
  const wrap = el('div'); wrap.append(el('strong', title));
  const L = c.lettersOnly(text), cnt = c.counts(L), n = L.length || 1;
  const pct = cnt.map((x) => (x / n) * 100), max = Math.max(...pct, ...c.EN_FREQ);
  const ch = el('div', undefined, 'chart'); ch.setAttribute('role', 'img');
  ch.setAttribute('aria-label', title + ' letter frequency bar chart');
  pct.forEach((p) => { const b = el('div'); b.style.height = (p / max) * 100 + '%'; ch.append(b); });
  const ax = el('div', undefined, 'axis');
  for (let i = 0; i < 26; i++) ax.append(el('span', String.fromCharCode(65 + i)));
  wrap.append(ch, ax); return wrap;
}
function engChart() {
  const wrap = el('div'); wrap.append(el('strong', 'Typical English'));
  const max = Math.max(...c.EN_FREQ), ch = el('div', undefined, 'chart'); ch.setAttribute('aria-hidden', 'true');
  c.EN_FREQ.forEach((p) => { const b = el('div', undefined, 'ref'); b.style.height = (p / max) * 100 + '%'; ch.append(b); });
  const ax = el('div', undefined, 'axis'); for (let i = 0; i < 26; i++) ax.append(el('span', String.fromCharCode(65 + i)));
  wrap.append(ch, ax); return wrap;
}
function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

// tabs
document.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => {
  document.querySelectorAll('[data-tab]').forEach((x) => { const on = x === b; x.setAttribute('aria-selected', on); });
  ['caesar', 'vig', 'xor'].forEach((t) => { $('p-' + t).hidden = t !== b.dataset.tab; });
}));

// Caesar
const cShift = () => parseInt($('c-shift').value, 10) || 0;
$('c-enc').onclick = () => { $('c-out').textContent = c.caesar($('c-in').value, cShift()); clear($('c-cands')); };
$('c-dec').onclick = () => { $('c-out').textContent = c.caesar($('c-in').value, -cShift()); clear($('c-cands')); };
$('c-ex').onclick = () => { const e = EXAMPLES[Math.floor(Math.random() * EXAMPLES.length)]; $('c-in').value = c.caesar(e, 1 + Math.floor(Math.random() * 25)); $('c-out').textContent = ''; clear($('c-cands')); };
$('c-break').onclick = () => {
  const r = c.breakCaesar($('c-in').value);
  $('c-out').textContent = `Best guess: shift ${r[0].shift}\n\n${r[0].plain}`;
  const box = $('c-cands'); clear(box);
  box.append(el('h3', 'Top 5 candidates (lower χ² = more English)'), table(['Shift', 'χ²', 'Preview'], r.slice(0, 5).map((x) => [x.shift, x.score.toFixed(1), x.plain.slice(0, 50)])));
};

// Vigenere
$('v-in').value = SAMPLE;
const vErr = (m) => { $('v-err').textContent = m || ''; };
$('v-ex').onclick = () => { $('v-in').value = SAMPLE; vErr(); };
function vRun(dec) { try { vErr(); $('v-out').textContent = c.vigenere($('v-in').value, $('v-key').value, dec); clear($('v-report')); } catch (e) { vErr(e.message); } }
$('v-enc').onclick = () => vRun(false);
$('v-dec').onclick = () => vRun(true);
$('v-break').onclick = () => {
  vErr(); const text = $('v-in').value, n = c.lettersOnly(text).length;
  if (n < 20) { vErr('Need at least 20 letters of ciphertext.'); return; }
  const forced = parseInt($('v-len').value, 10) || undefined;
  const r = c.breakVigenere(text, Math.min(30, Math.floor(n / 2)), forced);
  $('v-out').textContent = `Recovered key: ${r.key} (length ${r.len})\n\n${r.plain}`;
  const rep = $('v-report'); clear(rep);
  const sc = c.keyLengthScores(text, Math.min(20, Math.floor(n / 2)));
  rep.append(el('h3', 'Average column index of coincidence by key length (English ≈ 0.067)'),
    table(['Length', 'Avg IC'], sc.map((x) => [x.len, x.ic.toFixed(4) + (x.len === r.len ? '  ◀ chosen' : '')])));
  const k = c.kasiski(text, 20).slice(0, 5);
  rep.append(el('h3', 'Kasiski: factors of repeated-trigram distances'), table(['Factor', 'Hits'], k.map((x) => [x.len, x.count])));
  const bars = el('div', undefined, 'bars'); bars.append(freqChart(text, 'Ciphertext (flat = polyalphabetic)'), engChart()); rep.append(bars);
};

// XOR
const xErr = (m) => { $('x-err').textContent = m || ''; };
const dec = new TextDecoder('utf-8', { fatal: false });
const show = (b) => dec.decode(b).replace(/[\u0000-\u0008\u000b-\u001f]/g, '·');
$('x-ex').onclick = () => { xErr(); $('x-in').value = c.bytesToHex(c.xorBytes(c.textToBytes(SAMPLE), c.textToBytes('ICE'))); $('x-out').textContent = ''; clear($('x-report')); };
$('x-enc').onclick = () => {
  xErr(); const key = c.textToBytes($('x-key').value);
  if (!key.length) { xErr('Key is empty.'); return; }
  const h = c.bytesToHex(c.xorBytes(c.textToBytes($('x-in').value), key)); $('x-out').textContent = h;
};
function getBytes() { try { xErr(); const b = c.hexToBytes($('x-in').value); if (b.length < 8) { xErr('Need at least 8 bytes of hex.'); return null; } return b; } catch (e) { xErr(e.message); return null; } }
$('x-break1').onclick = () => {
  const b = getBytes(); if (!b) return;
  const r = c.breakSingleByteXor(b);
  $('x-out').textContent = `Best key byte: 0x${r[0].key.toString(16).padStart(2, '0')}\n\n${show(r[0].plain)}`;
  const rep = $('x-report'); clear(rep);
  rep.append(el('h3', 'Top 5 candidates'), table(['Key', 'Score', 'Preview'], r.slice(0, 5).map((x) => ['0x' + x.key.toString(16).padStart(2, '0'), x.score.toFixed(1), show(x.plain.slice(0, 40))])));
};
$('x-breakn').onclick = () => {
  const b = getBytes(); if (!b) return;
  const r = c.breakRepeatingXor(b);
  const keyTxt = String.fromCharCode(...r.key.map((k) => (k >= 32 && k < 127 ? k : 63)));
  $('x-out').textContent = `Recovered key (${r.len} bytes): "${keyTxt}"  [${c.bytesToHex(r.key)}]\n\n${show(r.plain)}`;
  clear($('x-report'));
};
$('x-ex').click();
