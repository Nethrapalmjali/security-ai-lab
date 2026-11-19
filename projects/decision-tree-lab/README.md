# Decision Tree Lab

Train an explainable CART decision tree on your own CSV, entirely in the browser.

**Live:** https://nethrapalmjali.github.io/security-ai-lab/projects/decision-tree-lab/

## What it does
- Paste or load a CSV, choose the column to predict, tune depth / min leaf size / criterion / test split.
- Shows the tree as an SVG diagram, human-readable IF/THEN rules, feature importance, train/test accuracy and a what-if predictor that prints the decision path.
- Built-in examples: phishing-email features, a numeric flower dataset and suspicious-login triage.

## How it works
- RFC-4180-style CSV parser (quotes, escaped quotes, CRLF) with row-width validation.
- Columns are auto-typed numeric or categorical.
- Greedy CART: numeric splits test midpoints between sorted unique values (`<=`); categorical splits test one-vs-rest (`==`). The split with the highest impurity decrease (Gini or entropy) wins; growth stops at max depth, pure nodes, or when the min-leaf constraint blocks a split.
- Deterministic seeded shuffle (mulberry32) for the train/test split.
- Feature importance = normalised weighted impurity decrease per feature.
- All user text is inserted via `textContent` / SVG text nodes.

## Concepts demonstrated
Supervised learning, impurity measures, overfitting (raise depth, watch train vs test accuracy), interpretable ML for security triage (phishing, login risk).

## Tests
`node projects/decision-tree-lab/test.mjs` covers CSV parsing, impurity, split selection, depth limits, min-leaf, rules, importance and split determinism.

## Limitations
Greedy splitting cannot learn XOR-style interactions at depth 1; no pruning, missing-value handling or ensembles; tiny datasets give noisy test accuracy; categorical splits are binary one-vs-rest.
