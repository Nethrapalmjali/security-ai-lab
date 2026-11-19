import assert from 'node:assert/strict';
import * as T from './tree.js';

// CSV
const c = T.parseCSV('a,b,c\n1,"x,y",z\r\n2,"q ""w""",e\n');
assert.deepEqual(c.headers, ['a', 'b', 'c']);
assert.deepEqual(c.rows[0], ['1', 'x,y', 'z']);
assert.equal(c.rows[1][1], 'q "w"');
assert.throws(() => T.parseCSV('a,b\n1'), /columns/);
assert.throws(() => T.parseCSV('a,b'), /header/);

// impurity
assert.equal(T.impurity({ a: 5, b: 5 }, 10), 0.5);
assert.equal(T.impurity({ a: 10 }, 10), 0);
assert.equal(T.impurity({ a: 5, b: 5 }, 10, 'entropy'), 1);

// numeric separable data
const rows = [['1', 'no'], ['2', 'no'], ['3', 'no'], ['10', 'yes'], ['11', 'yes'], ['12', 'yes']];
const d = T.prepare(['x', 'cls'], rows, 1);
assert.deepEqual(d.types, ['num']);
const t = T.buildTree(d.X, d.y, d.types, { maxDepth: 3 });
assert.equal(t.threshold, 6.5);
assert.equal(t.kind, 'num');
assert.equal(T.accuracy(t, d.X, d.y), 1);
assert.equal(T.predict(t, [0]), 'no');
assert.equal(T.predict(t, [100]), 'yes');
assert.equal(T.depth(t), 1); assert.equal(T.leaves(t), 2);
assert.equal(T.toRules(t, d.names).length, 2);
assert.equal(T.importance(t, d.names)[0].value, 1);

// categorical: needs depth 2 (out=1 only when u==b and v==p)
const xr = [['a', 'p', '0'], ['a', 'q', '0'], ['b', 'p', '1'], ['b', 'q', '0'], ['a', 'p', '0'], ['b', 'q', '0'], ['a', 'q', '0'], ['b', 'p', '1']];
const dx = T.prepare(['u', 'v', 'out'], xr, 2);
assert.deepEqual(dx.types, ['cat', 'cat']);
const t1 = T.buildTree(dx.X, dx.y, dx.types, { maxDepth: 1 });
assert.ok(T.accuracy(t1, dx.X, dx.y) < 1);
const t2 = T.buildTree(dx.X, dx.y, dx.types, { maxDepth: 2 });
assert.equal(T.accuracy(t2, dx.X, dx.y), 1);
assert.equal(T.predictPath(t2, ['b', 'p'], dx.names).label, '1');
assert.equal(T.predictPath(t2, ['a', 'p'], dx.names).label, '0');
assert.equal(T.confusion(t2, dx.X, dx.y)['1']['1'], 2);

// minLeaf respected, pure data => single leaf
const t3 = T.buildTree([[1], [2]], ['a', 'a'], ['num']);
assert.equal(t3.left, undefined);
const t4 = T.buildTree(d.X, d.y, d.types, { minLeaf: 4 });
assert.equal(t4.left, undefined);

// split determinism + sizes
const s1 = T.split(d.X, d.y, 0.34, 7), s2 = T.split(d.X, d.y, 0.34, 7);
assert.deepEqual(s1, s2);
assert.equal(s1.Xte.length, 2); assert.equal(s1.Xtr.length, 4);
console.log('decision-tree-lab: all tests passed');
