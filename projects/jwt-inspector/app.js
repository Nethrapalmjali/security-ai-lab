import { analyze, signHs256, forgeUnsigned, verifyHmac } from './jwt.js';
const $ = id => document.getElementById(id);
const now = () => Math.floor(Date.now() / 1000);

const EXAMPLES = {
  weak: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
};
async function makeExamples() {
  const t = now();
  EXAMPLES.strong = await signHs256({ iss: 'auth.example', aud: 'api.example', jti: crypto.randomUUID(), sub: 'u42', iat: t, exp: t + 900 }, 'k9$Qz!vX2#mLp7@wRt4&Yb8^Nc5*Hd3e');
  EXAMPLES.none = await forgeUnsigned(EXAMPLES.weak);
  EXAMPLES.bad = await signHs256({ sub: 'admin', password: 'hunter2', exp: t - 86400 }, 'k9$Qz!vX2#mLp7@wRt4&Yb8^Nc5*Hd3e', { alg: 'HS256', kid: "../../dev/null' OR 1=1--", jku: 'https://attacker.invalid/keys.json' });
}

function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; }

function fmtClaims(pl) {
  const out = JSON.stringify(pl, null, 2);
  const extra = ['exp', 'iat', 'nbf'].filter(k => typeof pl[k] === 'number')
    .map(k => `${k}: ${new Date(pl[k] * 1000).toISOString()}`);
  return extra.length ? out + '\n\n// ' + extra.join('\n// ') : out;
}

async function run() {
  const out = $('out'); out.replaceChildren();
  const raw = $('token').value.trim();
  if (!raw) return;
  let r;
  try { r = await analyze(raw, now()); }
  catch (e) { out.append(el('p', 'err', e.message)); return; }
  const { parsed: p, findings, score } = r;

  const tok = el('div', 'card tok');
  const pre = el('pre');
  pre.append(el('span', 'h', raw.replace(/^Bearer\s+/i, '').split('.')[0]), '.',
    el('span', 'p', raw.replace(/^Bearer\s+/i, '').split('.')[1]), '.',
    el('span', 's', p.signature));
  tok.append(el('h2', '', 'Token'), pre);

  const grid = el('div', 'grid');
  const hc = el('div', 'card'); hc.append(el('h2', '', 'Header'), el('pre', '', JSON.stringify(p.header, null, 2)));
  const pc = el('div', 'card'); pc.append(el('h2', '', 'Payload'), el('pre', '', fmtClaims(p.payload)));
  grid.append(hc, pc);

  const fc = el('div', 'card');
  const sc = el('div', 'score', `${score}/100`);
  sc.setAttribute('aria-label', `Security score ${score} out of 100`);
  fc.append(el('h2', '', 'Findings'), sc);
  const ul = el('ul', 'f');
  for (const f of findings) {
    const li = el('li', f.severity);
    li.append(el('span', 'sev', f.severity), el('strong', '', f.title), el('span', 'd', f.detail));
    ul.append(li);
  }
  if (!findings.length) ul.append(el('li', '', 'No issues found.'));
  fc.append(ul);
  out.append(tok, grid, fc);
}

$('analyze').onclick = run;
$('token').addEventListener('input', run);
$('verify').onclick = async () => {
  const msg = $('vmsg'); msg.className = ''; msg.textContent = '';
  try {
    const { parseJwt } = await import('./jwt.js');
    const ok = await verifyHmac(parseJwt($('token').value), $('secret').value);
    msg.textContent = ok ? '✔ Signature valid for this secret' : '✘ Signature does not match (or non-HMAC / empty secret)';
    if (!ok) msg.className = 'err';
  } catch (e) { msg.className = 'err'; msg.textContent = e.message; }
};
document.querySelectorAll('[data-ex]').forEach(b => b.onclick = () => { $('token').value = EXAMPLES[b.dataset.ex]; run(); });
makeExamples().then(() => { $('token').value = EXAMPLES.weak; run(); });
