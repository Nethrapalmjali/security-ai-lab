# Isolation Forest Anomaly Lab

An unsupervised anomaly detector built from scratch in vanilla JavaScript. Pick a security-flavoured dataset (or paste your own CSV), grow a forest of random isolation trees and see every point's anomaly score plus a heat map of the whole feature space. Runs 100% in the browser; nothing is uploaded.

**Live:** https://nethrapalmjali.github.io/security-ai-lab/projects/isolation-forest-lab/

## What it does
- Datasets: login telemetry with credential-stuffing and targeted-guessing accounts, Gaussian blob + outliers, anomalies between two clusters, and a ring with a hole.
- Controls: number of trees, subsample size ψ, flag-top-% threshold, seed. Click the plot to add a point and see its score instantly.
- Labelled demos report ROC AUC, precision and recall (labels are used only for grading, never for training).
- Paste any numeric CSV; all columns feed the forest, two chosen columns are plotted.

## How it works
1. Each tree is built on a random subsample of ψ points by repeatedly choosing a random feature and a random split value between its min and max, until points are isolated or depth `ceil(log2 ψ)` is reached.
2. Anomalies sit in sparse regions, so they are isolated after fewer splits (short path length).
3. Score: `s(x) = 2^(-E[h(x)] / c(ψ))`, where `c(n) = 2H(n-1) - 2(n-1)/n` is the average path length of an unsuccessful BST search (Liu, Ting & Zhou, 2008). Unexpanded leaves add `c(size)`.
4. Columns are min-max scaled so no feature dominates; a seeded PRNG (mulberry32) makes runs reproducible.

## Concepts demonstrated
Unsupervised anomaly detection, ensemble methods, random subsampling, contamination thresholds, ROC AUC, precision/recall trade-offs; applied to intrusion / account-takeover detection (credential stuffing shows up as huge volume with a near-100% failure rate).

## Tests
`node projects/isolation-forest-lab/test.mjs` covers c(n), PRNG determinism, sampling, tree building, path lengths, scoring, thresholds, CSV parsing, normalisation, evaluation metrics, AUC and end-to-end AUC on every demo dataset.

## Limitations
Axis-parallel splits give rectangular artefacts in the heat map; high-dimensional CSVs are plotted in only two dimensions (other dimensions are held at the median for the heat map); demo data is synthetic; the threshold is a percentile, not a calibrated probability.
