# K-Means Clustering Lab

Interactive, step-by-step visualiser for k-means clustering. Runs 100% client-side (vanilla JS, canvas + SVG, no dependencies).

**Live:** https://nethrapalmjali.github.io/security-ai-lab/projects/kmeans-clustering-lab/

## What it does
- Click the canvas to add points, or load Blobs / Moons / Rings / Uniform datasets.
- Choose k and the initialisation (random points vs k-means++), then **Step** or **Run** Lloyd's algorithm and watch assignments and centroids change.
- Live iteration count, inertia (SSE) and mean silhouette score; an elbow plot compares k = 1…8.

## How it works
`kmeans.js` holds the pure logic: seeded PRNG (mulberry32), k-means++ seeding (D² sampling), assignment, centroid update (empty clusters keep their position), inertia, silhouette coefficient (O(n²)) and best-of-5 elbow curves. `app.js` is the UI; user data is never inserted as HTML.

## Concepts demonstrated
Unsupervised learning, Lloyd's algorithm and its monotone-decreasing objective, local optima and initialisation sensitivity, model selection (elbow, silhouette), and the limits of convex-cluster assumptions.

## Tests
`node test.mjs` checks hand-computed assignments/updates, monotone inertia, recovery of known blobs, elbow and silhouette behaviour, and edge cases.

## Limitations
2-D data only, Euclidean distance, no feature scaling; silhouette is disabled above 400 points for speed. K-means cannot separate non-convex shapes (Moons, Rings) — by design, to show why.
