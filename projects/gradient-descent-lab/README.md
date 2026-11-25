# Gradient Descent Optimizer Race

Race six optimisers from the same start point across classic 2-D loss surfaces and watch how each moves.

**Live:** https://nethrapalmjali.github.io/security-ai-lab/projects/gradient-descent-lab/

## What it does
- Surfaces: ill-conditioned bowl, Rosenbrock valley, Beale, Himmelblau (4 minima), a saddle point and Rastrigin (many local minima).
- Optimisers: SGD, Momentum, Nesterov, AdaGrad, RMSProp, Adam, each with its own editable learning rate, plus a shared β and optional gradient-norm clipping.
- Click the heat map to move the start point; live trails, per-optimiser loss, distance to the nearest true minimum, and convergence/divergence status.

## How it works
`opt.js` holds the pure logic: analytic gradients for every surface and a stateful `createOptimizer` implementing each update rule (including Adam's bias correction and Nesterov's look-ahead gradient). Divergence (NaN or |x| > 1e4) is detected and the run stopped. `app.js` renders a log-scaled loss heat map with contour bands on a canvas and animates with `requestAnimationFrame`. All DOM text uses `textContent`.

## Concepts demonstrated
Learning-rate sensitivity, ill-conditioning, momentum and overshoot, adaptive per-parameter step sizes, saddle points, local minima, gradient clipping and divergence.

## Tests
`node projects/gradient-descent-lab/test.mjs` — checks every analytic gradient against finite differences, hand-computed single steps for all six optimisers, convergence on several surfaces, saddle fixed points and escape, distinct Himmelblau minima, divergence detection and clipping.

## Limitations
Deterministic full-gradient descent on 2-D toy functions (no stochastic mini-batch noise), no learning-rate schedules, and some default rates leave slow optimisers (e.g. SGD on Beale) unfinished after a few thousand steps. Serve over HTTP (ES modules do not load from `file://`).
