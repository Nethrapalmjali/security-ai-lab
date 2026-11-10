# Security & AI Lab

A growing collection of small, self-contained web tools focused on **cybersecurity** and **applied AI**. Every project runs entirely in the browser — no data leaves your machine.

**Live site:** https://nethrapalmjali.github.io/security-ai-lab/

## Projects

<!-- PROJECTS:START -->
- **[JWT Inspector & Weakness Checker](projects/jwt-inspector/)** — Decode a JSON Web Token and audit it for weak secrets, alg:none, risky headers and missing claims, entirely in the browser. · [Live](https://nethrapalmjali.github.io/security-ai-lab/projects/jwt-inspector/)
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
