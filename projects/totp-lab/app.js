import * as T from './totp.js';
const $ = (id) => document.getElementById(id);
const opts = () => ({ algorithm: $('algo').value, digits: +$('digits').value, period: Math.max(1, +$('period').value || 30) });
const now = () => { const v = $('time').value.trim(); return /^\d+$/.test(v) ? Number(v) : Date.now() / 1000; };

async function render() {
  $('err').textContent = '';
  const o = opts(), t = now();
  let key;
  try { key = T.base32Decode($('secret').value); if (!key.length) throw new Error('Enter a secret'); }
  catch (e) { $('code').textContent = '------'; $('err').textContent = e.message; $('audit').textContent = ''; return; }
  const code = await T.totp(key, t, o);
  $('code').textContent = code;
  const rem = T.secondsRemaining(t, o.period);
  $('fill').style.width = (rem / o.period * 100) + '%';
  $('remain').textContent = `Changes in ${rem}s · counter ${T.counterAt(t, o.period)}`;
  $('math').textContent = `T = floor(${Math.floor(t)} / ${o.period}) = ${T.counterAt(t, o.period)}\nkey = ${key.length} bytes\nmac = HMAC-${o.algorithm}(key, 8-byte big-endian T)\ncode = (31-bit dynamic truncation of mac) mod 10^${o.digits} = ${code}`;
  const ul = $('audit'); ul.textContent = '';
  for (const f of T.auditConfig({ secret: $('secret').value, ...o, window: +$('win').value })) {
    const li = document.createElement('li'), tag = document.createElement('span');
    tag.className = 'tag ' + f.level; tag.textContent = f.level;
    li.append(tag, document.createTextNode(f.text)); ul.append(li);
  }
  $('uri').value = T.buildOtpauthUri({ secret: $('secret').value, issuer: $('issuer').value, account: $('account').value, ...o });
}

$('verify').onclick = async () => {
  const m = $('vmsg'); m.className = '';
  try {
    const d = await T.verifyTotp(T.base32Decode($('secret').value), $('entered').value, now(), { window: +$('win').value, ...opts() });
    m.className = d === null ? 'bad' : 'good';
    m.textContent = d === null ? '✗ Code rejected.' : `✓ Valid (clock drift ${d === 0 ? 'none' : (d > 0 ? '+' : '') + d + ' step(s)'}).`;
  } catch (e) { m.className = 'bad'; m.textContent = e.message; }
};
$('rand').onclick = () => { $('secret').value = T.randomSecret(20); $('algo').value = 'SHA1'; render(); };
$('demo').onclick = () => { $('secret').value = 'JBSWY3DPEHPK3PXP'; render(); };
$('rfc').onclick = () => { $('secret').value = T.base32Encode(new TextEncoder().encode('12345678901234567890')); $('digits').value = '8'; $('algo').value = 'SHA1'; $('time').value = '59'; render(); };
$('import').onclick = () => {
  try {
    const p = T.parseOtpauthUri($('uri').value);
    $('secret').value = p.secret; $('algo').value = p.algorithm; $('digits').value = String(p.digits);
    $('period').value = p.period; $('issuer').value = p.issuer; $('account').value = p.account;
    render();
  } catch (e) { $('err').textContent = e.message; }
};
for (const id of ['secret', 'algo', 'digits', 'period', 'time', 'win', 'issuer', 'account']) $(id).addEventListener('input', render);
render(); setInterval(render, 1000);
