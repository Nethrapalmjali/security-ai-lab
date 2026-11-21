import assert from "node:assert/strict";
import { utf8, pretokenize, train, encode, decode, label, stats } from "./bpe.js";

assert.deepEqual(pretokenize("Hello, world 42!"), ["Hello", ",", " world", " 42", "!"]);
assert.equal(pretokenize("a  b").join(""), "a  b"); // lossless split
assert.deepEqual(utf8("é"), [0xc3, 0xa9]);

// Deterministic tiny corpus: "ab" x3 -> (a,b) is the first merge, then (space,ab)
const m = train("ab ab ab", 5);
assert.equal(m.merges[0].a, 97); assert.equal(m.merges[0].b, 98); assert.equal(m.merges[0].count, 3);
assert.equal(m.merges[0].id, 256);
assert.deepEqual(m.vocab[256], [97, 98]);
assert.equal(m.merges[1].a, 32); assert.equal(m.merges[1].b, 256); // " ab"
assert.equal(m.merges.length, 2); // stops: no pair repeats afterwards
assert.deepEqual(encode("ab ab ab", m), [256, 257, 257]);
assert.equal(encode("ab ab ab", m, 0).length, 8);
assert.equal(encode("ab ab ab", m, 1).length, 5);

// Round-trip on arbitrary text, including text unseen in training and multi-byte UTF-8 / emoji
const corpus = "the cat sat on the mat. the cat ate the rat. the rat ran. ".repeat(5);
const model = train(corpus, 40);
for (const t of ["the cat", "unseen WORDS 123 !?", "héllo wörld 日本語 🚀", "", "  \n\t x"]) {
  assert.equal(decode(encode(t, model), model), t);
}
// More merges never increase token count; vocab size = 256 + merges
let prev = Infinity;
for (let k = 0; k <= model.merges.length; k++) {
  const n = encode(corpus, model, k).length;
  assert.ok(n <= prev); prev = n;
}
assert.equal(model.vocab.length, 256 + model.merges.length);
assert.ok(encode(corpus, model).length < utf8(corpus).length / 2);
// Determinism
assert.deepEqual(train(corpus, 40).merges, model.merges);
// Labels
assert.equal(label(32, model), "·");
assert.equal(label(0xc3, model), "<0xC3>");
assert.equal(label(model.merges[0].id, model).length > 0, true);
assert.throws(() => decode([99999], model), RangeError);
const s = stats("abcd", [1, 2]); assert.equal(s.bytesPerToken, 2);
assert.equal(stats("", []).bytesPerToken, 0);
console.log("bpe tests passed");
