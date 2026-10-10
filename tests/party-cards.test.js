import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as heste from '../js/games/hestelob.js';
import * as kk from '../js/games/kongens-kop.js';
import * as mest from '../js/games/mest-sandsynligt.js';
import * as aldrig from '../js/games/jeg-har-aldrig.js';
import { newDeck } from '../js/games/cards.js';

const seeded = (seed = 1) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

test('a deck has 52 different cards', () => {
  const d = newDeck(seeded(1));
  assert.equal(d.length, 52);
  assert.equal(new Set(d.map((c) => `${c.r}${c.s}`)).size, 52);
});

test('Hesteløb: aces are horses, not in the deck or the track', () => {
  const s = heste.start(['a', 'b'], {}, seeded(2));
  assert.equal(s.track.length, 7);
  assert.ok([...s.deck, ...s.track].every((c) => c.r !== 1));
  assert.equal(s.deck.length + s.track.length, 48);
});

test('Hesteløb: only the host can start before everyone has bet', () => {
  let s = heste.start(['a', 'b'], {}, seeded(2));
  s = heste.apply(s, 'a', { type: 'bet', suit: 'H', sips: 3 });
  assert.throws(() => heste.apply(structuredClone(s), 'b', { type: 'go' }), /everyone/);
  s = heste.apply(s, 'a', { type: 'go' }, Math.random, { isHost: true });
  assert.equal(s.phase, 'race');
});

test('Hesteløb: a turned track card sends its horse back', () => {
  let s = heste.start(['a'], { trackLength: 5 }, seeded(2));
  s = heste.apply(s, 'a', { type: 'bet', suit: 'S', sips: 2 });
  s = heste.apply(s, 'a', { type: 'go' });
  s.horses = { S: 1, H: 1, D: 1, C: 0 };
  s.track[0] = { r: 5, s: 'H' };
  s.deck.push({ r: 9, s: 'C' });
  s = heste.apply(s, 'a', { type: 'draw' });
  assert.equal(s.trackShown[0], true);
  assert.deepEqual(s.horses, { S: 1, H: 0, D: 1, C: 1 });
});

test('Hesteløb: a full race ends and pays out', () => {
  const rand = seeded(5);
  let s = heste.start(['a', 'b'], {}, rand);
  s = heste.apply(s, 'a', { type: 'bet', suit: 'S', sips: 2 });
  s = heste.apply(s, 'b', { type: 'bet', suit: 'H', sips: 4 });
  s = heste.apply(s, 'a', { type: 'go' });
  for (let i = 0; i < 500 && s.phase === 'race'; i++) s = heste.apply(s, 'b', { type: 'draw' }, rand);
  assert.equal(s.phase, 'over');
  const winner = s.result.find((x) => x.gives);
  if (winner) assert.equal(winner.gives, s.bets[winner.id].sips * 2);
});

test('Kongens kop: turns rotate and the fourth king ends it', () => {
  let s = kk.start(['a', 'b', 'c'], {}, seeded(3));
  let guard = 0;
  while (s.phase === 'play' && guard++ < 60) {
    const before = s.turn;
    s = kk.apply(s, s.turn, { type: 'draw' });
    if (s.phase === 'play') assert.notEqual(s.turn, before);
  }
  assert.equal(s.phase, 'over');
  assert.equal(s.kings, 4);
  assert.ok(s.result.cup);
});

test('Kongens kop: house rule text splits into title and description', () => {
  assert.deepEqual(kk.ruleFor({ r7: 'Heaven: Point up' }, 7), { title: 'Heaven', text: 'Point up' });
  assert.deepEqual(kk.ruleFor({ r7: 'Point up' }, 7), { title: 'Point up', text: '' });
});

test('Mest sandsynligt: votes are secret until everyone has voted', () => {
  let s = mest.start(['a', 'b', 'c'], {}, seeded(4));
  s = mest.apply(s, 'a', { type: 'vote', target: 'b' });
  assert.deepEqual(mest.view(s, 'c').votes, {});
  assert.deepEqual(mest.view(s, 'c').voted, ['a']);
  assert.throws(() => mest.apply(structuredClone(s), 'b', { type: 'vote', target: 'b' }), /yourself/);
  s = mest.apply(s, 'b', { type: 'vote', target: 'c' });
  s = mest.apply(s, 'c', { type: 'vote', target: 'b' });
  assert.equal(s.phase, 'reveal');
  assert.deepEqual(s.tally.drink, ['b']);
});

test('Mest sandsynligt: own prompts only', () => {
  const s = mest.start(['a', 'b', 'c'], { builtIn: false, extra: 'sing\n\ndance\n' }, seeded(4));
  assert.deepEqual([...s.prompts].sort(), ['dance', 'sing']);
});

test('Jeg har aldrig: answers are revealed once everyone has answered', () => {
  let s = aldrig.start(['a', 'b'], {}, seeded(4));
  s = aldrig.apply(s, 'a', { type: 'answer', has: true });
  assert.equal(aldrig.view(s, 'b').answers.a, undefined);
  assert.equal(aldrig.view(s, 'a').mine, true);
  s = aldrig.apply(s, 'b', { type: 'answer', has: false });
  assert.equal(s.phase, 'reveal');
  s = aldrig.apply(s, 'a', { type: 'next' });
  assert.equal(s.phase, 'answering');
  assert.equal(s.round, 2);
});
