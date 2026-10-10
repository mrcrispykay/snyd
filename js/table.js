// The table: who is sitting at it, which game is chosen, the house rules for each game, and the running game.
// Pure functions; the host's browser runs them and the tests run them in Node.
import * as snyd from './games/snyd.js';
import * as meyer from './games/meyer.js';
import * as tiotusind from './games/tiotusind.js';

export const GAMES = [snyd, meyer, tiotusind];
export const gameById = Object.fromEntries(GAMES.map((g) => [g.id, g]));

export function newTable({ code, hostId }) {
  return {
    code,
    hostId,
    players: [], // { id, name, connected }
    gameId: GAMES[0].id,
    rules: Object.fromEntries(GAMES.map((g) => [g.id, { ...g.defaults }])),
    phase: 'lobby', // lobby | playing
    game: null,
    seated: [], // ids of players in the running game
    version: 0,
  };
}

/** Applies one action and returns a new table (the input is left alone). Throws readable Errors. */
export function applyTable(prev, pid, action, rand = Math.random) {
  const t = structuredClone(prev);
  const me = t.players.find((p) => p.id === pid);
  const isHost = pid === t.hostId;
  const fail = (msg) => { throw new Error(msg); };
  const G = gameById[t.gameId];

  switch (action.type) {
    case 'join': {
      const name = String(action.name || '').trim().slice(0, 20) || 'Player';
      if (me) { me.name = name; me.connected = true; break; }
      // Someone rejoining from a new tab takes back their seat by name.
      const seat = t.players.find((p) => !p.connected && p.name.toLowerCase() === name.toLowerCase());
      if (seat) {
        const old = seat.id;
        seat.id = pid; seat.connected = true;
        if (t.hostId === old) t.hostId = pid;
        t.seated = t.seated.map((x) => (x === old ? pid : x));
        if (t.game) renameInGame(t.game, old, pid);
        break;
      }
      if (t.players.length >= 12) fail('The table is full.');
      // Newcomers during a game watch and join the next one.
      t.players.push({ id: pid, name, connected: true });
      break;
    }
    case 'connected': {
      if (me) me.connected = !!action.value;
      break;
    }
    case 'pick': {
      if (!isHost) fail('Only the host picks the game.');
      if (t.phase !== 'lobby') fail('Finish or stop this game first.');
      if (!gameById[action.gameId]) fail('Unknown game.');
      t.gameId = action.gameId;
      break;
    }
    case 'rules': {
      if (!isHost) fail('Only the host can change the rules.');
      if (t.phase !== 'lobby') fail('Rules can only change between games.');
      t.rules[t.gameId] = { ...t.rules[t.gameId], ...action.rules };
      break;
    }
    case 'remove': {
      if (!isHost) fail('Only the host can remove players.');
      if (action.id === t.hostId) break;
      t.players = t.players.filter((p) => p.id !== action.id);
      if (t.phase === 'playing' && t.seated.includes(action.id)) {
        t.seated = t.seated.filter((x) => x !== action.id);
        const goesOn = G.removePlayer ? G.removePlayer(t.game, action.id, rand) : false;
        if (!goesOn) { t.phase = 'lobby'; t.game = null; t.seated = []; }
      }
      break;
    }
    case 'start': {
      if (!isHost) fail('Only the host can start.');
      const ids = t.players.map((p) => p.id);
      if (ids.length < G.minPlayers) fail(`${G.name} needs at least ${G.minPlayers} players.`);
      if (ids.length > G.maxPlayers) fail(`${G.name} takes at most ${G.maxPlayers} players.`);
      t.seated = ids;
      t.game = G.start(ids, t.rules[t.gameId], rand);
      t.phase = 'playing';
      break;
    }
    case 'lobby': {
      if (!isHost) fail('Only the host can do that.');
      t.phase = 'lobby';
      t.game = null;
      t.seated = [];
      break;
    }
    case 'play': {
      if (t.phase !== 'playing') fail('No game is running.');
      if (!t.seated.includes(pid)) fail('You’re watching this game. You can join the next one.');
      G.apply(t.game, pid, action.action || {}, rand);
      break;
    }
    default:
      fail('Unknown action.');
  }
  t.version += 1;
  return t;
}

/** Swaps a player id everywhere inside a game state (used when someone rejoins from a new tab). */
function renameInGame(game, from, to) {
  const walk = (o) => {
    if (Array.isArray(o)) { for (let i = 0; i < o.length; i++) { if (o[i] === from) o[i] = to; else walk(o[i]); } return; }
    if (o && typeof o === 'object') {
      for (const k of Object.keys(o)) { if (o[k] === from) o[k] = to; else walk(o[k]); }
    }
  };
  walk(game);
}

export function viewTable(t, pid) {
  return { ...t, you: pid, game: t.game ? gameById[t.gameId].view(t.game, pid) : null };
}
