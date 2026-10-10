import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as meyer from '../js/games/meyer.js';

const { rollKey, rank, rollName, allowedClaims } = meyer;
const seeded = (seed = 1) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const play = (s, pid, a) => meyer.apply(structuredClone(s), pid, a, seeded(5));

function game(rules = {}) {
  const s = meyer.start(['a', 'b', 'c'], rules, seeded(2));
  s.turn = 'a';
  return s;
}
/** Gives the current player a known roll. */
const withCup = (s, dice, looked = true) => ({ ...structuredClone(s), cup: { dice, looked } });

test('roll names and order', () => {
  assert.equal(rollKey([2, 1]), '21');
  assert.equal(rollKey([1, 3]), '31');
  assert.equal(rollKey([4, 6]), '64');
  assert.equal(rollKey([5, 5]), '55');
  assert.equal(rollName('21'), 'Meyer');
  assert.equal(rollName('31'), 'Lille-Meyer');
  assert.equal(rollName('66'), 'Par 6');
  assert.ok(rank('21') > rank('31'));
  assert.ok(rank('31') > rank('66'));
  assert.ok(rank('11') > rank('65'));
  assert.ok(rank('65') > rank('64'));
  assert.equal(rank('32'), 0);
});

test('announcements must reach the last claim (equal allowed by default)', () => {
  const s = { ...game(), claim: { key: '64', by: 'c' } };
  assert.ok(allowedClaims(s).includes('64'));
  assert.ok(!allowedClaims(s).includes('63'));
  assert.ok(!allowedClaims({ ...s, rules: { ...s.rules, equalAllowed: false } }).includes('64'));
});

test('lifting a true claim costs the lifter a life', () => {
  let s = withCup(game(), [6, 4]);
  s = play(s, 'a', { type: 'announce', key: '63' }); // has 64, claims 63
  s = play(s, 'b', { type: 'lift' });
  assert.equal(s.reveal.truthful, true);
  assert.equal(s.reveal.loser, 'b');
  assert.equal(s.players.find((p) => p.id === 'b').lives, 5);
});

test('lifting a bluff costs the bluffer a life, and a Meyer bluff costs two', () => {
  let s = withCup(game(), [6, 4]);
  s = play(s, 'a', { type: 'announce', key: '21' });
  s = play(s, 'b', { type: 'lift' });
  assert.equal(s.reveal.truthful, false);
  assert.equal(s.reveal.loser, 'a');
  assert.equal(s.players.find((p) => p.id === 'a').lives, 4);
});

test('you can’t lift after rolling, or announce lower', () => {
  let s = withCup(game(), [5, 5]);
  s = play(s, 'a', { type: 'announce', key: '55' });
  s = play(s, 'b', { type: 'roll' });
  assert.throws(() => play(s, 'b', { type: 'lift' }), /already rolled/);
  assert.throws(() => play(s, 'b', { type: 'announce', key: '54' }), /at least/);
});

test('passing blind keeps the claim and the next lift checks the new dice', () => {
  let s = withCup(game(), [6, 6]);
  s = play(s, 'a', { type: 'announce', key: '66' });
  s = { ...withCup({ ...s }, [2, 4], false) };
  s = play(s, 'b', { type: 'blind' });
  assert.equal(s.claim.key, '66');
  assert.equal(s.claim.by, 'b');
  s = play(s, 'c', { type: 'lift' });
  assert.equal(s.reveal.loser, 'b');
});

test('3-2 is skål: no lives lost and the next player starts a fresh round', () => {
  let s = withCup(game(), [3, 2]);
  s = play(s, 'a', { type: 'skaal' });
  assert.equal(s.reveal.type, 'skaal');
  assert.ok(s.players.every((p) => p.lives === 6));
  s = play(s, 'c', { type: 'next' });
  assert.equal(s.turn, 'b');
  assert.equal(s.claim, null);
});

test('first player out of lives loses the game (default)', () => {
  let s = withCup(game({ lives: 1 }), [6, 4]);
  s = play(s, 'a', { type: 'announce', key: '65' });
  s = play(s, 'b', { type: 'lift' });
  assert.equal(s.phase, 'over');
  assert.equal(s.result.loser, 'a');
});

test('nobody sees the dice under the cup', () => {
  let s = withCup(game(), [6, 4]);
  assert.deepEqual(meyer.view(s, 'a').cup.dice, [6, 4]);
  assert.equal(meyer.view(s, 'b').cup.dice, null);
  s = play(s, 'a', { type: 'announce', key: '64' });
  assert.equal(meyer.view(s, 'b').claimDice, null);
});

test('a random game with "last standing" ends with one winner', () => {
  const rand = seeded(11);
  let s = meyer.start(['a', 'b', 'c', 'd'], { ending: 'lastStanding', lives: 3 }, rand);
  for (let g = 0; g < 5000 && s.phase !== 'over'; g++) {
    if (s.phase === 'reveal') { s = meyer.apply(s, 'a', { type: 'next' }, rand); continue; }
    const p = s.turn;
    if (!s.cup && s.claim && rand() < 0.4) { s = meyer.apply(s, p, { type: 'lift' }, rand); continue; }
    if (!s.cup) { s = meyer.apply(s, p, { type: 'roll' }, rand); continue; }
    const allowed = allowedClaims(s);
    const truth = rollKey(s.cup.dice);
    const key = allowed.includes(truth) ? truth : allowed[0];
    s = meyer.apply(s, p, { type: 'announce', key }, rand);
  }
  assert.equal(s.phase, 'over');
  assert.ok(s.result.winner);
});
