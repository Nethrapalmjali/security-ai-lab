// Byte-level Byte Pair Encoding (BPE), the tokenizer family used by GPT-style LLMs.
const enc = new TextEncoder();
const dec = new TextDecoder("utf-8", { fatal: false });

export function utf8(str) { return Array.from(enc.encode(str)); }

// GPT-2 style pre-tokenisation: words keep their leading space; merges never cross these boundaries.
export function pretokenize(text) {
  return text.match(/ ?\p{L}+| ?\p{N}+| ?[^\s\p{L}\p{N}]+|\s+(?!\S)|\s+/gu) || [];
}

// Train: returns { merges:[{a,b,id,count}], vocab:[number[]] } (vocab[id] = bytes the token expands to).
export function train(text, numMerges) {
  const vocab = Array.from({ length: 256 }, (_, i) => [i]);
  const freq = new Map();
  for (const w of pretokenize(text)) freq.set(w, (freq.get(w) || 0) + 1);
  let words = [...freq].map(([w, n]) => ({ ids: utf8(w), n }));
  const merges = [];
  while (merges.length < numMerges) {
    const pairs = new Map();
    for (const { ids, n } of words)
      for (let i = 0; i < ids.length - 1; i++) {
        const k = ids[i] + "," + ids[i + 1];
        pairs.set(k, (pairs.get(k) || 0) + n);
      }
    let best = null, bc = 0;
    for (const [k, c] of pairs) {
      if (c > bc || (c === bc && best !== null && cmpKey(k, best) < 0)) { best = k; bc = c; }
    }
    if (best === null || bc < 2) break; // nothing worth merging
    const [a, b] = best.split(",").map(Number);
    const id = vocab.length;
    vocab.push(vocab[a].concat(vocab[b]));
    merges.push({ a, b, id, count: bc });
    for (const w of words) w.ids = applyMerge(w.ids, a, b, id);
  }
  return { merges, vocab };
}

function cmpKey(x, y) {
  const [a1, b1] = x.split(",").map(Number), [a2, b2] = y.split(",").map(Number);
  return a1 - a2 || b1 - b2;
}

function applyMerge(ids, a, b, id) {
  const out = [];
  for (let i = 0; i < ids.length; i++) {
    if (i < ids.length - 1 && ids[i] === a && ids[i + 1] === b) { out.push(id); i++; } else out.push(ids[i]);
  }
  return out;
}

// Encode using the first `limit` merges (default all). Merges apply in training order, as in GPT-2/tiktoken.
export function encode(text, model, limit = model.merges.length) {
  const out = [];
  for (const w of pretokenize(text)) {
    let ids = utf8(w);
    for (let m = 0; m < limit && ids.length > 1; m++) {
      const { a, b, id } = model.merges[m];
      ids = applyMerge(ids, a, b, id);
    }
    out.push(...ids);
  }
  return out;
}

export function decode(ids, model) {
  const bytes = [];
  for (const id of ids) {
    if (!model.vocab[id]) throw new RangeError("unknown token id " + id);
    bytes.push(...model.vocab[id]);
  }
  return dec.decode(new Uint8Array(bytes));
}

// Printable label for a token: spaces -> ·, newline -> ↵, partial UTF-8 bytes -> <0xNN>.
export function label(id, model) {
  const bytes = model.vocab[id];
  const s = new TextDecoder("utf-8", { fatal: true });
  try {
    return s.decode(new Uint8Array(bytes)).replace(/ /g, "·").replace(/\n/g, "↵").replace(/\t/g, "⇥");
  } catch {
    return bytes.map(b => "<0x" + b.toString(16).toUpperCase().padStart(2, "0") + ">").join("");
  }
}

export function stats(text, ids) {
  const bytes = utf8(text).length;
  return { bytes, tokens: ids.length, bytesPerToken: ids.length ? bytes / ids.length : 0 };
}
