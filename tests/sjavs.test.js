import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as sj from '../js/games/sjavs.js';

const seeded = (seed = 1) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const C = (r, s) => ({ r, s });

test('32 cards worth 120 points', () => {
  const d = sj.newDeck32(seeded(1));
  assert.equal(d.length, 32);
  assert.equal(d.reduce((a, c) => a + sj.cardPoints(c), 0), 120);
});

test('permanent trumps outrank the trump suit, and trump counts are 12 or 13', () => {
  const d = sj.newDeck32(seeded(1));
  assert.equal(d.filter((c) => sj.isTrump(c, 'C')).length, 12);
  assert.equal(d.filter((c) => sj.isTrump(c, 'H')).length, 13);
  assert.ok(sj.strength(C(12, 'C'), 'H') < sj.strength(C(11, 'D'), 'H'));
  assert.ok(sj.strength(C(11, 'D'), 'H') < sj.strength(C(1, 'H'), 'H'));
  assert.equal(sj.isTrump(C(11, 'S'), 'D'), true);
  assert.equal(sj.isTrump(C(12, 'H'), 'D'), false);
});

test('bids: longer wins, clubs wins at equal length', () => {
  assert.equal(sj.betterBid({ length: 6, clubs: false }, { length: 5, clubs: true }), true);
  assert.equal(sj.betterBid({ length: 6, clubs: true }, { length: 6, clubs: false }), true);
  assert.equal(sj.betterBid({ length: 6, clubs: false }, { length: 6, clubs: false }), false);
});

test('follow suit, with jacks counting as trumps', () => {
  const hand = [C(11, 'H'), C(1, 'H'), C(7, 'S')];
  const trick = [{ seat: 0, card: C(9, 'H') }];
  assert.deepEqual(sj.legalCards(hand, trick, 'C'), [1]); // J♥ is a trump, not a heart
  assert.deepEqual(sj.legalCards(hand, [{ seat: 0, card: C(8, 'C') }], 'C'), [0]);
  assert.deepEqual(sj.legalCards([C(7, 'S')], trick, 'C'), [0]);
});

test('trick winner: trump beats the suit led, else the highest of the suit led', () => {
  assert.equal(sj.trickWinner([{ seat: 0, card: C(1, 'S') }, { seat: 1, card: C(7, 'D') }, { seat: 2, card: C(13, 'S') }, { seat: 3, card: C(1, 'H') }], 'D'), 1);
  assert.equal(sj.trickWinner([{ seat: 0, card: C(10, 'S') }, { seat: 1, card: C(1, 'H') }, { seat: 2, card: C(1, 'S') }, { seat: 3, card: C(9, 'S') }], 'D'), 2);
  assert.equal(sj.trickWinner([{ seat: 0, card: C(1, 'D') }, { seat: 1, card: C(11, 'D') }, { seat: 2, card: C(12, 'C') }, { seat: 3, card: C(11, 'C') }], 'D'), 2);
});

test('deal scoring follows the table', () => {
  assert.deepEqual(sj.scoreDeal({ points: 70, tricksBySeat: [2, 2, 2, 2], declTeam: [0, 2], clubs: false }), { side: 'decl', points: 2 });
  assert.deepEqual(sj.scoreDeal({ points: 95, tricksBySeat: [3, 1, 3, 1], declTeam: [0, 2], clubs: true }), { side: 'decl', points: 8 });
  assert.equal(sj.scoreDeal({ points: 120, tricksBySeat: [8, 0, 0, 0], declTeam: [0, 2], clubs: true }).points, 24);
  assert.equal(sj.scoreDeal({ points: 120, tricksBySeat: [4, 0, 4, 0], declTeam: [0, 2], clubs: false }).points, 12);
  assert.deepEqual(sj.scoreDeal({ points: 45, tricksBySeat: [2, 3, 1, 2], declTeam: [0, 2], clubs: false }), { side: 'def', points: 4 });
  assert.deepEqual(sj.scoreDeal({ points: 20, tricksBySeat: [1, 4, 0, 3], declTeam: [0, 2], clubs: true }), { side: 'def', points: 16 });
  assert.equal(sj.scoreDeal({ points: 0, tricksBySeat: [0, 4, 0, 4], declTeam: [0, 2], clubs: false }).points, 16);
  assert.equal(sj.scoreDeal({ points: 60, tricksBySeat: [2, 2, 2, 2], declTeam: [0, 2], clubs: false }).tie, true);
});

test('a whole rubber plays out with legal random moves', () => {
  const rand = seeded(21);
  let s = sj.start(['a', 'b', 'c', 'd'], { rubber: 12 }, rand);
  for (let i = 0; i < 5000 && s.phase !== 'over'; i++) {
    if (s.phase === 'bidding') {
      const seat = s.bidTurn;
      const suit = sj.SUITS.find((x) => sj.trumpCount(s.hands[seat], x) >= 5 && sj.betterBid({ length: sj.trumpCount(s.hands[seat], x), clubs: x === 'C' }, s.bid));
      s = sj.apply(s, s.seats[seat], suit ? { type: 'bid', suit } : { type: 'pass' }, rand);
    } else if (s.phase === 'playing') {
      const seat = s.turn;
      const legal = sj.legalCards(s.hands[seat], s.trick, s.trump);
      s = sj.apply(s, s.seats[seat], { type: 'play', index: legal[Math.floor(rand() * legal.length)] }, rand);
    } else if (s.phase === 'scored') {
      assert.equal(s.won[0].concat(s.won[1]).reduce((a, c) => a + sj.cardPoints(c), 0), 120);
      s = sj.apply(s, 'a', { type: 'next' }, rand);
    }
  }
  assert.equal(s.phase, 'over');
  assert.ok(s.left[s.result.team] <= 0);
});

test('others never see your hand or the bid suit during bidding', () => {
  let s = sj.start(['a', 'b', 'c', 'd'], {}, seeded(3));
  const v = sj.view(s, 'b');
  assert.equal(v.hands, undefined);
  assert.equal(v.mine.length, 8);
  s.bid = { seat: 0, length: 6, clubs: false, suit: 'H' };
  assert.equal(sj.view(s, 'b').bid.suit, null);
  assert.equal(sj.view(s, 'a').bid.suit, 'H');
});
