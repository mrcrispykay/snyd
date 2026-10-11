import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as g from '../js/games/tiotusind.js';

const { scoreDice, rollScores, bestKeep, defaults: R } = g;
const seeded = (seed = 1) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

test('scoring table', () => {
  assert.equal(scoreDice([1]), 100);
  assert.equal(scoreDice([5]), 50);
  assert.equal(scoreDice([1, 1]), 200);
  assert.equal(scoreDice([1, 1, 1]), 1000);
  assert.equal(scoreDice([4, 4, 4]), 400);
  assert.equal(scoreDice([2, 2, 2, 1]), 300);
  assert.equal(scoreDice([2, 2, 2, 2]), 1500);
  assert.equal(scoreDice([6, 6, 6, 6, 6]), 2000);
  assert.equal(scoreDice([1, 2, 3, 4, 5]), 2000);
  assert.equal(scoreDice([2, 3, 4, 5, 6]), 2000);
  assert.equal(scoreDice([4, 4, 4, 5, 5]), 2500);
});

test('non-scoring dice make a keep invalid', () => {
  assert.equal(scoreDice([2]), null);
  assert.equal(scoreDice([1, 3]), null);
  assert.equal(scoreDice([4, 4, 4, 2, 2], { ...R, fullHouse: false }), null);
  assert.equal(scoreDice([1, 2, 3, 4, 5], { ...R, straights: false }), null);
});

test('busts', () => {
  assert.equal(rollScores([2, 3, 4, 6, 6]), false);
  assert.equal(rollScores([2, 3, 4, 6, 5]), true);
  assert.equal(rollScores([3, 3, 3, 2, 6]), true);
  assert.equal(rollScores([2, 2, 3, 3, 3]), true); // three 3s (and a full house)
});

test('best keep picks the highest score', () => {
  assert.deepEqual(bestKeep([1, 5, 2, 2, 3]).pts, 150);
  assert.deepEqual(bestKeep([4, 4, 4, 5, 5]).pts, 2500);
});

function rigged(roll, turnPoints = 0) {
  const s = g.start(['a', 'b'], {}, seeded(1));
  s.turn = 'a';
  s.roll = roll;
  s.diceLeft = roll.length;
  s.turnPoints = turnPoints;
  return s;
}

test('banking under the opening minimum is refused', () => {
  const s = rigged([1, 2, 3, 4, 6]);
  assert.throws(() => g.apply(structuredClone(s), 'a', { type: 'bank', keep: [0] }), (e) => e.params.n === 400);
});

test('banking adds turn points and passes the dice', () => {
  const s = g.apply(rigged([1, 5, 2, 3, 4], 300), 'a', { type: 'bank', keep: [0, 1] });
  assert.equal(s.players.find((p) => p.id === 'a').score, 450);
  assert.equal(s.turn, 'b');
});

test('rolling on sets dice aside, and hot dice brings back all five', () => {
  let s = g.apply(rigged([1, 1, 1, 5, 5]), 'a', { type: 'roll', keep: [0, 1, 2, 3, 4] }, seeded(7));
  if (s.turn === 'a') {
    assert.equal(s.turnPoints, 2500); // 1-1-1-5-5 is a full house
    assert.equal(s.roll.length, 5);
  } else {
    assert.equal(s.event.type, 'bust');
  }
});

test('reaching the target gives everyone else one more turn', () => {
  let s = rigged([1, 1, 1, 2, 3], 9500);
  s.players[0].score = 0;
  s = g.apply(s, 'a', { type: 'bank', keep: [0, 1, 2] });
  assert.equal(s.players[0].score, 10500);
  assert.deepEqual(s.finalRound.remaining, ['b']);
  assert.equal(s.turn, 'b');
  s.roll = [1, 2, 3, 4, 6]; s.diceLeft = 5; s.turnPoints = 600;
  s = g.apply(s, 'b', { type: 'bank', keep: [0] });
  assert.equal(s.phase, 'over');
  assert.deepEqual(s.result.winners, ['a']);
});

test('a random game finishes', () => {
  const rand = seeded(99);
  let s = g.start(['a', 'b', 'c'], { target: 3000 }, rand);
  for (let i = 0; i < 20000 && s.phase !== 'over'; i++) {
    const p = s.turn;
    if (!s.roll.length) { s = g.apply(s, p, { type: 'roll' }, rand); continue; }
    const best = bestKeep(s.roll, s.rules);
    const me = s.players.find((x) => x.id === p);
    const total = s.turnPoints + best.pts;
    const canBank = me.score > 0 || total >= s.rules.openingMin;
    if (canBank && (total >= 350 || s.diceLeft - best.idx.length <= 1)) s = g.apply(s, p, { type: 'bank', keep: best.idx }, rand);
    else s = g.apply(s, p, { type: 'roll', keep: best.idx }, rand);
  }
  assert.equal(s.phase, 'over');
  assert.ok(s.result.top >= 3000);
});
