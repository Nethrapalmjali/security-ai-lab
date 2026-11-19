// Decision tree (CART) from scratch: Gini / entropy, numeric + categorical splits.
export function parseCSV(text) {
  const rows = []; let row = [], cell = '', q = false;
  const s = text.replace(/\r\n?/g, '\n');
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) {
      if (c === '"') { if (s[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cell.trim()); cell = ''; }
    else if (c === '\n') { row.push(cell.trim()); cell = ''; if (row.some(x => x !== '')) rows.push(row); row = []; }
    else cell += c;
  }
  row.push(cell.trim()); if (row.some(x => x !== '')) rows.push(row);
  if (rows.length < 2) throw new Error('Need a header row and at least one data row');
  const headers = rows[0];
  const data = rows.slice(1);
  data.forEach((r, i) => { if (r.length !== headers.length) throw new Error(`Row ${i + 2} has ${r.length} columns, expected ${headers.length}`); });
  return { headers, rows: data };
}

// Build dataset: target column index; numeric columns auto-detected.
export function prepare(headers, rows, target) {
  const feats = headers.map((h, i) => i).filter(i => i !== target);
  const types = {};
  for (const f of feats) types[f] = rows.every(r => r[f] !== '' && !isNaN(Number(r[f]))) ? 'num' : 'cat';
  const X = rows.map(r => feats.map(f => types[f] === 'num' ? Number(r[f]) : r[f]));
  const y = rows.map(r => r[target]);
  return { X, y, names: feats.map(f => headers[f]), types: feats.map(f => types[f]) };
}

export function impurity(counts, n, criterion = 'gini') {
  if (n === 0) return 0;
  let v = criterion === 'gini' ? 1 : 0;
  for (const k in counts) {
    const p = counts[k] / n;
    if (criterion === 'gini') v -= p * p; else if (p > 0) v -= p * Math.log2(p);
  }
  return v;
}
const count = (y, idx) => { const c = {}; for (const i of idx) c[y[i]] = (c[y[i]] || 0) + 1; return c; };
const majority = c => Object.keys(c).sort((a, b) => c[b] - c[a] || (a < b ? -1 : 1))[0];

function bestSplit(X, y, idx, types, criterion, minLeaf) {
  const n = idx.length, parent = impurity(count(y, idx), n, criterion);
  let best = null;
  for (let f = 0; f < types.length; f++) {
    const cands = [];
    if (types[f] === 'num') {
      const vals = [...new Set(idx.map(i => X[i][f]))].sort((a, b) => a - b);
      for (let k = 0; k < vals.length - 1; k++) cands.push((vals[k] + vals[k + 1]) / 2);
    } else for (const v of new Set(idx.map(i => X[i][f]))) cands.push(v);
    if (types[f] === 'cat' && cands.length < 2) continue;
    for (const t of cands) {
      const L = [], R = [];
      for (const i of idx) ((types[f] === 'num' ? X[i][f] <= t : X[i][f] === t) ? L : R).push(i);
      if (L.length < minLeaf || R.length < minLeaf) continue;
      const w = (L.length * impurity(count(y, L), L.length, criterion) + R.length * impurity(count(y, R), R.length, criterion)) / n;
      const gain = parent - w;
      if (gain > 1e-12 && (!best || gain > best.gain + 1e-12)) best = { f, t, gain, L, R };
    }
  }
  return best;
}

export function buildTree(X, y, types, { maxDepth = 4, minLeaf = 1, criterion = 'gini' } = {}) {
  const grow = (idx, depth) => {
    const counts = count(y, idx), n = idx.length;
    const node = { counts, n, label: majority(counts), impurity: impurity(counts, n, criterion) };
    if (depth >= maxDepth || Object.keys(counts).length === 1 || n < 2 * minLeaf) return node;
    const s = bestSplit(X, y, idx, types, criterion, minLeaf);
    if (!s) return node;
    node.feature = s.f; node.threshold = s.t; node.kind = types[s.f]; node.gain = s.gain * n;
    node.left = grow(s.L, depth + 1); node.right = grow(s.R, depth + 1);
    return node;
  };
  return grow(X.map((_, i) => i), 0);
}

export function predict(node, x) {
  while (node.left) {
    const yes = node.kind === 'num' ? x[node.feature] <= node.threshold : x[node.feature] === node.threshold;
    node = yes ? node.left : node.right;
  }
  return node.label;
}
export function predictPath(node, x, names) {
  const path = [];
  while (node.left) {
    const yes = node.kind === 'num' ? x[node.feature] <= node.threshold : x[node.feature] === node.threshold;
    path.push(`${condition(node, names)} → ${yes ? 'yes' : 'no'}`);
    node = yes ? node.left : node.right;
  }
  return { label: node.label, path, counts: node.counts };
}
export const condition = (node, names) => node.kind === 'num'
  ? `${names[node.feature]} <= ${+node.threshold.toFixed(4)}` : `${names[node.feature]} == ${node.threshold}`;

export function accuracy(tree, X, y) {
  if (!X.length) return NaN;
  return X.filter((x, i) => predict(tree, x) === y[i]).length / X.length;
}
export function confusion(tree, X, y) {
  const m = {};
  X.forEach((x, i) => { const p = predict(tree, x); (m[y[i]] ||= {})[p] = ((m[y[i]] || {})[p] || 0) + 1; });
  return m;
}
export function importance(tree, names) {
  const imp = names.map(() => 0);
  (function walk(n) { if (n.left) { imp[n.feature] += n.gain; walk(n.left); walk(n.right); } })(tree);
  const tot = imp.reduce((a, b) => a + b, 0) || 1;
  return names.map((name, i) => ({ name, value: imp[i] / tot })).sort((a, b) => b.value - a.value);
}
export function depth(n) { return n.left ? 1 + Math.max(depth(n.left), depth(n.right)) : 0; }
export function leaves(n) { return n.left ? leaves(n.left) + leaves(n.right) : 1; }
export function toRules(tree, names) {
  const out = [];
  (function walk(n, conds) {
    if (!n.left) { out.push(`IF ${conds.length ? conds.join(' AND ') : 'always'} THEN ${n.label}  (n=${n.n})`); return; }
    walk(n.left, [...conds, condition(n, names)]);
    const neg = n.kind === 'num' ? `${names[n.feature]} > ${+n.threshold.toFixed(4)}` : `${names[n.feature]} != ${n.threshold}`;
    walk(n.right, [...conds, neg]);
  })(tree, []);
  return out;
}

export function mulberry32(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
export function split(X, y, testFrac, seed = 1) {
  const rnd = mulberry32(seed), idx = X.map((_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
  const nt = Math.min(X.length - 1, Math.max(0, Math.round(X.length * testFrac)));
  const te = idx.slice(0, nt), tr = idx.slice(nt);
  return { Xtr: tr.map(i => X[i]), ytr: tr.map(i => y[i]), Xte: te.map(i => X[i]), yte: te.map(i => y[i]) };
}
