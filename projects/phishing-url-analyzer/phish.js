// Phishing URL heuristic analyzer — pure logic, no DOM. Static analysis only: never fetches the URL.

export const BRANDS = {
  paypal: ['paypal.com'], google: ['google.com', 'gmail.com'], microsoft: ['microsoft.com', 'live.com', 'office.com', 'outlook.com'],
  apple: ['apple.com', 'icloud.com'], amazon: ['amazon.com'], netflix: ['netflix.com'], facebook: ['facebook.com'],
  instagram: ['instagram.com'], github: ['github.com'], dropbox: ['dropbox.com'], linkedin: ['linkedin.com'],
  chase: ['chase.com'], wellsfargo: ['wellsfargo.com'], docusign: ['docusign.com', 'docusign.net'], coinbase: ['coinbase.com'],
};
const MULTI_TLD = new Set(['co.uk', 'org.uk', 'ac.uk', 'gov.uk', 'com.au', 'net.au', 'co.in', 'co.jp', 'com.br', 'co.nz', 'co.za', 'com.mx', 'com.cn']);
export const RISKY_TLDS = new Set(['zip', 'mov', 'tk', 'ml', 'ga', 'cf', 'gq', 'xyz', 'top', 'click', 'country', 'work', 'support', 'rest', 'icu', 'cyou', 'buzz', 'live', 'monster']);
export const SHORTENERS = new Set(['bit.ly', 'tinyurl.com', 't.co', 'goo.gl', 'ow.ly', 'is.gd', 'buff.ly', 'cutt.ly', 'rebrand.ly', 'shorturl.at', 'tiny.cc']);
const KEYWORDS = ['login', 'signin', 'verify', 'secure', 'account', 'update', 'confirm', 'banking', 'password', 'wallet', 'suspend', 'unlock', 'invoice', 'billing', 'recover', 'validate'];

export function levenshtein(a, b) {
  const m = a.length, n = b.length;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[n];
}

// RFC 3492 punycode decoder (label without the xn-- prefix)
export function punycodeDecode(input) {
  const base = 36, tMin = 1, tMax = 26, skew = 38, damp = 700;
  const out = [];
  let basic = input.lastIndexOf('-');
  if (basic < 0) basic = 0;
  for (let j = 0; j < basic; j++) out.push(input.charCodeAt(j));
  const adapt = (delta, num, first) => {
    delta = first ? Math.floor(delta / damp) : delta >> 1;
    delta += Math.floor(delta / num);
    let k = 0;
    for (; delta > ((base - tMin) * tMax) >> 1; k += base) delta = Math.floor(delta / (base - tMin));
    return Math.floor(k + ((base - tMin + 1) * delta) / (delta + skew));
  };
  let n = 128, i = 0, bias = 72;
  for (let idx = basic > 0 ? basic + 1 : 0; idx < input.length;) {
    const oldi = i;
    for (let w = 1, k = base; ; k += base) {
      if (idx >= input.length) throw new Error('bad punycode');
      const c = input.charCodeAt(idx++);
      const digit = c - 48 < 10 ? c - 22 : c - 65 < 26 ? c - 65 : c - 97 < 26 ? c - 97 : base;
      if (digit >= base) throw new Error('bad punycode');
      i += digit * w;
      const t = k <= bias ? tMin : k >= bias + tMax ? tMax : k - bias;
      if (digit < t) break;
      w *= base - t;
    }
    const len = out.length + 1;
    bias = adapt(i - oldi, len, oldi === 0);
    n += Math.floor(i / len);
    i %= len;
    out.splice(i++, 0, n);
  }
  return String.fromCodePoint(...out);
}

export function hostToUnicode(host) {
  return host.split('.').map(l => { if (!l.startsWith('xn--')) return l; try { return punycodeDecode(l.slice(4)); } catch { return l; } }).join('.');
}

export function registrableDomain(host) {
  const parts = host.split('.');
  if (parts.length <= 2) return host;
  const last2 = parts.slice(-2).join('.');
  return MULTI_TLD.has(last2) ? parts.slice(-3).join('.') : last2;
}

// Convert numeric host forms (decimal 3232235777, hex 0xC0A80101, octal, short) to dotted IPv4 or null
export function parseIPv4Obfuscated(host) {
  const parts = host.split('.');
  if (parts.length < 1 || parts.length > 4) return null;
  const nums = [];
  for (const p of parts) {
    let v;
    if (/^0x[0-9a-f]+$/i.test(p)) v = parseInt(p, 16);
    else if (/^0[0-7]+$/.test(p)) v = parseInt(p, 8);
    else if (/^\d+$/.test(p)) v = parseInt(p, 10);
    else return null;
    nums.push(v);
  }
  let val = 0;
  for (let i = 0; i < nums.length - 1; i++) { if (nums[i] > 255) return null; val += nums[i] * 256 ** (3 - i); }
  const rem = 256 ** (4 - (nums.length - 1));
  if (nums[nums.length - 1] >= rem) return null;
  val += nums[nums.length - 1];
  return [24, 16, 8, 0].map(s => Math.floor(val / 2 ** s) % 256).join('.');
}

const LEET = { 0: 'o', 1: 'l', 3: 'e', 5: 's', 7: 't', 4: 'a', '@': 'a', $: 's' };
export function deLeet(s) { return s.replace(/[0134557@$]/g, c => LEET[c] ?? c).replace(/rn/g, 'm').replace(/vv/g, 'w'); }

export function scriptsOf(str) {
  const s = new Set();
  for (const ch of str) {
    if (/[a-z0-9.-]/i.test(ch)) { if (/[a-z]/i.test(ch)) s.add('Latin'); continue; }
    if (/\p{Script=Cyrillic}/u.test(ch)) s.add('Cyrillic');
    else if (/\p{Script=Greek}/u.test(ch)) s.add('Greek');
    else if (/\p{Script=Latin}/u.test(ch)) s.add('Latin');
    else if (/\p{Script=Han}|\p{Script=Hiragana}|\p{Script=Katakana}/u.test(ch)) s.add('CJK');
    else if (/\p{Script=Arabic}/u.test(ch)) s.add('Arabic');
    else s.add('Other');
  }
  return [...s];
}

const WEIGHT = { critical: 40, high: 22, medium: 10, low: 4, info: 0 };

export function analyze(raw) {
  const findings = [];
  const add = (severity, title, detail) => findings.push({ severity, title, detail });
  let input = String(raw ?? '').trim().replace(/[​-‍⁠﻿]/g, m => { add('high', 'Invisible characters', 'The URL contains zero-width characters, often used to evade filters.'); return ''; });
  if (!input) return { ok: false, error: 'Enter a URL.', findings: [], score: 0, verdict: 'n/a' };
  if (/^(javascript|data|vbscript):/i.test(input)) {
    add('critical', 'Dangerous scheme', 'javascript:/data:/vbscript: URLs run code or embed content directly instead of navigating to a site.');
    return finish({ scheme: input.split(':')[0].toLowerCase() }, findings);
  }
  const hadScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(input);
  let u;
  try { u = new URL(hadScheme ? input : 'http://' + input); } catch { return { ok: false, error: 'Not a parseable URL.', findings: [], score: 0, verdict: 'n/a' }; }
  if (!hadScheme) add('info', 'No scheme given', 'Assuming http:// for analysis.');
  const host = u.hostname.toLowerCase().replace(/\.$/, '');
  const unicodeHost = hostToUnicode(host);
  const reg = registrableDomain(host);
  const labels = host.split('.');
  const tld = labels[labels.length - 1];
  const meta = { scheme: u.protocol.replace(':', ''), host, unicodeHost, registrable: reg, port: u.port || '', path: u.pathname, query: u.search, username: u.username };

  if (u.protocol === 'http:') add('medium', 'Unencrypted HTTP', 'No TLS: credentials typed here travel in clear text. Legitimate login pages use HTTPS.');
  if (u.username || u.password) {
    const mimic = /[.]/.test(decodeURIComponent(u.username));
    add(mimic ? 'critical' : 'high', 'Credentials in URL (@ trick)', `Everything before "@" ("${u.username}") is user info, not the destination. The browser actually goes to "${host}".`);
  }
  const rawAuth = (input.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '').split(/[\/?#]/)[0]).split('@').pop().replace(/:\d*$/, '').toLowerCase();
  const ipv4 = /^\[/.test(host) ? null : parseIPv4Obfuscated(rawAuth) ? parseIPv4Obfuscated(rawAuth) : parseIPv4Obfuscated(host);
  if (/^\[.*\]$/.test(u.host.split('@').pop().replace(/:\d+$/, ''))) add('high', 'IPv6 literal host', 'Legitimate services rarely ask users to log in at a raw IP address.');
  else if (ipv4) {
    const obf = ipv4 !== rawAuth;
    add(obf ? 'critical' : 'high', obf ? 'Obfuscated IP address host' : 'IP address host', `Host resolves to ${ipv4}${obf ? ` (written as "${rawAuth}" to hide it)` : ''}. Brands use domain names, not raw IPs.`);
  }
  if (u.port && !['80', '443'].includes(u.port)) add('medium', 'Non-standard port', `Port ${u.port} is unusual for a public web page.`);
  if (labels.some(l => l.startsWith('xn--'))) add('high', 'Punycode (IDN) domain', `Displays as "${unicodeHost}". Internationalised names can imitate brands with look-alike characters.`);
  const sc = scriptsOf(unicodeHost.replace(/\.[^.]+$/, ''));
  if (sc.length > 1 && sc.includes('Latin')) add('critical', 'Mixed-script homograph', `Domain mixes ${sc.join(' + ')} characters — a classic homograph attack (e.g. Cyrillic "а" for Latin "a").`);
  else if (sc.some(s => s === 'Cyrillic' || s === 'Greek') ) add('medium', 'Non-Latin script domain', `Domain uses ${sc.join(', ')} characters that may resemble Latin letters.`);
  if (SHORTENERS.has(reg)) add('medium', 'URL shortener', 'The real destination is hidden. Expand it in a safe sandbox before visiting.');
  if (RISKY_TLDS.has(tld)) add('medium', `Frequently abused TLD (.${tld})`, 'This TLD is cheap or free and over-represented in abuse reports. Not malicious by itself.');
  const subLabels = labels.slice(0, labels.length - reg.split('.').length);
  if (subLabels.length >= 3) add('medium', 'Excessive subdomains', `${subLabels.length} subdomain levels (${subLabels.join('.')}) — often used to push the real domain out of view.`);
  if ((reg.match(/-/g) || []).length >= 2) add('low', 'Many hyphens in domain', 'Domains like secure-login-update-x.com are common in phishing kits.');
  if (/\d{4,}/.test(reg.split('.')[0])) add('low', 'Long digit run in domain', 'Auto-generated looking domain.');

  // Brand impersonation
  const regName = reg.split('.')[0];
  const normName = deLeet(regName).replace(/-/g, '');
  const flagged = new Set();
  for (const [brand, domains] of Object.entries(BRANDS)) {
    const official = domains.includes(reg);
    if (official) continue;
    const brandInSub = subLabels.some(l => l.includes(brand));
    const brandInPath = (u.pathname + u.search).toLowerCase().includes(brand);
    const typo = regName !== brand && (normName === brand || (!regName.includes(brand) && levenshtein(normName, brand) <= (brand.length >= 7 ? 2 : 1) && Math.abs(normName.length - brand.length) <= 2));
    const contains = regName.includes(brand) || normName.includes(brand);
    if (typo && !flagged.has(brand) && true) { flagged.add(brand); add('critical', `Typosquat of ${brand}`, `"${regName}" is ${levenshtein(normName, brand) || 'nearly'} edit(s) away from "${brand}" after look-alike normalisation (0→o, 1→l, rn→m…).`); }
    else if (contains && !flagged.has(brand)) { flagged.add(brand); add('high', `Brand name inside unrelated domain`, `"${reg}" contains "${brand}" but is not an official ${brand} domain (${domains.join(', ')}).`); }
    else if (brandInSub && !flagged.has(brand)) { flagged.add(brand); add('critical', `Brand in subdomain, different real domain`, `"${host}" looks like ${brand} at a glance, but the real domain is "${reg}".`); }
    else if (brandInPath && !flagged.has(brand)) { flagged.add(brand); add('medium', `Brand name in path`, `The path/query mentions "${brand}" while the site is "${reg}".`); }
  }
  const kws = KEYWORDS.filter(k => (host + u.pathname).toLowerCase().includes(k));
  if (kws.length) add(kws.length >= 3 ? 'medium' : 'low', 'Credential-lure keywords', `Contains: ${kws.join(', ')}.`);
  if (/%25[0-9a-f]{2}/i.test(input)) add('medium', 'Double URL-encoding', 'Sequences like %252F are used to slip past filters.');
  if (/%[0-9a-f]{2}/i.test(u.hostname) || /%(2e|2f|40)/i.test(u.pathname) ) add('low', 'Encoded special characters', 'Encoded dots/slashes/@ in the path can disguise the structure of the URL.');
  const redir = [...u.searchParams.entries()].filter(([, v]) => /^(https?:)?\/\//i.test(v) || /^https?%3a/i.test(v));
  if (redir.length) add('medium', 'Embedded redirect target', `Parameter "${redir[0][0]}" carries another URL (${redir[0][1].slice(0, 60)}) — open-redirect abuse.`);
  if (/\.(exe|scr|js|jar|msi|bat|iso|apk|hta|lnk)$/i.test(u.pathname)) add('high', 'Executable/script download', 'Path ends in a file type commonly used to deliver malware.');
  if (/\.(pdf|docx?|xlsx?)\.[a-z]{2,4}$/i.test(u.pathname)) add('high', 'Double file extension', 'e.g. invoice.pdf.exe disguises the real file type.');
  if (input.length > 120) add('low', 'Very long URL', `${input.length} characters — long URLs hide the real host from casual inspection.`);
  if (/\.(zip|mov)$/i.test(host)) add('medium', `".${tld}" TLD looks like a file name`, 'Text like "report.zip" auto-links into a real website in many chat apps.');
  return finish(meta, findings);
}

function finish(meta, findings) {
  const order = ['critical', 'high', 'medium', 'low', 'info'];
  findings.sort((a, b) => order.indexOf(a.severity) - order.indexOf(b.severity));
  const raw = findings.reduce((s, f) => s + WEIGHT[f.severity], 0);
  const score = Math.min(100, raw);
  const verdict = score >= 60 ? 'Likely phishing' : score >= 30 ? 'Suspicious' : score >= 10 ? 'Some risk signals' : 'No strong signals';
  return { ok: true, meta, findings, score, verdict };
}
