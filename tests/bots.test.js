import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newTable, applyTable, viewTable, botMove, gameById } from '../js/table.js';
import { BOTS } from '../js/bots/index.js';
import { meyerAtLeast } from '../js/bots/dice.js';
import { atLeast } from '../js/bots/util.js';

const seeded = (seed = 1) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const HOST_ONLY = ['next', 'go', 'draw', 'flip', 'bus'];

/** A table with a human host plus `bots` computer players, played to the end. */
function playOut(gameId, bots, rules = {}, seed = 1, maxSteps = 20000) {
  const rand = seeded(seed);
  let t = newTable({ code: 'BOTS', hostId: 'h' });
  t = applyTable(t, 'h', { type: 'join', name: 'Host' });
  for (let i = 0; i < bots; i++) t = applyTable(t, 'h', { type: 'addBot' }, rand);
  t = applyTable(t, 'h', { type: 'pick', gameId });
  if (Object.keys(rules).length) t = applyTable(t, 'h', { type: 'rules', rules });
  t = applyTable(t, 'h', { type: 'start' }, rand);
  let botMoves = 0;
  for (let step = 0; step < maxSteps; step++) {
    if (t.game.phase === 'over') return { t, botMoves };
    const m = botMove(t, rand);
    if (m) { t = applyTable(t, m.id, m.action, rand); botMoves++; continue; }
    // The host plays like a bot on its own turns, and taps "next", "turn a card" etc.
    const v = gameById[gameId].view(t.game, 'h');
    const own = BOTS[gameId](v, 'h', rand);
    if (own) { t = applyTable(t, 'h', { type: 'play', action: own }, rand); continue; }
    let moved = false;
    for (const type of HOST_ONLY) {
      try { t = applyTable(t, 'h', { type: 'play', action: { type } }, rand); moved = true; break; } catch { /* not this one */ }
    }
    if (!moved) throw new Error(`${gameId}: nobody can move (phase ${t.game.phase})`);
  }
  throw new Error(`${gameId}: did not finish`);
}

test('probability helpers', () => {
  assert.ok(Math.abs(atLeast(1, 1, 0.5) - 0.5) < 1e-9);
  assert.ok(Math.abs(atLeast(2, 3, 1 / 3) - 7 / 27) < 1e-9);
  assert.equal(atLeast(0, 5, 0.2), 1);
  assert.equal(atLeast(6, 5, 0.2), 0);
  assert.ok(Math.abs(meyerAtLeast('32') - 1) < 1e-9);
  assert.ok(Math.abs(meyerAtLeast('21') - 2 / 36) < 1e-9);
});

for (const [gameId, bots, rules] of [
  ['snyd', 3, {}],
  ['meyer', 3, { lives: 3 }],
  ['10000', 2, { target: 3000 }],
  ['gris', 3, {}],
  ['skib', 3, {}],
  ['yatzy', 2, {}],
  ['yatzy', 2, { mode: 'turns' }],
  ['hestelob', 3, {}],
  ['kongens-kop', 3, {}],
  ['bussen', 3, {}],
  ['snyd-kort', 3, {}],
  ['sjavs', 3, { rubber: 12 }],
]) {
  test(`bots play a whole game of ${gameId}${rules.mode ? ` (${rules.mode})` : ''} without an illegal move`, () => {
    for (const seed of [1, 2, 3]) {
      const { t, botMoves } = playOut(gameId, bots, rules, seed);
      assert.equal(t.game.phase, 'over');
      assert.ok(botMoves > 0);
    }
  });
}

test('bots sit out the party games', () => {
  let t = newTable({ code: 'BOTS', hostId: 'h' });
  t = applyTable(t, 'h', { type: 'join', name: 'Host' });
  t = applyTable(t, 'p', { type: 'join', name: 'Pia' });
  t = applyTable(t, 'q', { type: 'join', name: 'Q' });
  t = applyTable(t, 'h', { type: 'addBot' });
  t = applyTable(t, 'h', { type: 'pick', gameId: 'mest-sandsynligt' });
  t = applyTable(t, 'h', { type: 'start' });
  assert.deepEqual(t.seated, ['h', 'p', 'q']);
  assert.equal(botMove(t), null);
});

test('only the host adds bots, and bots never take over a human seat', () => {
  let t = newTable({ code: 'BOTS', hostId: 'h' });
  t = applyTable(t, 'h', { type: 'join', name: 'Host' });
  t = applyTable(t, 'p', { type: 'join', name: 'Pia' });
  assert.throws(() => applyTable(t, 'p', { type: 'addBot' }), /host/);
  t = applyTable(t, 'h', { type: 'addBot' }, () => 0);
  const bot = t.players.find((p) => p.bot);
  assert.equal(bot.name, 'Bent (bot)');
  t = applyTable(t, 'x', { type: 'join', name: 'Bent (bot)' });
  assert.equal(t.players.filter((p) => p.name === 'Bent (bot)').length, 2);
  t = applyTable(t, bot.id, { type: 'connected', value: false });
  assert.equal(t.players.find((p) => p.id === bot.id).connected, true);
});

test('a Snyd bot calls an impossible bid', () => {
  const { start, view } = gameById.snyd;
  const s = start(['h', 'b'], {}, seeded(4));
  s.players[0].dice = [2, 3, 4, 6]; s.players[1].dice = [2, 3, 4, 6];
  s.turn = 'b';
  s.bid = { count: 8, face: 5, by: 'h' };
  s.history = [s.bid];
  assert.deepEqual(BOTS.snyd(view(s, 'b'), 'b', seeded(1)), { type: 'snyd' });
});

test('a Snyd med kort bot calls when it holds the cards that make the claim impossible', () => {
  const { start, apply, view } = gameById['snyd-kort'];
  let s = start(['h', 'b', 'c'], {}, seeded(4));
  s.hands = { h: [{ r: 1, s: 'S' }, { r: 5, s: 'D' }], b: [{ r: 1, s: 'H' }, { r: 1, s: 'D' }, { r: 1, s: 'C' }], c: [{ r: 9, s: 'C' }] };
  s.turn = 'h';
  s.rank = 1;
  s = apply(s, 'h', { type: 'play', cards: [0, 1] }); // claims two aces; b holds three
  assert.deepEqual(BOTS['snyd-kort'](view(s, 'b'), 'b', seeded(1)), { type: 'call' });
});
