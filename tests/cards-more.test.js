import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as bussen from '../js/games/bussen.js';
import * as sk from '../js/games/snyd-kort.js';

const seeded = (seed = 1) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const C = (r, s) => ({ r, s });

test('Bussen: judging the four questions (aces high, equal is wrong)', () => {
  assert.equal(bussen.judge(1, 'red', C(5, 'H'), []), true);
  assert.equal(bussen.judge(1, 'red', C(5, 'S'), []), false);
  assert.equal(bussen.judge(2, 'higher', C(1, 'S'), [C(13, 'H')]), true);
  assert.equal(bussen.judge(2, 'lower', C(7, 'S'), [C(7, 'H')]), false);
  assert.equal(bussen.judge(3, 'between', C(6, 'S'), [C(4, 'H'), C(9, 'C')]), true);
  assert.equal(bussen.judge(3, 'outside', C(9, 'S'), [C(4, 'H'), C(9, 'C')]), false);
  assert.equal(bussen.judge(4, 'D', C(2, 'D'), []), true);
});

test('Bussen: a whole game runs from questions to the bus', () => {
  const rand = seeded(8);
  let s = bussen.start(['a', 'b', 'c'], {}, rand);
  const guesses = { 1: 'red', 2: 'higher', 3: 'between', 4: 'H' };
  while (s.phase === 'questions') s = bussen.apply(s, s.turn, { type: 'answer', guess: guesses[s.q] }, rand);
  assert.equal(s.phase, 'pyramid');
  assert.ok(Object.values(s.hands).every((h) => h.length <= 4));
  assert.throws(() => bussen.apply(structuredClone(s), 'a', { type: 'bus' }), /whole pyramid/);
  while (s.flipped < 10) s = bussen.apply(s, 'a', { type: 'flip' }, rand);
  s = bussen.apply(s, 'a', { type: 'bus' }, rand);
  assert.equal(s.phase, 'bus');
  const most = Math.max(...Object.values(s.hands).map((h) => h.length));
  assert.equal(s.hands[s.bus.rider].length, most);
  for (let i = 0; i < 500 && s.phase === 'bus'; i++) {
    const cur = s.bus.cards[s.bus.pos];
    s = bussen.apply(s, s.bus.rider, { type: 'ride', guess: bussen.value(cur) >= 8 ? 'lower' : 'higher' }, rand);
  }
  assert.equal(s.phase, 'over');
});

test('Bussen: matching cards in the pyramid hand out sips by row', () => {
  let s = bussen.start(['a', 'b'], { pyramidRows: 3 }, seeded(2));
  s.phase = 'pyramid';
  s.hands = { a: [C(7, 'H'), C(7, 'S'), C(2, 'C')], b: [C(9, 'D')] };
  s.pyramid = [[C(3, 'H'), C(4, 'H'), C(5, 'H')], [C(7, 'D'), C(8, 'D')], [C(9, 'S')]];
  s.flipped = 3;
  s = bussen.apply(s, 'b', { type: 'flip' });
  assert.deepEqual(s.lastFlip.matches, [{ id: 'a', count: 2, sips: 4 }]);
  assert.equal(s.hands.a.length, 1);
});

function rigged() {
  const s = sk.start(['a', 'b', 'c'], {}, seeded(1));
  s.hands = { a: [C(1, 'S'), C(1, 'H'), C(5, 'D')], b: [C(2, 'S'), C(9, 'H')], c: [C(3, 'C')] };
  s.turn = 'a';
  s.rank = 1;
  return s;
}

test('Snyd med kort: an honest play makes the caller take the pile', () => {
  let s = sk.apply(rigged(), 'a', { type: 'play', cards: [0, 1] });
  assert.equal(s.rank, 2);
  assert.equal(s.turn, 'b');
  s = sk.apply(s, 'c', { type: 'call' });
  assert.equal(s.reveal.truthful, true);
  assert.equal(s.hands.c.length, 3);
});

test('Snyd med kort: a lie makes the liar take the pile', () => {
  let s = sk.apply(rigged(), 'a', { type: 'play', cards: [2] });
  s = sk.apply(s, 'b', { type: 'call' });
  assert.equal(s.reveal.truthful, false);
  assert.equal(s.hands.a.length, 3);
  assert.equal(s.pile.length, 0);
});

test('Snyd med kort: emptying your hand wins once the next player plays', () => {
  let s = rigged();
  s.turn = 'c';
  s.rank = 3;
  s = sk.apply(s, 'c', { type: 'play', cards: [0] });
  assert.equal(s.phase, 'play');
  s = sk.apply(s, 'a', { type: 'play', cards: [0] });
  assert.equal(s.phase, 'over');
  assert.equal(s.result.winner, 'c');
});

test('Snyd med kort: others only see card counts, and played cards stay hidden', () => {
  let s = sk.apply(rigged(), 'a', { type: 'play', cards: [0] });
  const v = sk.view(s, 'b');
  assert.equal(v.hands, undefined);
  assert.equal(v.counts.a, 2);
  assert.equal(v.lastPlay.cards, undefined);
  assert.equal(v.mine.length, 2);
});
