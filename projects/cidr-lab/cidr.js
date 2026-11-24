// Pure IPv4 CIDR logic. All addresses are unsigned 32-bit integers (>>> 0).
export function parseIPv4(s) {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(String(s).trim());
  if (!m) throw new Error('Invalid IPv4 address: ' + s);
  let n = 0;
  for (let i = 1; i <= 4; i++) {
    if (m[i].length > 1 && m[i][0] === '0') throw new Error('Leading zeros are ambiguous (octal in some parsers): ' + s);
    const o = Number(m[i]);
    if (o > 255) throw new Error('Octet out of range: ' + s);
    n = n * 256 + o;
  }
  return n >>> 0;
}
export const ipToStr = (n) => [24, 16, 8, 0].map((sh) => (n >>> sh) & 255).join('.');
export const maskOf = (p) => (p === 0 ? 0 : (0xffffffff << (32 - p)) >>> 0);

export function parseCidr(s) {
  const m = /^\s*([^/\s]+)(?:\/(\d{1,2}))?\s*$/.exec(String(s));
  if (!m) throw new Error('Invalid CIDR: ' + s);
  const ip = parseIPv4(m[1]);
  const prefix = m[2] === undefined ? 32 : Number(m[2]);
  if (prefix > 32) throw new Error('Prefix must be 0-32: ' + s);
  const mask = maskOf(prefix);
  const network = (ip & mask) >>> 0;
  return { ip, prefix, mask, network, canonical: network === ip };
}
const size = (p) => 2 ** (32 - p);
export const lastOf = (c) => (c.network + size(c.prefix) - 1) >>> 0;
export const cidrStr = (c) => ipToStr(c.network) + '/' + c.prefix;

const RANGES = [
  ['0.0.0.0/8', '"This" network', 'special'],
  ['10.0.0.0/8', 'Private (RFC 1918)', 'private'],
  ['100.64.0.0/10', 'Carrier-grade NAT (RFC 6598)', 'private'],
  ['127.0.0.0/8', 'Loopback', 'special'],
  ['169.254.0.0/16', 'Link-local / cloud metadata (169.254.169.254)', 'special'],
  ['172.16.0.0/12', 'Private (RFC 1918)', 'private'],
  ['192.0.0.0/24', 'IETF protocol assignments', 'special'],
  ['192.0.2.0/24', 'Documentation TEST-NET-1', 'special'],
  ['192.168.0.0/16', 'Private (RFC 1918)', 'private'],
  ['198.18.0.0/15', 'Benchmarking', 'special'],
  ['198.51.100.0/24', 'Documentation TEST-NET-2', 'special'],
  ['203.0.113.0/24', 'Documentation TEST-NET-3', 'special'],
  ['224.0.0.0/4', 'Multicast', 'special'],
  ['240.0.0.0/4', 'Reserved (Class E)', 'special'],
].map(([c, label, kind]) => ({ c: parseCidr(c), label, kind }));

export function classify(c) {
  for (const r of RANGES) if (relation(c, r.c) === 'equal' || relation(c, r.c) === 'inside') return { label: r.label, kind: r.kind };
  return { label: 'Public / globally routable', kind: 'public' };
}

export function describe(input) {
  const c = typeof input === 'string' ? parseCidr(input) : input;
  const total = size(c.prefix);
  const last = lastOf(c);
  let usable, first, lastHost;
  if (c.prefix === 32) { usable = 1; first = lastHost = c.network; }
  else if (c.prefix === 31) { usable = 2; first = c.network; lastHost = last; } // RFC 3021
  else { usable = total - 2; first = c.network + 1; lastHost = last - 1; }
  const bin = (n) => [24, 16, 8, 0].map((sh) => ((n >>> sh) & 255).toString(2).padStart(8, '0')).join('.');
  return {
    cidr: cidrStr(c), input: ipToStr(c.ip), prefix: c.prefix, canonical: c.canonical,
    network: ipToStr(c.network), broadcast: c.prefix >= 31 ? null : ipToStr(last),
    netmask: ipToStr(c.mask), wildcard: ipToStr(~c.mask >>> 0),
    firstHost: ipToStr(first), lastHost: ipToStr(lastHost),
    total, usable, range: classify(c), maskBinary: bin(c.mask), ipBinary: bin(c.ip),
  };
}

// relation of a to b: equal | contains (a ⊃ b) | inside (a ⊂ b) | overlap | disjoint
export function relation(a, b) {
  const al = lastOf(a), bl = lastOf(b);
  if (a.network === b.network && a.prefix === b.prefix) return 'equal';
  if (a.network <= b.network && al >= bl) return 'contains';
  if (b.network <= a.network && bl >= al) return 'inside';
  if (a.network <= bl && b.network <= al) return 'overlap';
  return 'disjoint';
}

export function contains(cidr, ip) {
  const c = typeof cidr === 'string' ? parseCidr(cidr) : cidr;
  const n = typeof ip === 'string' ? parseIPv4(ip) : ip;
  return n >= c.network && n <= lastOf(c);
}

export function split(cidr, newPrefix, limit = 4096) {
  const c = typeof cidr === 'string' ? parseCidr(cidr) : cidr;
  if (newPrefix < c.prefix || newPrefix > 32) throw new Error('New prefix must be between /' + c.prefix + ' and /32');
  const count = 2 ** (newPrefix - c.prefix);
  if (count > limit) throw new Error('Would create ' + count + ' subnets (limit ' + limit + ')');
  const step = size(newPrefix), out = [];
  for (let i = 0; i < count; i++) out.push(ipToStr((c.network + i * step) >>> 0) + '/' + newPrefix);
  return out;
}

// Convert an inclusive IP range to the minimal list of CIDR blocks.
export function rangeToCidrs(startIp, endIp) {
  let s = typeof startIp === 'string' ? parseIPv4(startIp) : startIp;
  const e = typeof endIp === 'string' ? parseIPv4(endIp) : endIp;
  if (s > e) throw new Error('Start must not be after end');
  const out = [];
  while (s <= e) {
    let p = 32;
    while (p > 0) {
      const np = p - 1;
      if ((s & maskOf(np)) >>> 0 !== s || s + size(np) - 1 > e) break;
      p = np;
    }
    out.push(ipToStr(s) + '/' + p);
    s += size(p);
  }
  return out;
}

// Merge a list of CIDRs into the smallest equivalent list (route summarisation).
export function summarize(list) {
  const ranges = list.map((x) => parseCidr(x)).map((c) => [c.network, lastOf(c)]).sort((a, b) => a[0] - b[0]);
  const merged = [];
  for (const r of ranges) {
    const top = merged[merged.length - 1];
    if (top && r[0] <= top[1] + 1) top[1] = Math.max(top[1], r[1]);
    else merged.push([...r]);
  }
  return merged.flatMap(([s, e]) => rangeToCidrs(s, e));
}

// Audit an allow/deny list (e.g. firewall or security-group sources).
export function audit(lines) {
  const items = [], findings = [];
  lines.forEach((raw, i) => {
    const t = raw.trim();
    if (!t || t.startsWith('#')) return;
    try { items.push({ line: i + 1, raw: t, c: parseCidr(t) }); }
    catch (e) { findings.push({ sev: 'error', line: i + 1, msg: e.message }); }
  });
  for (const it of items) {
    const { c, line } = it;
    if (c.prefix === 0) findings.push({ sev: 'high', line, msg: it.raw + ' allows the entire internet (0.0.0.0/0).' });
    else if (c.prefix < 8) findings.push({ sev: 'high', line, msg: it.raw + ' is extremely broad (' + size(c.prefix).toLocaleString('en-US') + ' addresses).' });
    else if (c.prefix < 16 && classify(c).kind === 'public') findings.push({ sev: 'medium', line, msg: it.raw + ' is a very large public range (' + size(c.prefix).toLocaleString('en-US') + ' addresses).' });
    if (!c.canonical) findings.push({ sev: 'low', line, msg: it.raw + ' has host bits set; it is really ' + cidrStr(c) + '.' });
    if (c.prefix === 32) findings.push({ sev: 'info', line, msg: it.raw + ' is a single host.' });
  }
  for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
    const a = items[i], b = items[j], r = relation(a.c, b.c);
    if (r === 'equal') findings.push({ sev: 'medium', line: b.line, msg: 'Line ' + b.line + ' duplicates line ' + a.line + ' (' + cidrStr(a.c) + ').' });
    else if (r === 'contains') findings.push({ sev: 'medium', line: b.line, msg: cidrStr(b.c) + ' (line ' + b.line + ') is redundant: already covered by ' + cidrStr(a.c) + ' (line ' + a.line + ').' });
    else if (r === 'inside') findings.push({ sev: 'medium', line: a.line, msg: cidrStr(a.c) + ' (line ' + a.line + ') is redundant: already covered by ' + cidrStr(b.c) + ' (line ' + b.line + ').' });
  }
  const order = { high: 0, medium: 1, error: 2, low: 3, info: 4 };
  findings.sort((x, y) => order[x.sev] - order[y.sev] || x.line - y.line);
  const merged = items.length ? summarize(items.map((i) => i.raw)) : [];
  return { findings, summary: merged, count: items.length };
}
