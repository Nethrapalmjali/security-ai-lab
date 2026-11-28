import * as H from './hashlab.js';
const $ = (id) => document.getElementById(id);
let bytes = new TextEncoder().encode('abc'), digests = {}, rate = 0, sourceName = 'text';

function renderId() {
  const r = H.identify($('h').value);
  const ul = $('idout'); ul.textContent = '';
  $('idsum').textContent = r.kind === 'empty' ? 'Paste a hash above.' :
    r.kind === 'unknown' ? 'No known format matched.' :
    r.bits ? `${r.bits}-bit hex digest` : r.kind === 'base64' ? 'Base64-encoded digest' : 'Self-describing password hash format';
  for (const c of r.candidates) {
    const li = document.createElement('li');
    const tag = document.createElement('span'); tag.className = 'tag ' + c.level; tag.textContent = c.level;
    const b = document.createElement('strong'); b.textContent = c.name;
    const n = document.createElement('div'); n.className = 'muted'; n.textContent = c.note;
    li.append(tag, b, n); ul.append(li);
  }
  if (r.kind === 'hex' && r.candidates.length) {
    const li = document.createElement('li'); li.className = 'muted';
    li.textContent = 'Length alone cannot tell these apart; context (where you found it, salt, system) decides.';
    ul.append(li);
  }
}

async function renderDigests() {
  try {
    $('hasherr').textContent = '';
    digests = await H.digestAll(bytes);
    const tb = $('digests'); tb.textContent = '';
    for (const [a, v] of Object.entries(digests)) {
      const tr = document.createElement('tr'), th = document.createElement('th'), td = document.createElement('td');
      th.textContent = a; td.textContent = v; td.className = 'mono'; tr.append(th, td); tb.append(tr);
    }
    $('fmeta').textContent = `${sourceName}: ${bytes.length.toLocaleString('en')} bytes`;
    const e = H.entropy(bytes);
    $('ent').textContent = e.toFixed(3); $('entbar').style.width = (e / 8 * 100) + '%'; $('entv').textContent = H.entropyVerdict(e, bytes.length);
    renderVerdict();
  } catch (err) { $('hasherr').textContent = 'Hashing failed: ' + err.message + ' (Web Crypto needs HTTPS or localhost).'; }
}

function renderVerdict() {
  const v = $('exp').value.trim(), o = $('verdict');
  o.className = '';
  if (!v) { o.textContent = ''; return; }
  const hex = Object.entries(digests).find(([, d]) => H.hashesMatch(v, d));
  if (hex) { o.className = 'good'; o.textContent = `✔ Match: ${hex[0]}`; return; }
  const b64 = Object.keys(digests).find((a) => a !== 'MD5' && H.toBase64(Uint8Array.from(digests[a].match(/../g), (x) => parseInt(x, 16))) === v.replace(/\s+/g, ''));
  if (b64) { o.className = 'good'; o.textContent = `✔ Match: ${b64} (Base64)`; return; }
  o.className = 'bad'; o.textContent = '✘ No match against any computed digest — the data differs from what the vendor hashed.';
}

async function useFile(f) {
  if (f.size > 500 * 1024 * 1024) { $('hasherr').textContent = 'File too large for in-memory hashing (limit 500 MB).'; return; }
  bytes = new Uint8Array(await f.arrayBuffer()); sourceName = f.name; $('t').value = ''; renderDigests();
}

$('h').addEventListener('input', renderId);
document.querySelectorAll('[data-ex]').forEach((b) => b.addEventListener('click', () => { $('h').value = b.dataset.ex; renderId(); }));
$('t').addEventListener('input', () => { bytes = new TextEncoder().encode($('t').value); sourceName = 'text'; renderDigests(); });
$('exp').addEventListener('input', renderVerdict);
const drop = $('drop'), fi = $('file');
drop.addEventListener('click', () => fi.click());
drop.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fi.click(); } });
fi.addEventListener('change', () => fi.files[0] && useFile(fi.files[0]));
drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over'); });
drop.addEventListener('dragleave', () => drop.classList.remove('over'));
drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('over'); e.dataTransfer.files[0] && useFile(e.dataTransfer.files[0]); });

function renderBf() {
  const tb = $('bf'); tb.textContent = '';
  const rows = [['6 digits (PIN)', 10, 6], ['8 lowercase letters', 26, 8], ['8 mixed chars', 62, 8], ['10 mixed + symbols', 94, 10], ['14 mixed + symbols', 94, 14]];
  for (const [n, cs, len] of rows) {
    const tr = document.createElement('tr');
    for (const t of [n, cs + ' symbols', H.humanTime(H.bruteForceSeconds(cs, len, rate))]) { const td = document.createElement('td'); td.textContent = t; tr.append(td); }
    tb.append(tr);
  }
}
$('bench').addEventListener('click', async () => {
  $('benchout').textContent = 'Measuring…';
  const buf = new Uint8Array(16); let n = 0; const t0 = performance.now();
  while (performance.now() - t0 < 600) { await Promise.all(Array.from({ length: 200 }, () => crypto.subtle.digest('SHA-256', buf))); n += 200; }
  rate = n / ((performance.now() - t0) / 1000);
  const key = await crypto.subtle.importKey('raw', buf, 'PBKDF2', false, ['deriveBits']);
  const t1 = performance.now();
  await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: buf, iterations: 600000 }, key, 256);
  const pb = performance.now() - t1;
  $('benchout').textContent = `This browser does ~${Math.round(rate).toLocaleString('en')} SHA-256/s (one tab; a GPU does billions). A single PBKDF2-SHA256 hash at 600,000 iterations takes ${pb.toFixed(0)} ms, so every attacker guess costs ~600,000× more work.`;
  renderBf();
});

renderId(); renderDigests();
