# BPE Tokenizer Lab

Train a byte-level Byte Pair Encoding (BPE) tokenizer in the browser and watch text collapse into tokens as merges are learned.

## How it works
1. **Pre-tokenise** the corpus GPT-2 style (letters, digits, punctuation, whitespace; words keep their leading space) so merges never cross word boundaries.
2. Convert each distinct word to UTF-8 bytes (base vocabulary of 256 tokens, so *any* input is encodable, even emoji).
3. **Train:** repeatedly count adjacent token pairs (weighted by word frequency), merge the most frequent (ties broken deterministically), and record it. Stops at the merge limit or when no pair occurs twice.
4. **Encode:** apply the learned merges in training order to each pre-token. **Decode:** concatenate token bytes and decode UTF-8.
5. A slider/animation re-encodes with the first *k* merges so you can see the vocabulary grow.

## Concepts demonstrated
Subword tokenisation, why LLMs split rare words into pieces, vocabulary size vs. sequence length trade-off, byte-level fallback (no unknown tokens), lossless round-trips. Also relevant to security: token-boundary quirks matter for prompt-injection filters and token-based content limits.

## Tests
`node projects/bpe-tokenizer-lab/test.mjs` covers pre-tokenisation, a hand-checked merge sequence, determinism, monotonic compression, and lossless round-trips on multi-byte UTF-8.

## Limitations
Educational scale: the training is O(merges × corpus words) with no incremental pair index, no special tokens, and no regex identical to GPT-4's. Token labels for partial UTF-8 sequences are shown as `<0xNN>`. All text is rendered via `textContent`.
