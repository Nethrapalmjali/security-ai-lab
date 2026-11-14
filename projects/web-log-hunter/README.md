# Web Log Threat Hunter

Paste Apache/nginx access logs (combined format) and get detections for common web attacks, scanner traffic and brute-force bursts, plus a per-IP risk ranking. Runs 100% client-side.

**Live:** https://nethrapalmjali.github.io/security-ai-lab/projects/web-log-hunter/

## How it works
- `hunter.js` (pure logic): regex parser for the combined log format (timestamps normalised to UTC incl. timezone offset); malformed lines are counted, not fatal.
- Request targets are **iteratively URL-decoded** (up to 3 passes, tolerating malformed escapes) before matching, defeating double-encoding evasion such as `%253Cscript`.
- Signature rules: SQL injection, XSS, path traversal/LFI, command injection, Log4Shell/JNDI (also checked in User-Agent and Referer), sensitive-file probes, admin-panel probes, known scanner User-Agents (sqlmap, nikto, nmap...).
- Brute force: sliding window over failed (401/403) requests per IP+path; flags when the peak count in the window reaches a configurable threshold.
- Each IP gets a weighted risk score; benign IPs are omitted.
- `app.js` builds the DOM with `textContent` only, so hostile log content can't inject markup.

## Concepts demonstrated
Log analysis / SOC triage, OWASP injection classes, evasion via encoding, rate-based detection, indicators of compromise.

## Tests
`node projects/web-log-hunter/test.mjs`

## Limitations
Signature heuristics: false positives and negatives are possible, POST bodies aren't in access logs, successful exploitation isn't confirmed (check status/size), and attackers can use IP rotation or low-and-slow attempts that evade the window. Not a replacement for a WAF/SIEM.
