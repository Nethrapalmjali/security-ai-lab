// Pure logic for email header analysis. No DOM access.

export function parseHeaders(raw) {
  const text = String(raw).replace(/\r\n?/g, '\n').split(/\n\n/)[0];
  const lines = text.split('\n');
  const out = [];
  for (const line of lines) {
    if (/^[ \t]/.test(line) && out.length) out[out.length - 1].value += ' ' + line.trim();
    else {
      const m = /^([!-9;-~]+):[ \t]*(.*)$/.exec(line);
      if (m) out.push({ name: m[1], value: m[2].trim() });
    }
  }
  return out;
}

export const getAll = (h, n) => h.filter(x => x.name.toLowerCase() === n.toLowerCase()).map(x => x.value);
export const getOne = (h, n) => getAll(h, n)[0];

export function addressDomain(v) {
  if (!v) return null;
  const m = /<([^>]*)>/.exec(v);
  const addr = (m ? m[1] : v).trim();
  const at = addr.lastIndexOf('@');
  if (at < 0) return null;
  const d = addr.slice(at + 1).replace(/[>\s;]+.*$/, '').toLowerCase();
  return d || null;
}

export function displayName(v) {
  if (!v) return null;
  const m = /^\s*"?([^"<]*?)"?\s*</.exec(v);
  return m && m[1].trim() ? m[1].trim() : null;
}

// Organizational domain approximation (last 2 labels, or 3 for common 2-level public suffixes).
const SLD = new Set(['co.uk', 'org.uk', 'ac.uk', 'com.au', 'co.jp', 'co.in', 'com.br', 'co.nz', 'co.za']);
export function orgDomain(d) {
  if (!d) return null;
  const p = d.toLowerCase().split('.');
  if (p.length <= 2) return d.toLowerCase();
  const last2 = p.slice(-2).join('.');
  return SLD.has(last2) ? p.slice(-3).join('.') : last2;
}

export function parseAuthResults(value) {
  const parts = value.split(';').map(s => s.trim()).filter(Boolean);
  const res = { server: parts.shift() || '', methods: {} };
  for (const p of parts) {
    const m = /^(spf|dkim|dmarc|arc|compauth)\s*=\s*([a-z]+)\s*(.*)$/i.exec(p);
    if (!m) continue;
    const props = {};
    for (const kv of m[3].matchAll(/([a-z]+\.[a-z-]+)\s*=\s*("?)([^\s";]+)\2/gi)) props[kv[1].toLowerCase()] = kv[3].toLowerCase();
    const key = m[1].toLowerCase();
    (res.methods[key] = res.methods[key] || []).push({ result: m[2].toLowerCase(), props });
  }
  return res;
}

export function parseDkimSignature(value) {
  const tags = {};
  for (const part of value.split(';')) {
    const i = part.indexOf('=');
    if (i > 0) tags[part.slice(0, i).trim()] = part.slice(i + 1).replace(/\s+/g, '').trim();
  }
  return tags;
}

const MONTHS = /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/i;
export function parseDate(s) {
  if (!s || !MONTHS.test(s)) return null;
  const t = Date.parse(s.replace(/\s*\(.*\)\s*$/, ''));
  return Number.isNaN(t) ? null : t;
}

export function parseReceived(value) {
  const semi = value.lastIndexOf(';');
  const body = semi >= 0 ? value.slice(0, semi) : value;
  const ts = semi >= 0 ? parseDate(value.slice(semi + 1).trim()) : null;
  const from = /\bfrom\s+(\S+)/i.exec(body);
  const by = /\bby\s+(\S+)/i.exec(body);
  const ips = [...body.matchAll(/\[?((?:\d{1,3}\.){3}\d{1,3})\]?/g)].map(m => m[1]).filter(ip => ip.split('.').every(n => +n <= 255));
  const ip6 = [...body.matchAll(/\[(?:IPv6:)?([0-9a-f:]{3,39})\]/gi)].map(m => m[1]).filter(x => x.includes(':'));
  const tls = /\b(ESMTPS|TLS|using TLS|version=TLS)/i.test(body);
  return { from: from ? from[1] : null, by: by ? by[1] : null, ips: [...ips, ...ip6], ts, tls };
}

export function isPrivateIp(ip) {
  if (ip.includes(':')) return /^(fe80|fc|fd|::1)/i.test(ip);
  const [a, b] = ip.split('.').map(Number);
  return a === 10 || a === 127 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254);
}

export function analyze(raw) {
  const headers = parseHeaders(raw);
  const findings = [];
  const add = (severity, title, detail) => findings.push({ severity, title, detail });
  if (!headers.length) return { headers, findings: [{ severity: 'info', title: 'No headers found', detail: 'Paste the raw message headers (e.g. "Show original" in Gmail).' }], score: null, grade: '-', hops: [], auth: {}, identities: {} };

  const from = getOne(headers, 'From');
  const fromDomain = addressDomain(from);
  const returnPath = getOne(headers, 'Return-Path');
  const rpDomain = addressDomain(returnPath);
  const replyTo = getOne(headers, 'Reply-To');
  const replyDomain = addressDomain(replyTo);
  const msgId = getOne(headers, 'Message-ID');
  const midDomain = addressDomain(msgId && msgId.replace(/[<>]/g, ''));
  const name = displayName(from);
  const identities = { from, fromDomain, returnPath, rpDomain, replyTo, replyDomain, msgId, midDomain, displayName: name };

  // Authentication results
  const arValues = getAll(headers, 'Authentication-Results');
  const auth = { spf: null, dkim: null, dmarc: null, dkimDomains: [] };
  for (const v of arValues) {
    const p = parseAuthResults(v);
    for (const k of ['spf', 'dkim', 'dmarc']) {
      for (const e of p.methods[k] || []) {
        if (k === 'dkim') {
          if (e.props['header.d']) auth.dkimDomains.push({ domain: e.props['header.d'], result: e.result });
          if (e.result === 'pass' || !auth.dkim) auth.dkim = e.result;
        } else if (!auth[k]) auth[k] = e.result;
        if (k === 'spf' && e.props['smtp.mailfrom']) auth.spfDomain = addressDomain(e.props['smtp.mailfrom']) || e.props['smtp.mailfrom'];
      }
    }
  }
  const rspf = getOne(headers, 'Received-SPF');
  if (!auth.spf && rspf) { const m = /^\s*([a-z]+)/i.exec(rspf); if (m) auth.spf = m[1].toLowerCase(); }

  if (!arValues.length && !rspf) add('warn', 'No authentication results present', 'No Authentication-Results or Received-SPF header was found, so SPF/DKIM/DMARC outcomes cannot be verified. Headers added by the receiving server are the only trustworthy ones.');
  const badRes = r => ['fail', 'softfail', 'permerror', 'temperror', 'none', 'neutral'].includes(r);
  if (auth.spf === 'pass') add('good', 'SPF passed', 'The sending IP is authorised by the envelope-sender domain.');
  else if (auth.spf) add(auth.spf === 'fail' || auth.spf === 'softfail' ? 'bad' : 'warn', `SPF result: ${auth.spf}`, 'The sending server is not (clearly) authorised by the envelope domain’s SPF record.');
  if (auth.dkim === 'pass') add('good', 'DKIM passed', 'A cryptographic signature was verified for the message.');
  else if (auth.dkim) add(badRes(auth.dkim) ? 'bad' : 'warn', `DKIM result: ${auth.dkim}`, 'No valid DKIM signature was verified. The body or headers may have been altered, or the message was never signed.');
  if (auth.dmarc === 'pass') add('good', 'DMARC passed', 'SPF or DKIM passed AND aligned with the visible From domain.');
  else if (auth.dmarc) add(auth.dmarc === 'fail' ? 'bad' : 'warn', `DMARC result: ${auth.dmarc}`, 'The visible From domain is not protected by an aligned SPF/DKIM pass.');
  else if (arValues.length) add('warn', 'No DMARC result', 'The receiver reported no DMARC evaluation; the From domain may have no DMARC policy.');

  // Alignment checks
  if (fromDomain && rpDomain && orgDomain(fromDomain) !== orgDomain(rpDomain)) {
    add(auth.spf === 'pass' ? 'info' : 'warn', 'Return-Path domain differs from From', `From is @${fromDomain} but the envelope sender is @${rpDomain}. SPF would not be DMARC-aligned. Normal for mailing lists/ESPs; suspicious otherwise.`);
  }
  if (fromDomain && auth.dkimDomains.length) {
    const aligned = auth.dkimDomains.some(d => d.result === 'pass' && orgDomain(d.domain) === orgDomain(fromDomain));
    if (!aligned && auth.dkim === 'pass') add('warn', 'DKIM signature not aligned with From', `Signed by ${auth.dkimDomains.map(d => d.domain).join(', ')} but From is @${fromDomain}; a third party signed it.`);
  }
  if (fromDomain && replyDomain && orgDomain(fromDomain) !== orgDomain(replyDomain)) add('bad', 'Reply-To redirects to a different domain', `Replies go to @${replyDomain} instead of @${fromDomain} — a classic business-email-compromise and phishing pattern.`);
  if (name && /[\w.+-]+@[\w-]+\.[\w.-]+/.test(name)) {
    const nd = addressDomain(name.match(/[\w.+-]+@[\w-]+\.[\w.-]+/)[0]);
    if (nd && fromDomain && orgDomain(nd) !== orgDomain(fromDomain)) add('bad', 'Display name spoofs another address', `Display name shows “${name}” but the real sender is @${fromDomain}.`);
  }
  if (fromDomain && /xn--/.test(fromDomain)) add('warn', 'Punycode (IDN) sender domain', `@${fromDomain} contains punycode; check for homograph look-alike characters.`);
  if (midDomain && fromDomain && orgDomain(midDomain) !== orgDomain(fromDomain)) add('info', 'Message-ID domain differs from From', `Message-ID generated by @${midDomain}. Common for ESPs; unusual for personal mail.`);
  if (!msgId) add('warn', 'Missing Message-ID', 'Legitimate MTAs always add a Message-ID.');
  if (getAll(headers, 'From').length > 1) add('bad', 'Multiple From headers', 'Duplicate From headers are a known spoofing technique to confuse display vs. validated identity.');
  if (!from) add('warn', 'Missing From header', 'Required by RFC 5322.');

  // DKIM signature details
  for (const sig of getAll(headers, 'DKIM-Signature')) {
    const t = parseDkimSignature(sig);
    if (t.a && /sha1/i.test(t.a)) add('warn', 'Weak DKIM algorithm', `Signature uses ${t.a}; SHA-1 is deprecated (RFC 8301).`);
    if (t.h && !t.h.toLowerCase().split(':').includes('from')) add('bad', 'DKIM does not sign From', 'RFC 6376 requires the From header to be signed.');
    if (t.l) add('warn', 'DKIM body length limit (l=) used', 'Attackers can append content after the signed portion.');
    if (t.x && t.t && +t.x < +t.t) add('info', 'DKIM signature expiry earlier than timestamp', 'x= precedes t=, which is malformed.');
  }

  // Received chain (reverse so index 0 = origin)
  const rec = getAll(headers, 'Received').map(parseReceived).reverse();
  const hops = rec.map((r, i) => ({ ...r, index: i + 1, delay: i > 0 && r.ts != null && rec[i - 1].ts != null ? Math.round((r.ts - rec[i - 1].ts) / 1000) : null }));
  if (!hops.length) add('warn', 'No Received headers', 'Mail passing through an MTA always has at least one Received header; it may have been stripped or forged.');
  if (hops.some(h => h.delay != null && h.delay < -60)) add('bad', 'Timestamps go backwards', 'A hop is dated earlier than the previous one beyond normal clock skew, suggesting forged or injected Received headers.');
  const big = hops.filter(h => h.delay != null && h.delay > 3600);
  if (big.length) add('info', 'Long delivery delay', `${big.length} hop(s) took over an hour (max ${Math.max(...big.map(h => h.delay))}s). Greylisting, queueing or scanning are typical causes.`);
  const origin = hops[0];
  if (origin) {
    const pub = origin.ips.filter(ip => !isPrivateIp(ip));
    if (pub.length) add('info', 'Originating IP', `First hop received from ${pub[0]}${origin.from ? ' (' + origin.from + ')' : ''}. Look it up in a WHOIS/reputation tool.`);
  }
  const noTls = hops.filter(h => h.by && !h.tls);
  if (hops.length && noTls.length === hops.length) add('info', 'No TLS indicated', 'None of the hops advertise TLS in their Received lines.');
  const xm = getOne(headers, 'X-Mailer') || getOne(headers, 'User-Agent');
  if (xm) add('info', 'Client software', xm);

  const pen = { bad: 25, warn: 8, info: 0, good: -5 };
  let score = 100 + 0; for (const f of findings) score -= pen[f.severity];
  score = Math.max(0, Math.min(100, score));
  const grade = score >= 90 ? 'A' : score >= 75 ? 'B' : score >= 55 ? 'C' : score >= 35 ? 'D' : 'F';
  return { headers, findings, score, grade, hops, auth, identities };
}
