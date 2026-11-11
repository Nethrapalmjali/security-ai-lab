import assert from 'node:assert/strict';
import { tokenize, NaiveBayes, shuffle, evaluate } from './nb.js';
import { SAMPLE } from './data.js';

assert.deepEqual(tokenize('Win! $100 NOW at http://x.example'), ['win', '!', '$', 'numtoken', 'now', 'at', 'urltoken']);
assert.deepEqual(tokenize(''), []);

// Hand-checked: 1 spam doc "free free", 1 ham doc "hello", alpha=1, vocab=2
const nb = new NaiveBayes(1);
nb.train('free free', 'spam'); nb.train('hello', 'ham');
assert.ok(Math.abs(nb.logLikelihood('free', 'spam') - Math.log(3 / 4)) < 1e-12);
assert.ok(Math.abs(nb.logLikelihood('free', 'ham') - Math.log(1 / 3)) < 1e-12);
const r = nb.predict('free');
assert.equal(r.label, 'spam');
assert.ok(Math.abs(r.probs.spam + r.probs.ham - 1) < 1e-12);
// posterior = (.5*.75) / (.5*.75 + .5*(1/3))
assert.ok(Math.abs(r.probs.spam - 0.375 / (0.375 + 1 / 6)) < 1e-12);

// shuffle is deterministic and a permutation
assert.deepEqual(shuffle([1,2,3,4,5,6], 7), shuffle([1,2,3,4,5,6], 7));
assert.deepEqual(shuffle([1,2,3,4,5,6], 7).sort(), [1,2,3,4,5,6]);

// Full model sanity on the bundled corpus
const full = new NaiveBayes();
for (const d of SAMPLE) full.train(d.text, d.label);
assert.equal(full.predict('Congratulations! Click here to claim your free prize now').label, 'spam');
assert.equal(full.predict('Can we meet for lunch tomorrow? Bring the lab notes').label, 'ham');
const ev = evaluate(SAMPLE, 0.3, 1);
assert.equal(ev.tp + ev.fp + ev.tn + ev.fn, ev.nTest);
assert.ok(ev.accuracy >= 0.75, 'accuracy ' + ev.accuracy);
console.log('all tests passed; held-out accuracy', ev.accuracy.toFixed(2));
