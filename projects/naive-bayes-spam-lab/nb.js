// Multinomial Naive Bayes text classifier with Laplace smoothing (pure logic, no DOM).
export function tokenize(text) {
  const t = String(text).toLowerCase()
    .replace(/https?:\/\/\S+/g, ' urltoken ')
    .replace(/\d+/g, ' numtoken ');
  return (t.match(/[a-z]+(?:'[a-z]+)*|[$!]/g) || []).filter(w => w.length > 1 || w === '!' || w === '$');
}

export class NaiveBayes {
  constructor(alpha = 1) {
    this.alpha = alpha;
    this.docs = {}; this.words = {}; this.total = {}; this.vocab = new Set();
  }
  train(text, label) {
    this.docs[label] = (this.docs[label] || 0) + 1;
    const w = (this.words[label] ||= {});
    for (const tok of tokenize(text)) {
      w[tok] = (w[tok] || 0) + 1;
      this.total[label] = (this.total[label] || 0) + 1;
      this.vocab.add(tok);
    }
  }
  get labels() { return Object.keys(this.docs); }
  logLikelihood(tok, label) {
    const c = this.words[label]?.[tok] || 0;
    return Math.log((c + this.alpha) / ((this.total[label] || 0) + this.alpha * this.vocab.size));
  }
  // Returns {label, probs:{label:p}, contributions:[{token, llr}]} (llr = log P(tok|spam)-log P(tok|ham))
  predict(text) {
    const labels = this.labels;
    const n = labels.reduce((s, l) => s + this.docs[l], 0);
    const toks = tokenize(text).filter(t => this.vocab.has(t));
    const scores = {};
    for (const l of labels) {
      let s = Math.log(this.docs[l] / n);
      for (const t of toks) s += this.logLikelihood(t, l);
      scores[l] = s;
    }
    const max = Math.max(...Object.values(scores));
    let z = 0; const probs = {};
    for (const l of labels) { probs[l] = Math.exp(scores[l] - max); z += probs[l]; }
    for (const l of labels) probs[l] /= z;
    const label = labels.reduce((a, b) => (probs[a] >= probs[b] ? a : b));
    const contributions = [...new Set(toks)].map(token => ({
      token, llr: this.logLikelihood(token, 'spam') - this.logLikelihood(token, 'ham'),
    })).sort((a, b) => Math.abs(b.llr) - Math.abs(a.llr));
    return { label, probs, contributions };
  }
  topWords(label, k = 10) {
    const other = label === 'spam' ? 'ham' : 'spam';
    return [...this.vocab].map(token => ({ token, score: this.logLikelihood(token, label) - this.logLikelihood(token, other) }))
      .sort((a, b) => b.score - a.score).slice(0, k);
  }
}

// Deterministic shuffle (mulberry32) so splits are reproducible.
export function shuffle(arr, seed = 42) {
  const a = arr.slice(); let s = seed >>> 0;
  const rnd = () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

export function evaluate(data, testFrac = 0.3, seed = 42, alpha = 1) {
  const s = shuffle(data, seed);
  const nTest = Math.max(1, Math.round(s.length * testFrac));
  const test = s.slice(0, nTest), train = s.slice(nTest);
  const nb = new NaiveBayes(alpha);
  for (const d of train) nb.train(d.text, d.label);
  let tp = 0, fp = 0, tn = 0, fn = 0;
  for (const d of test) {
    const p = nb.predict(d.text).label;
    if (p === 'spam' && d.label === 'spam') tp++;
    else if (p === 'spam') fp++;
    else if (d.label === 'ham') tn++;
    else fn++;
  }
  const accuracy = (tp + tn) / test.length;
  const precision = tp + fp ? tp / (tp + fp) : 0;
  const recall = tp + fn ? tp / (tp + fn) : 0;
  const f1 = precision + recall ? 2 * precision * recall / (precision + recall) : 0;
  return { tp, fp, tn, fn, accuracy, precision, recall, f1, nTrain: train.length, nTest: test.length };
}
