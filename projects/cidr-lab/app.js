import { describe, parseCidr, contains, split, rangeToCidrs, audit } from './cidr.js';
const $ = (id) => document.getElementById(id);
const SAMPLE = `# office + vendors
10.0.0.0/8
10.20.30.0/24
192.168.1.5/24
203.0.113.7
203.0.113.7/32
45.0.0.0/7
198.51.100.0/24
198.51.100.0/25
999.1.1.1`;

function row(tbl, k, v) {
  const tr = document.createElement('tr'), th = document.createElement('th'), td = document.createElement('td');
  th.textContent = k; td.textContent = v; tr.append(th, td); tbl.append(tr);
}
function calc() {
  const t = $('out'); t.replaceChildren(); $('err').textContent = '';
  $('splitout').replaceChildren(); $('splitmsg').textContent = '';
  let d;
  try { d = describe($('cidr').value); } catch (e) { $('err').textContent = e.message; $('chkmsg').textContent = ''; return; }
  row(t, 'Network (CIDR)', d.cidr + (d.canonical ? '' : '  (host bits were cleared)'));
  row(t, 'Netmask', d.netmask); row(t, 'Wildcard', d.wildcard);
  row(t, 'Broadcast', d.broadcast ?? 'n/a (/31 and /32)');
  row(t, 'Host range', d.firstHost + ' – ' + d.lastHost);
  row(t, 'Total / usable', d.total.toLocaleString('en-US') + ' / ' + d.usable.toLocaleString('en-US'));
  row(t, 'Range type', d.range.label + ' [' + d.range.kind + ']');
  row(t, 'IP (binary)', d.ipBinary); row(t, 'Mask (binary)', d.maskBinary);
  checkIp(); doSplit();
}
function checkIp() {
  const v = $('check').value.trim(), m = $('chkmsg');
  m.className = ''; m.textContent = '';
  if (!v) return;
  try {
    const inside = contains(parseCidr($('cidr').value), v);
    m.textContent = v + (inside ? ' is inside ' : ' is NOT inside ') + describe($('cidr').value).cidr;
    m.className = inside ? 'good' : 'bad';
  } catch (e) { m.textContent = e.message; m.className = 'bad'; }
}
function doSplit() {
  const ul = $('splitout'); ul.replaceChildren(); $('splitmsg').textContent = '';
  try {
    const list = split($('cidr').value, Number($('newp').value));
    $('splitmsg').textContent = list.length + ' subnet(s)';
    for (const s of list.slice(0, 256)) { const li = document.createElement('li'); li.textContent = s; ul.append(li); }
    if (list.length > 256) { const li = document.createElement('li'); li.textContent = '… ' + (list.length - 256) + ' more'; ul.append(li); }
  } catch (e) { $('splitmsg').textContent = e.message; }
}
function doRange() {
  try { $('rmsg').textContent = rangeToCidrs($('rs').value.trim(), $('re').value.trim()).join('\n'); $('rmsg').style.whiteSpace = 'pre-wrap'; }
  catch (e) { $('rmsg').textContent = e.message; }
}
function doAudit() {
  const r = audit($('rules').value.split('\n')), ul = $('findings'); ul.replaceChildren();
  if (!r.findings.length) { const li = document.createElement('li'); li.textContent = r.count ? 'No issues found.' : 'Enter some rules.'; ul.append(li); }
  for (const f of r.findings) {
    const li = document.createElement('li'), tag = document.createElement('span');
    tag.className = 'tag ' + f.sev; tag.textContent = f.sev;
    li.append(tag, document.createTextNode('line ' + f.line + ': ' + f.msg)); ul.append(li);
  }
  $('summary').textContent = r.summary.join('\n') || '—';
}
document.querySelectorAll('[data-ex]').forEach((b) => b.addEventListener('click', () => { $('cidr').value = b.dataset.ex; calc(); }));
$('cidr').addEventListener('input', calc); $('check').addEventListener('input', checkIp); $('newp').addEventListener('input', doSplit);
$('rs').addEventListener('input', doRange); $('re').addEventListener('input', doRange);
$('run').addEventListener('click', doAudit);
$('sample').addEventListener('click', () => { $('rules').value = SAMPLE; doAudit(); });
$('rules').value = SAMPLE; calc(); doRange(); doAudit();
