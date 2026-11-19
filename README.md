# Security & AI Lab

A growing collection of small, self-contained web tools focused on **cybersecurity** and **applied AI**. Every project runs entirely in the browser — no data leaves your machine.

**Live site:** https://nethrapalmjali.github.io/security-ai-lab/

## Projects

<!-- PROJECTS:START -->
- **[JWT Inspector & Weakness Checker](projects/jwt-inspector/)** — Decode a JSON Web Token and audit it for weak secrets, alg:none, risky headers and missing claims, entirely in the browser. · [Live](https://nethrapalmjali.github.io/security-ai-lab/projects/jwt-inspector/)
- **[Naive Bayes Spam Lab](projects/naive-bayes-spam-lab/)** — Train an explainable Naive Bayes spam classifier in the browser, teach it new messages and evaluate it on held-out data. · [Live](https://nethrapalmjali.github.io/security-ai-lab/projects/naive-bayes-spam-lab/)
- **[CSP Policy Evaluator](projects/csp-evaluator/)** — Grade a Content-Security-Policy header for XSS, clickjacking and allowlist-bypass weaknesses, with concrete fixes, entirely in the browser. · [Live](https://nethrapalmjali.github.io/security-ai-lab/projects/csp-evaluator/)
- **[K-Means Clustering Lab](projects/kmeans-lab/)** — Step through k-means clustering with k-means++ seeding, elbow and silhouette analysis, click-to-add points and CSV import, entirely in the browser. · [Live](https://nethrapalmjali.github.io/security-ai-lab/projects/kmeans-lab/)
- **[Web Log Threat Hunter](projects/web-log-hunter/)** — Paste Apache/nginx access logs to detect SQLi, XSS, traversal, Log4Shell, scanners and brute-force bursts with per-IP risk scoring, entirely in the browser. · [Live](https://nethrapalmjali.github.io/security-ai-lab/projects/web-log-hunter/)
- **[TextRank Summarizer](projects/textrank-summarizer/)** — Summarise any text with TextRank: PageRank over a sentence-similarity graph, with per-sentence centrality scores, entirely in the browser. · [Live](https://nethrapalmjali.github.io/security-ai-lab/projects/textrank-summarizer/)
- **[Email Header Analyzer (SPF/DKIM/DMARC)](projects/email-header-analyzer/)** — Paste raw email headers to check SPF/DKIM/DMARC results, spoofing and phishing indicators and the forensic delivery path, entirely in the browser. · [Live](https://nethrapalmjali.github.io/security-ai-lab/projects/email-header-analyzer/)
- **[K-Means Clustering Lab](projects/kmeans-clustering-lab/)** — Step through k-means clustering interactively, compare random vs k-means++ initialisation and pick k with the elbow method and silhouette score. · [Live](https://nethrapalmjali.github.io/security-ai-lab/projects/kmeans-clustering-lab/)
- **[TOTP / HOTP Lab](projects/totp-lab/)** — Generate and verify RFC 6238 one-time passwords with Web Crypto, audit 2FA settings and build otpauth:// URIs, entirely in the browser. · [Live](https://nethrapalmjali.github.io/security-ai-lab/projects/totp-lab/)
- **[Decision Tree Lab](projects/decision-tree-lab/)** — Train an explainable CART decision tree on your own CSV with a visual tree, rules, feature importance and what-if predictions, entirely in the browser. · [Live](https://nethrapalmjali.github.io/security-ai-lab/projects/decision-tree-lab/)
<!-- PROJECTS:END -->

## Structure

```
projects/<slug>/index.html   # each tool, standalone
projects/<slug>/README.md    # what it does, how it works
projects.json                # catalogue used by the landing page
index.html                   # landing page
```

Deployed automatically to GitHub Pages on every push to `main`.

## License

MIT
