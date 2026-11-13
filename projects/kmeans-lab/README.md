# K-Means Clustering Lab

Interactive, step-by-step k-means clustering that runs 100% in the browser (vanilla JS, no dependencies).

**Live:** https://nethrapalmjali.github.io/security-ai-lab/projects/kmeans-lab/

## What it does
- Visualise Lloyd's algorithm: initialise, then step through assign → update until convergence.
- Datasets: blobs, moons, rings, uniform; click to add points; paste your own `x,y` CSV.
- Choose k, k-means++ or random initialisation, and a seed (deterministic, reproducible runs).
- Live inertia (SSE) and mean silhouette score; elbow + silhouette table for k = 1…8 to help pick k.

## How it works
`kmeans.js` holds pure logic: a seeded Mulberry32 RNG, k-means++ seeding (D² sampling), assignment, centroid update (empty clusters keep their position), inertia, O(n²) silhouette, and best-of-5 elbow runs. `app.js` renders to a canvas and builds the DOM with `textContent` only.

## Concepts demonstrated
Unsupervised learning, expectation–maximisation-style optimisation, local minima and seed sensitivity, cluster validity metrics. (Clustering is also widely used in security for log/malware-family grouping.)

## Tests
`node projects/kmeans-lab/test.mjs` — covers CSV parsing, normalisation, assignment/update, monotonic inertia, cluster recovery, silhouette values, edge cases.

## Limitations
2-D only; assumes roughly spherical, similar-size clusters (it fails on rings/moons — try them); silhouette is O(n²), fine for a few hundred points; Euclidean distance only.
