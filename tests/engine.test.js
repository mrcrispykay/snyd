import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  newGame, apply, viewFor, isTrappe, handValue, countTable, isHigher, validBid, lowestBid, DEFAULT_RULES,
} from '../js/engine.js';

const R = DEFAULT_RULES;
const seeded = (seed = 1) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

function table(names = ['a', 'b', 'c'], rules = {}) {
  let s = newGame({ code: 'TEST', hostId: names[0], rules });
  for (const n of names) s = apply(s, n, { type: 'join', name: n.toUpperCase() });
  return apply(s, names[0], { type: 'start' }, seeded(3));
}

/** Puts known dice in every hand and makes `turn` the player to act. */
function rig(s, dice, turn, bid = null) {
  const t = structuredClone(s);
  for (const p of t.players) if (dice[p.id]) { p.dice = dice[p.id]; p.count = dice[p.id].length; }
  t.turn = turn;
  t.bid = bid;
  return t;
}

test('trappe detection', () => {
  assert.equal(isTrappe([1]), true);
  assert.equal(isTrappe([2, 1, 3]), true);
  assert.equal(isTrappe([1, 2, 4]), false);
  assert.equal(isTrappe([1, 1]), false);
  assert.equal(isTrappe([2, 3]), false);
});

test('ones are wild for the bid face', () => {
  assert.equal(handValue([1, 4, 4, 2], 4, R).value, 3);
  assert.equal(handValue([1, 4, 4, 2], 4, { ...R, onesWild: false }).value, 2);
});

test('a trappe counts as dice + 1 of any face', () => {
  assert.equal(handValue([3, 1, 2], 6, R).value, 4);
  assert.equal(handValue([1, 2, 3, 4], 5, R).value, 5);
  assert.equal(handValue([1], 6, R).value, 2);
  assert.equal(handValue([3, 1, 2], 6, { ...R, trappe: false }).value, 1);
});

test('til stede: jokers only count when the face is on the table', () => {
  const rules = { ...R, tilStede: true };
  const hands = [{ id: 'a', dice: [1, 1, 3] }, { id: 'b', dice: [1, 2] }];
  assert.equal(countTable(hands, 5, rules).total, 0);
  assert.equal(countTable(hands, 5, R).total, 5); // three ones + trappe 1-2 (=3)
  assert.equal(countTable(hands, 3, rules).total, 1 + 2 + 3);
});

test('bid ordering: more dice, or same count with higher face', () => {
  assert.equal(isHigher({ count: 5, face: 2 }, { count: 4, face: 6 }), true);
  assert.equal(isHigher({ count: 4, face: 5 }, { count: 4, face: 4 }), true);
  assert.equal(isHigher({ count: 4, face: 4 }, { count: 4, face: 4 }), false);
  assert.equal(isHigher({ count: 3, face: 6 }, { count: 4, face: 2 }), false);
});

test('ones cannot be bid while they are wild', () => {
  const s = table();
  assert.match(validBid(s, { count: 2, face: 1 }), /wild/);
  assert.equal(validBid({ ...s, rules: { ...s.rules, onesWild: false } }, { count: 2, face: 1 }), null);
});

test('lowest legal bid steps face first, then count', () => {
  const s = table();
  assert.deepEqual(lowestBid({ ...s, bid: null }), { count: 1, face: 2 });
  assert.deepEqual(lowestBid({ ...s, bid: { count: 3, face: 4 } }), { count: 3, face: 5 });
  assert.deepEqual(lowestBid({ ...s, bid: { count: 3, face: 6 } }), { count: 4, face: 2 });
});

test('players act in turn and bids must go up', () => {
  let s = rig(table(), { a: [2, 2, 3, 4], b: [5, 5, 1, 6], c: [6, 6, 6, 2] }, 'a');
  s = apply(s, 'a', { type: 'bid', count: 3, face: 2 });
  assert.equal(s.turn, 'b');
  assert.throws(() => apply(s, 'c', { type: 'bid', count: 4, face: 2 }), /not your turn/);
  assert.throws(() => apply(s, 'b', { type: 'bid', count: 3, face: 2 }), /more dice/);
});

test('a true bid: the caller loses, everyone else drops a die (default rules)', () => {
  let s = rig(table(), { a: [2, 2, 3, 4], b: [5, 5, 1, 6], c: [6, 6, 6, 2] }, 'a');
  s = apply(s, 'a', { type: 'bid', count: 4, face: 2 }); // 2+1(one)+1 = 4 twos
  s = apply(s, 'b', { type: 'snyd' });
  assert.equal(s.reveal.total, 4);
  assert.equal(s.reveal.holds, true);
  assert.equal(s.reveal.loser, 'b');
  assert.deepEqual(s.players.map((p) => p.count), [3, 4, 3]);
});

test('a false bid: the bidder loses', () => {
  let s = rig(table(), { a: [2, 2, 3, 4], b: [5, 5, 1, 6], c: [6, 6, 6, 2] }, 'a');
  s = apply(s, 'a', { type: 'bid', count: 6, face: 6 }); // only 4 sixes
  s = apply(s, 'b', { type: 'snyd' });
  assert.equal(s.reveal.holds, false);
  assert.equal(s.reveal.loser, 'a');
  assert.deepEqual(s.players.map((p) => p.count), [4, 3, 3]);
});

test('the round loser starts the next round', () => {
  let s = rig(table(), { a: [2, 2, 3, 4], b: [5, 5, 1, 6], c: [6, 6, 6, 2] }, 'a');
  s = apply(s, 'a', { type: 'bid', count: 6, face: 6 });
  s = apply(s, 'b', { type: 'snyd' });
  s = apply(s, 'c', { type: 'next' }, seeded(9));
  assert.equal(s.phase, 'bidding');
  assert.equal(s.turn, 'a');
  assert.equal(s.players[0].dice.length, 4);
  assert.equal(s.players[1].dice.length, 3);
});

test('default rules: last player with dice loses the game', () => {
  let s = rig(table(['a', 'b']), { a: [6], b: [2] }, 'a');
  s = apply(s, 'a', { type: 'bid', count: 2, face: 6 }); // false: one six, no ones
  s = apply(s, 'b', { type: 'snyd' });
  assert.equal(s.phase, 'over');
  assert.equal(s.result.loser, 'a');
});

test('"only the loser" rules: last player with dice wins', () => {
  let s = rig(table(['a', 'b'], { diceLoss: 'loser' }), { a: [6], b: [2, 3] }, 'a');
  s = apply(s, 'a', { type: 'bid', count: 3, face: 6 });
  s = apply(s, 'b', { type: 'snyd' });
  assert.equal(s.phase, 'over');
  assert.equal(s.result.winner, 'b');
});

test('players only see their own dice until the reveal', () => {
  const s = rig(table(), { a: [2, 2, 3, 4], b: [5, 5, 1, 6], c: [6, 6, 6, 2] }, 'a');
  const v = viewFor(s, 'b');
  assert.deepEqual(v.players.find((p) => p.id === 'b').dice, [5, 5, 1, 6]);
  assert.deepEqual(v.players.find((p) => p.id === 'a').dice, [0, 0, 0, 0]);
});

test('a player rejoining from a new tab gets their seat back by name', () => {
  let s = table();
  s = apply(s, 'b', { type: 'connected', value: false });
  s = apply(s, 'b2', { type: 'join', name: 'b' });
  assert.ok(s.players.some((p) => p.id === 'b2' && p.count === 4));
  assert.throws(() => apply(s, 'zz', { type: 'join', name: 'new' }), /already started/);
});

test('a full random game always ends with one player left', () => {
  const rand = seeded(42);
  let s = table(['a', 'b', 'c', 'd']);
  for (let guard = 0; guard < 2000 && s.phase !== 'over'; guard++) {
    if (s.phase === 'reveal') { s = apply(s, 'a', { type: 'next' }, rand); continue; }
    const p = s.turn;
    if (s.bid && rand() < 0.35) s = apply(s, p, { type: 'snyd' });
    else { const b = lowestBid(s); s = apply(s, p, { type: 'bid', ...b }); }
  }
  assert.equal(s.phase, 'over');
  assert.equal(s.players.filter((p) => !p.out).length, 1);
});
