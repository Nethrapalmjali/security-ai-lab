// Pure extractive summarisation (TextRank, Mihalcea & Tarau 2004). No DOM.

export const STOP = new Set(("a an and are as at be by for from has have he her his i in is it its of on or she that the their they this to was we were will with you your not but if so than then there these those which who what when where while about into over under also can could would should do does did been being am our us them him my me no yes").split(" "));

/** Split text into sentences, keeping common abbreviations intact. */
export function splitSentences(text) {
  const t = text.replace(/\s+/g, " ").trim();
  if (!t) return [];
  const prot = t.replace(/\b(Mr|Mrs|Ms|Dr|Prof|Sr|Jr|St|vs|etc|e\.g|i\.e|U\.S|No)\./g, (m) => m.replace(/\./g, "\u0000"));
  const parts = prot.match(/[^.!?]+(?:[.!?]+["')\]]*|$)/g) || [];
  return parts.map((s) => s.replace(/\u0000/g, ".").trim()).filter((s) => /\w/.test(s));
}

/** Lowercase content words, light suffix stripping. */
export function tokens(s) {
  return (s.toLowerCase().match(/[a-z0-9]+(?:'[a-z]+)?/g) || [])
    .filter((w) => !STOP.has(w) && w.length > 1)
    .map((w) => w.replace(/(ing|ed|es|s)$/, (m, _x, i) => (w.length - m.length >= 3 ? "" : m)));
}

/** Sentence similarity: shared words / (log|A| + log|B|), as in the TextRank paper. */
export function similarity(a, b) {
  if (a.length < 2 || b.length < 2) return 0;
  const sb = new Set(b);
  let common = 0;
  for (const w of new Set(a)) if (sb.has(w)) common++;
  return common / (Math.log(a.length) + Math.log(b.length));
}

/** Weighted PageRank by power iteration. Returns scores that sum to ~1. */
export function pageRank(W, d = 0.85, iters = 100, tol = 1e-8) {
  const n = W.length;
  if (!n) return [];
  const out = W.map((row) => row.reduce((s, x) => s + x, 0));
  let r = new Array(n).fill(1 / n);
  for (let it = 0; it < iters; it++) {
    // dangling nodes spread their mass uniformly
    const dangling = r.reduce((s, x, i) => (out[i] === 0 ? s + x : s), 0);
    const nr = r.map((_, i) => {
      let s = 0;
      for (let j = 0; j < n; j++) if (out[j] > 0 && W[j][i] > 0) s += (r[j] * W[j][i]) / out[j];
      return (1 - d) / n + d * (s + dangling / n);
    });
    const delta = nr.reduce((s, x, i) => s + Math.abs(x - r[i]), 0);
    r = nr;
    if (delta < tol) break;
  }
  return r;
}

/** Build similarity graph for sentences. */
export function buildGraph(sentences) {
  const tk = sentences.map(tokens);
  return sentences.map((_, i) => sentences.map((__, j) => (i === j ? 0 : similarity(tk[i], tk[j]))));
}

/** Summarise: returns {sentences, scores, picked (indices in original order)}. */
export function summarize(text, count = 3) {
  const sentences = splitSentences(text);
  const W = buildGraph(sentences);
  const scores = pageRank(W);
  const n = Math.max(0, Math.min(count, sentences.length));
  const picked = scores.map((s, i) => [s, i]).sort((a, b) => b[0] - a[0] || a[1] - b[1]).slice(0, n).map((x) => x[1]).sort((a, b) => a - b);
  return { sentences, scores, picked };
}
