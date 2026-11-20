import assert from 'node:assert/strict';
import * as c from './cipher.js';

const PLAIN = `It was the best of times, it was the worst of times, it was the age of wisdom, it was the age of foolishness, it was the epoch of belief, it was the epoch of incredulity, it was the season of Light, it was the season of Darkness, it was the spring of hope, it was the winter of despair. We had everything before us, we had nothing before us, we were all going direct to Heaven, we were all going direct the other way.`;

// Caesar
assert.equal(c.caesar('Hello, World!', 3), 'Khoor, Zruog!');
assert.equal(c.caesar(c.caesar('Hello, World!', 3), -3), 'Hello, World!');
assert.equal(c.caesar('xyz', 5), 'cde');
const ct = c.caesar(PLAIN, 11);
const r = c.breakCaesar(ct)[0];
assert.equal(r.shift, 11); assert.equal(r.plain, PLAIN);

// Vigenere known vector
assert.equal(c.vigenere('ATTACKATDAWN', 'LEMON'), 'LXFOPVEFRNHR');
assert.equal(c.vigenere('LXFOPVEFRNHR', 'LEMON', true), 'ATTACKATDAWN');
assert.equal(c.vigenere('Hi, there!', 'key', true), c.vigenere('Hi, there!', 'KEY', true));
assert.throws(() => c.vigenere('x', '123'));

// IC
assert.ok(c.indexOfCoincidence(c.lettersOnly(PLAIN)) > 0.058);
const vct = c.vigenere(PLAIN + ' ' + PLAIN, 'CRYPTO');
assert.ok(c.indexOfCoincidence(c.lettersOnly(vct)) < 0.05);

// Kasiski: repeated text yields length multiples of 6 at top
const k = c.kasiski(vct, 20);
assert.ok(k.slice(0, 5).some((x) => x.len === 6));

// Vigenere breaking
const res = c.breakVigenere(vct);
assert.equal(res.len, 6); assert.equal(res.key, 'CRYPTO');
assert.equal(res.plain, PLAIN + ' ' + PLAIN);
assert.equal(c.breakVigenere(c.vigenere(PLAIN, 'LEMON')).key, 'LEMON');

// XOR
assert.equal(c.bytesToHex(c.xorBytes(c.textToBytes('abc'), [1])), '606362');
assert.throws(() => c.hexToBytes('abc'));
const xb = c.xorBytes(c.textToBytes(PLAIN), [0x5a]);
const x1 = c.breakSingleByteXor(xb)[0];
assert.equal(x1.key, 0x5a); assert.equal(new TextDecoder().decode(x1.plain), PLAIN);
assert.equal(c.hamming(c.textToBytes('this is a test'), c.textToBytes('wokka wokka!!!')), 37);
const rx = c.breakRepeatingXor(c.xorBytes(c.textToBytes(PLAIN + PLAIN.toLowerCase()), c.textToBytes('ICE')));
assert.equal(rx.key.length % 3, 0);
assert.equal(String.fromCharCode(...rx.key.slice(0, 3)), 'ICE');
console.log('all tests passed');
