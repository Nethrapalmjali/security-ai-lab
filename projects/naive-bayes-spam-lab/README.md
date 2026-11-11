# Naive Bayes Spam Lab

An in-browser spam classifier you can train, interrogate and evaluate. No backend, no libraries, no network calls.

**Live:** https://nethrapalmjali.github.io/security-ai-lab/projects/naive-bayes-spam-lab/

## What it does
- Classifies a message as spam / not spam with a probability.
- Shows per-word evidence (log-likelihood ratios), so the model is explainable.
- Online learning: add your own messages as spam or ham and re-classify.
- Evaluates on a reproducible 70/30 split: accuracy, precision, recall, F1, confusion matrix.
- Lists the most spam- and ham-indicative words.

## How it works
Multinomial Naive Bayes: `argmax_c log P(c) + Σ log P(w|c)` with Laplace (add-α) smoothing, computed in log space and normalised with a max-shift (softmax) for stable probabilities. The tokenizer lower-cases text and collapses URLs and numbers into `urltoken` / `numtoken` (strong phishing signals). Splits use a seeded mulberry32 shuffle. Logic lives in `nb.js` (pure, tested); `app.js` only renders, using `textContent` for all user input.

## Concepts demonstrated
Bayes' rule and the conditional-independence assumption, smoothing, class priors, explainable ML, train/test splits, confusion matrices, and spam/phishing feature signals.

## Tests
`node test.mjs` — hand-verified likelihoods and posterior, tokenizer, deterministic shuffle, end-to-end sanity.

## Limitations
The corpus is tiny (40 synthetic messages), so scores are illustrative, not production-grade. Bag-of-words ignores word order and sender/header signals; 12-message test sets are noisy.
