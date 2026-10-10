import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as skib from '../js/games/skib.js';
import * as gris from '../js/games/gris.js';
import * as yatzy from '../js/games/yatzy.js';

const seeded = (seed = 1) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

test('Skib: ship, captain and crew are taken in order only', () => {
  assert.deepEqual(skib.takeCrew([5, 4, 2, 3, 1], 0), { left: [5, 4, 2, 3, 1], held: [], found: 0 });
  assert.deepEqual(skib.takeCrew([4, 6, 5, 2, 3], 0), { left: [2, 3], held: [6, 5, 4], found: 3 });
  assert.deepEqual(skib.takeCrew([6, 4, 2, 2, 3], 0), { left: [4, 2, 2, 3], held: [6], found: 1 });
  assert.deepEqual(skib.takeCrew([4, 1, 3], 2), { left: [1, 3], held: [4], found: 3 });
});

test('Skib: a full game of rounds finishes with a loser', () => {
  const rand = seeded(3);
  let s = skib.start(['a', 'b', 'c'], { rounds: 3 }, rand);
  for (let i = 0; i < 500 && s.phase !== 'over'; i++) {
    if (s.phase === 'roundover') { s = skib.apply(s, 'a', { type: 'next' }, rand); continue; }
    if (s.found === 3 && s.dice.reduce((a, b) => a + b, 0) >= 8) s = skib.apply(s, s.turn, { type: 'stop' }, rand);
    else s = skib.apply(s, s.turn, { type: 'roll' }, rand);
  }
  assert.equal(s.phase, 'over');
  assert.equal(s.round, 3);
  assert.ok(s.result.losers.length >= 1);
});

test('Skib: you can’t keep cargo without the crew', () => {
  const s = skib.start(['a', 'b'], {}, seeded(1));
  assert.throws(() => skib.apply(structuredClone(s), s.turn, { type: 'stop' }), /ship, captain and crew/);
});

test('Gris: a 1 loses the turn, holding banks it', () => {
  let s = gris.start(['a', 'b'], {}, seeded(1));
  s.turn = 'a';
  const sixes = () => 0.99;
  s = gris.apply(s, 'a', { type: 'roll' }, sixes);
  s = gris.apply(s, 'a', { type: 'roll' }, sixes);
  assert.equal(s.turnPoints, 12);
  s = gris.apply(s, 'a', { type: 'hold' });
  assert.equal(s.scores.a, 12);
  assert.equal(s.turn, 'b');
  s = gris.apply(s, 'b', { type: 'roll' }, () => 0);
  assert.equal(s.event.type, 'bust');
  assert.equal(s.turn, 'a');
});

test('Gris: reaching the target wins at once', () => {
  let s = gris.start(['a', 'b'], { target: 50 }, seeded(1));
  s.turn = 'a';
  s.scores.a = 46;
  s = gris.apply(s, 'a', { type: 'roll' }, () => 0.99);
  assert.equal(s.phase, 'over');
  assert.equal(s.result.winner, 'a');
});

test('Yatzy scoring (Scandinavian)', () => {
  const sc = yatzy.score;
  assert.equal(sc('threes', [3, 3, 1, 3, 6]), 9);
  assert.equal(sc('pair', [2, 2, 5, 5, 6]), 10);
  assert.equal(sc('twoPairs', [2, 2, 5, 5, 6]), 14);
  assert.equal(sc('twoPairs', [5, 5, 5, 5, 6]), 0);
  assert.equal(sc('three', [4, 4, 4, 1, 2]), 12);
  assert.equal(sc('four', [6, 6, 6, 6, 2]), 24);
  assert.equal(sc('small', [3, 1, 2, 5, 4]), 15);
  assert.equal(sc('large', [6, 2, 3, 4, 5]), 20);
  assert.equal(sc('small', [2, 3, 4, 5, 6]), 0);
  assert.equal(sc('house', [3, 3, 3, 6, 6]), 21);
  assert.equal(sc('house', [3, 3, 3, 3, 3]), 0);
  assert.equal(sc('chance', [1, 2, 3, 4, 6]), 16);
  assert.equal(sc('yatzy', [2, 2, 2, 2, 2]), 50);
  assert.equal(yatzy.totals({ ones: 3, twos: 6, threes: 9, fours: 12, fives: 15, sixes: 18 }).bonus, 50);
  assert.equal(yatzy.totals({ ones: 3, twos: 6, threes: 9, fours: 12, fives: 15, sixes: 12 }).bonus, 0);
});

test('Yatzy: held dice stay, and only three rolls', () => {
  let s = yatzy.start(['a'], {}, seeded(2));
  s = yatzy.apply(s, 'a', { type: 'roll' }, seeded(5));
  const first = s.turns.a.dice[0];
  s = yatzy.apply(s, 'a', { type: 'hold', index: 0 });
  s = yatzy.apply(s, 'a', { type: 'roll' }, seeded(9));
  assert.equal(s.turns.a.dice[0], first);
  s = yatzy.apply(s, 'a', { type: 'roll' }, seeded(11));
  assert.throws(() => yatzy.apply(structuredClone(s), 'a', { type: 'roll' }), /No rolls/);
});

test('Yatzy: "take turns" mode passes the dice, and a full game ends', () => {
  const rand = seeded(7);
  let s = yatzy.start(['a', 'b'], { mode: 'turns' }, rand);
  for (let i = 0; i < 200 && s.phase === 'play'; i++) {
    const p = s.turn;
    s = yatzy.apply(s, p, { type: 'roll' }, rand);
    const open = yatzy.CATEGORIES.map(([k]) => k).filter((k) => !(k in s.sheets[p]));
    const best = open.reduce((a, k) => (yatzy.score(k, s.turns[p].dice) > yatzy.score(a, s.turns[p].dice) ? k : a), open[0]);
    s = yatzy.apply(s, p, { type: 'score', cat: best });
    if (s.phase === 'play') assert.notEqual(s.turn, p);
  }
  assert.equal(s.phase, 'over');
  assert.ok(s.result.top > 0);
});
