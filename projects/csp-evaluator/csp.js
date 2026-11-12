// Pure CSP parsing + evaluation logic (no DOM). Used by app.js and test.mjs.

export const KNOWN_DIRECTIVES = new Set([
  'default-src','script-src','script-src-elem','script-src-attr','style-src','style-src-elem','style-src-attr',
  'img-src','font-src','connect-src','media-src','object-src','frame-src','child-src','worker-src','manifest-src',
  'prefetch-src','base-uri','form-action','frame-ancestors','sandbox','report-uri','report-to',
  'upgrade-insecure-requests','block-all-mixed-content','require-trusted-types-for','trusted-types','navigate-to'
]);

// Hosts that are widely documented as serving JSONP endpoints, Angular libs or user-controlled content,
// which can defeat an allowlist-based script-src.
export const BYPASS_HOSTS = [
  'ajax.googleapis.com','*.googleapis.com','www.google.com','accounts.google.com','cdnjs.cloudflare.com',
  'cdn.jsdelivr.net','unpkg.com','*.cloudfront.net','*.amazonaws.com','*.herokuapp.com','*.appspot.com',
  'raw.githubusercontent.com','*.github.io','*.firebaseapp.com','*.azurewebsites.net','*.googleusercontent.com'
];

export function parseCsp(text) {
  let s = String(text || '').trim();
  let reportOnly = false;
  const m = s.match(/^content-security-policy(-report-only)?\s*:\s*/i);
  if (m) { reportOnly = !!m[1]; s = s.slice(m[0].length); }
  const directives = {};
  const duplicates = [];
  const order = [];
  for (const part of s.split(';')) {
    const toks = part.trim().split(/\s+/).filter(Boolean);
    if (!toks.length) continue;
    const name = toks[0].toLowerCase();
    if (Object.prototype.hasOwnProperty.call(directives, name)) { duplicates.push(name); continue; } // first wins per spec
    directives[name] = toks.slice(1);
    order.push(name);
  }
  return { directives, duplicates, order, reportOnly };
}

const lc = (a) => a.map((x) => x.toLowerCase());
const isNonce = (t) => /^'nonce-[^']+'$/i.test(t);
const isHash = (t) => /^'sha(256|384|512)-[^']+'$/i.test(t);

export function hostMatchesBypass(src) {
  let h = src.toLowerCase().replace(/^[a-z][a-z0-9+.-]*:\/\//, '').replace(/[/:].*$/, '').replace(/\/.*$/, '');
  if (!h) return null;
  for (const b of BYPASS_HOSTS) {
    if (h === b) return b;
    if (b.startsWith('*.') && h.endsWith(b.slice(1)) ) return b;
    if (h.startsWith('*.') && !b.startsWith('*.') && b.endsWith(h.slice(1))) return b;
  }
  return null;
}

function add(list, severity, directive, title, detail, fix) {
  list.push({ severity, directive, title, detail, fix });
}

export function evaluate(text) {
  const { directives, duplicates, reportOnly } = parseCsp(text);
  const f = [];
  const has = (d) => Object.prototype.hasOwnProperty.call(directives, d);
  if (!Object.keys(directives).length) {
    add(f, 'high', '(policy)', 'Empty policy', 'No directives were found, so nothing is restricted.', "Start with: default-src 'none'; script-src 'self'; object-src 'none'; base-uri 'none'");
    return finish(f, reportOnly);
  }
  if (reportOnly) add(f, 'info', '(policy)', 'Report-Only mode', 'Content-Security-Policy-Report-Only logs violations but does NOT block anything.', 'Switch to the enforcing Content-Security-Policy header once violations are fixed.');
  for (const d of duplicates) add(f, 'low', d, `Duplicate ${d}`, 'Browsers ignore every occurrence after the first.', 'Merge the sources into a single directive.');
  for (const d of Object.keys(directives)) {
    if (!KNOWN_DIRECTIVES.has(d)) add(f, 'info', d, `Unknown directive "${d}"`, 'Browsers ignore unrecognised directives — this may be a typo.', 'Check the spelling against the CSP spec.');
  }

  const eff = (d) => (has(d) ? directives[d] : has('default-src') ? directives['default-src'] : null);
  const scriptSrc = eff('script-src');
  const scriptName = has('script-src') ? 'script-src' : 'default-src';

  if (!scriptSrc) {
    add(f, 'high', 'script-src', 'No script restriction', 'Neither script-src nor default-src is set, so any script from anywhere runs.', "Add script-src 'self' with nonces or hashes.");
  } else {
    const l = lc(scriptSrc);
    const hasNonceHash = l.some(isNonce) || l.some(isHash);
    const strictDyn = l.includes("'strict-dynamic'");
    if (l.includes("'unsafe-inline'")) {
      if (hasNonceHash || strictDyn) add(f, 'info', scriptName, "'unsafe-inline' is neutralised", "A nonce/hash is present, so modern browsers ignore 'unsafe-inline' (kept only as a legacy fallback).", null);
      else add(f, 'high', scriptName, "'unsafe-inline' allows inline scripts", 'Any injected <script> or onerror= handler executes, which defeats CSP as an XSS defence.', "Remove 'unsafe-inline' and use per-response nonces ('nonce-…') or hashes.");
    }
    if (l.includes("'unsafe-eval'")) add(f, 'medium', scriptName, "'unsafe-eval' allows string-to-code", 'eval(), new Function() and similar sinks are permitted, which widens XSS impact.', 'Refactor away from eval; use precompiled templates.');
    if (l.includes("'unsafe-hashes'")) add(f, 'low', scriptName, "'unsafe-hashes' allows hashed inline handlers", 'Hashes can authorise inline event handler attributes.', 'Move handlers into external scripts with addEventListener.');
    const bypassable = !strictDyn;
    for (const t of l) {
      if (t === '*') add(f, 'high', scriptName, 'Wildcard (*) script source', 'Scripts can be loaded from any host.', "Use 'self' plus nonces or specific hosts.");
      else if (t === 'https:' || t === 'http:') add(f, 'high', scriptName, `Scheme-only source ${t}`, `Any ${t.slice(0, -1).toUpperCase()} host can serve scripts.`, 'List explicit hosts or use nonces + strict-dynamic.');
      else if (t === 'data:') add(f, 'high', scriptName, 'data: URIs allowed for scripts', 'Attackers can inject <script src="data:…">.', 'Remove data: from script sources.');
      else if (t === 'blob:' || t === 'filesystem:') add(f, 'medium', scriptName, `${t} allowed for scripts`, 'Attacker-created blob/filesystem content can execute.', `Remove ${t}.`);
      else if (t.startsWith('http://')) add(f, 'medium', scriptName, `Insecure http:// source ${t}`, 'Scripts over HTTP can be modified by a network attacker.', 'Use https:// sources.');
      else if (bypassable && !t.startsWith("'") && !t.endsWith(':')) {
        const b = hostMatchesBypass(t);
        if (b) add(f, 'medium', scriptName, `Allowlisted host may host bypasses: ${t}`, `${b} is known to serve JSONP/Angular/user-uploaded content that can be abused to run attacker-controlled script.`, "Prefer nonces with 'strict-dynamic' instead of host allowlists.");
      }
    }
    for (const t of l) {
      const m = t.match(/^'nonce-([^']+)'$/);
      if (m && m[1].length < 16) add(f, 'low', scriptName, 'Short nonce', `Nonce "${m[1]}" has under 16 characters — guessable nonces defeat the purpose. Nonces must be unpredictable and unique per response.`, 'Use ≥128 bits of randomness, base64 encoded.');
    }
    if (!hasNonceHash && !strictDyn && !l.includes("'unsafe-inline'") && !l.includes('*')) {
      add(f, 'info', scriptName, 'Host-allowlist only policy', 'Allowlist-only CSPs are frequently bypassable; Google research found most real-world ones are.', "Adopt a strict CSP: nonce + 'strict-dynamic'.");
    }
  }

  // object-src
  const obj = eff('object-src');
  if (!obj) add(f, 'high', 'object-src', 'object-src not restricted', 'Plugins (<object>/<embed>) can execute script even under a strict script-src.', "Add object-src 'none'.");
  else if (!lc(obj).includes("'none'")) add(f, 'medium', has('object-src') ? 'object-src' : 'default-src', "object-src is not 'none'", 'Plugin content is allowed.', "Set object-src 'none'.");

  if (!has('base-uri')) add(f, 'medium', 'base-uri', 'base-uri missing', 'An injected <base href> can redirect relative script URLs to an attacker host (does not fall back to default-src).', "Add base-uri 'none' (or 'self').");
  else if (lc(directives['base-uri']).some((t) => t === '*' || t === 'https:' || t === 'http:')) add(f, 'medium', 'base-uri', 'base-uri too permissive', 'Attacker-controlled <base> remains possible.', "Use base-uri 'none' or 'self'.");

  if (!has('frame-ancestors')) add(f, 'low', 'frame-ancestors', 'No clickjacking protection', 'Pages can be framed by any site (frame-ancestors does not fall back to default-src).', "Add frame-ancestors 'self' (or 'none').");
  else if (lc(directives['frame-ancestors']).includes('*')) add(f, 'medium', 'frame-ancestors', 'frame-ancestors *', 'Any site may frame this page.', "Use 'self' or 'none'.");

  if (!has('form-action')) add(f, 'low', 'form-action', 'form-action missing', 'Injected forms could post credentials to any origin (no default-src fallback).', "Add form-action 'self'.");

  if (!has('upgrade-insecure-requests') && !has('block-all-mixed-content')) add(f, 'low', 'upgrade-insecure-requests', 'No HTTPS upgrade', 'Mixed content is not automatically upgraded.', 'Add upgrade-insecure-requests.');

  for (const d of ['default-src','style-src','img-src','connect-src','frame-src','font-src','media-src','worker-src']) {
    if (has(d)) {
      const l = lc(directives[d]);
      if (d !== 'script-src' && d !== scriptName && (l.includes('*') || l.includes('http:'))) {
        add(f, d === 'connect-src' ? 'medium' : 'low', d, `${d} is very permissive`, d === 'connect-src' ? 'Wildcard connect-src eases data exfiltration.' : 'Wildcard or http: sources weaken the policy.', 'Restrict to the hosts you actually use.');
      }
    }
  }
  if (has('style-src') && lc(directives['style-src']).includes("'unsafe-inline'")) add(f, 'low', 'style-src', "style-src allows 'unsafe-inline'", 'Inline CSS enables UI redressing and CSS-based data exfiltration.', 'Use nonces/hashes for styles.');

  return finish(f, reportOnly);
}

const PENALTY = { high: 25, medium: 12, low: 5, info: 0 };
const RANK = { high: 0, medium: 1, low: 2, info: 3 };

function finish(findings, reportOnly) {
  findings.sort((a, b) => RANK[a.severity] - RANK[b.severity]);
  let score = 100;
  for (const x of findings) score -= PENALTY[x.severity];
  score = Math.max(0, score);
  const grade = score >= 95 ? 'A+' : score >= 85 ? 'A' : score >= 70 ? 'B' : score >= 55 ? 'C' : score >= 40 ? 'D' : 'F';
  const counts = { high: 0, medium: 0, low: 0, info: 0 };
  for (const x of findings) counts[x.severity]++;
  return { findings, score, grade, counts, reportOnly };
}

export const EXAMPLES = {
  strict: "default-src 'none'; script-src 'nonce-r4nd0mBase64Value123456' 'strict-dynamic'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests",
  typical: "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com; style-src 'self' 'unsafe-inline'; img-src *",
  weak: "script-src * 'unsafe-inline' 'unsafe-eval' data:; img-src *",
  jsonp: "Content-Security-Policy: default-src 'self'; script-src 'self' https://ajax.googleapis.com https://accounts.google.com; object-src 'none'; base-uri 'self'",
  reportonly: "Content-Security-Policy-Report-Only: default-src 'self'; script-src 'self'"
};
