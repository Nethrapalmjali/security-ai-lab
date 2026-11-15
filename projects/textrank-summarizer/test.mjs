import assert from "node:assert/strict";
import { splitSentences, tokens, similarity, pageRank, summarize } from "./textrank.js";

assert.deepEqual(splitSentences("Hello world. How are you? Fine!"), ["Hello world.", "How are you?", "Fine!"]);
assert.equal(splitSentences("Dr. Smith went home. He slept.").length, 2);
assert.equal(splitSentences("   ").length, 0);
assert.equal(splitSentences("No terminator here").length, 1);
assert.ok(!tokens("The cats are running").includes("the"));
assert.deepEqual(tokens("cats running"), ["cat", "runn"]);
assert.equal(similarity(["a1", "b1"], ["c1", "d1"]), 0);
assert.ok(similarity(["cat", "dog"], ["cat", "dog"]) > 0.9);
assert.equal(similarity(["x"], ["x"]), 0);

// PageRank: symmetric graph -> equal scores; hub gets highest
const sym = [[0, 1, 1], [1, 0, 1], [1, 1, 0]];
const r = pageRank(sym);
assert.ok(Math.abs(r.reduce((s, x) => s + x, 0) - 1) < 1e-6);
assert.ok(Math.abs(r[0] - r[1]) < 1e-9);
const star = [[0, 1, 1, 1], [1, 0, 0, 0], [1, 0, 0, 0], [1, 0, 0, 0]];
const rs = pageRank(star);
assert.ok(rs[0] > rs[1] && Math.abs(rs[1] - rs[2]) < 1e-9);
assert.deepEqual(pageRank([]), []);
// all-isolated graph still terminates and is uniform
const iso = pageRank([[0, 0], [0, 0]]);
assert.ok(Math.abs(iso[0] - 0.5) < 1e-9);

// summariser picks the central sentence and keeps original order
const text = "Solar power converts sunlight into electricity using solar panels. " +
  "Solar panels are made of photovoltaic cells that convert sunlight. " +
  "My cat likes to sleep. " +
  "Electricity from solar power reduces carbon emissions. " +
  "Photovoltaic cells in solar panels generate electricity from sunlight.";
const s = summarize(text, 2);
assert.equal(s.picked.length, 2);
assert.ok(!s.picked.includes(2), "off-topic sentence must not be picked");
assert.deepEqual(s.picked, [...s.picked].sort((a, b) => a - b));
assert.equal(summarize("One sentence.", 5).picked.length, 1);
assert.equal(summarize("", 3).picked.length, 0);
console.log("all tests passed");
