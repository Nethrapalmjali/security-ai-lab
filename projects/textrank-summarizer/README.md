# TextRank Summarizer

Extractive text summarisation in the browser using the TextRank algorithm.

## How it works
1. Split text into sentences (abbreviation-aware).
2. Tokenise: lowercase, drop stop words, light suffix stripping.
3. Build a weighted graph; edge weight = shared words / (log|A| + log|B|).
4. Run weighted PageRank (damping 0.85, power iteration, dangling-node handling).
5. Return the top-N sentences in original order; all sentences are shown with their centrality bars.

## Concepts demonstrated
Graph-based unsupervised NLP, PageRank, text preprocessing, extractive vs abstractive summarisation.

## Tests
`node projects/textrank-summarizer/test.mjs`

## Limitations
English only; lexical overlap (no semantics/embeddings); crude stemmer; extractive, so sentences may lack context. All text is rendered via `textContent` and never leaves the browser.
