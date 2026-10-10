import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newTable, applyTable, viewTable, GAMES } from '../js/table.js';

const seeded = (seed = 1) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

function table() {
  let t = newTable({ code: 'TEST', hostId: 'h' });
  t = applyTable(t, 'h', { type: 'join', name: 'Host' });
  t = applyTable(t, 'p', { type: 'join', name: 'Pia' });
  return t;
}

test('only the host picks the game and the rules', () => {
  let t = table();
  assert.throws(() => applyTable(t, 'p', { type: 'pick', gameId: 'meyer' }), /host/);
  t = applyTable(t, 'h', { type: 'pick', gameId: 'meyer' });
  t = applyTable(t, 'h', { type: 'rules', rules: { lives: 3 } });
  assert.equal(t.gameId, 'meyer');
  assert.equal(t.rules.meyer.lives, 3);
  assert.equal(t.rules.snyd.dicePerPlayer, 4);
});

test('each game starts from the table and takes actions through it', () => {
  for (const gameId of ['snyd', 'meyer', '10000']) {
    let t = applyTable(table(), 'h', { type: 'pick', gameId });
    t = applyTable(t, 'h', { type: 'start' }, seeded(4));
    assert.equal(t.phase, 'playing');
    assert.deepEqual(t.seated, ['h', 'p']);
    const v = viewTable(t, 'p');
    assert.ok(v.game);
  }
});

test('a game action from someone not seated is refused, newcomers watch', () => {
  let t = applyTable(table(), 'h', { type: 'start' }, seeded(4));
  t = applyTable(t, 'x', { type: 'join', name: 'Late' });
  assert.equal(t.players.length, 3);
  assert.throws(() => applyTable(t, 'x', { type: 'play', action: { type: 'snyd' } }), /watching/);
});

test('rejoining by name mid-game swaps the id inside the game too', () => {
  let t = applyTable(table(), 'h', { type: 'pick', gameId: 'meyer' });
  t = applyTable(t, 'h', { type: 'start' }, seeded(4));
  t = applyTable(t, 'p', { type: 'connected', value: false });
  t = applyTable(t, 'p2', { type: 'join', name: 'pia' });
  assert.deepEqual(t.seated, ['h', 'p2']);
  assert.ok(t.game.players.some((x) => x.id === 'p2'));
});

test('removing a player from a two-player game returns to the lobby', () => {
  let t = applyTable(table(), 'h', { type: 'start' }, seeded(4));
  t = applyTable(t, 'h', { type: 'remove', id: 'p' });
  assert.equal(t.phase, 'lobby');
  assert.equal(t.players.length, 1);
});

test('every game on the menu starts with three players and has a view', () => {
  for (const g of GAMES) {
    let t = applyTable(table(), 'q', { type: 'join', name: 'Q' });
    t = applyTable(t, 'h', { type: 'pick', gameId: g.id });
    t = applyTable(t, 'h', { type: 'start' }, seeded(6));
    assert.equal(t.phase, 'playing', g.id);
    assert.doesNotThrow(() => JSON.stringify(viewTable(t, 'q')), g.id);
  }
});

test('a table saved before a game existed still gets that game’s rules', () => {
  const t = table();
  delete t.rules.yatzy;
  let u = applyTable(t, 'h', { type: 'pick', gameId: 'yatzy' });
  assert.equal(u.rules.yatzy.mode, 'together');
  assert.equal(viewTable(t, 'h').rules.yatzy.mode, 'together');
  u = applyTable(u, 'h', { type: 'start' });
  assert.equal(u.phase, 'playing');
});
