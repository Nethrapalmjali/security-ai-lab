# Neural Network Playground

Train a small feed-forward neural network entirely in your browser and watch its decision boundary evolve.

**Live:** https://nethrapalmjali.github.io/security-ai-lab/projects/neural-net-playground/

## What it does
- Four 2D binary-classification datasets (circle, XOR, spiral, linear blobs) with adjustable noise.
- Configurable hidden layers, activation (tanh / ReLU / sigmoid / linear), learning rate and L2 regularisation.
- Selectable input features (x, y, x², y², xy, sin 3x, sin 3y) to show how feature engineering replaces depth.
- Live decision-boundary heat map, train vs. held-out test points, loss curves and accuracy.

## How it works
`nn.js` implements a multilayer perceptron from scratch: Xavier initialisation, forward pass, backpropagation with a sigmoid output and binary cross-entropy (output delta = ŷ − y), mini-batch SGD (batch 16) and optional L2 weight decay. Datasets and the 70/30 split are generated with a seeded PRNG (mulberry32) so runs are reproducible.

## Concepts demonstrated
Backpropagation, activation functions, non-linear separability, overfitting (train/test loss gap), regularisation, feature engineering.

## Tests
`node projects/neural-net-playground/test.mjs` — verifies backprop against numerical gradients (tanh, ReLU, sigmoid), that the network learns XOR, that a linear model fails XOR but succeeds with an xy feature, determinism and utility functions.

## Limitations
Binary classification on 2D toy data only; plain SGD (no momentum/Adam); no weight visualisation per neuron. Serve over HTTP (ES modules do not load from `file://`).
