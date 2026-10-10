// The table: who is sitting at it, which game is chosen, the house rules for each game, and the running game.
// Pure functions; the host's browser runs them and the tests run them in Node.
import * as snyd from './games/snyd.js';
import * as meyer from './games/meyer.js';
import * as tiotusind from './games/tiotusind.js';
import * as hestelob from './games/hestelob.js';
import * as kongensKop from './games/kongens-kop.js';
import * as mestSandsynligt from './games/mest-sandsynligt.js';
import * as jegHarAldrig from './games/jeg-har-aldrig.js';
import * as skib from './games/skib.js';
import * as gris from './games/gris.js';
import * as yatzy from './games/yatzy.js';
import * as bussen from './games/bussen.js';
import * as snydKort from './games/snyd-kort.js';
import * as sjavs from './games/sjavs.js';
import { BOTS, BOT_NAMES } from './bots/index.js';

export const GAMES = [snyd, meyer, tiotusind, yatzy, skib, gris, hestelob, kongensKop, bussen, snydKort, sjavs, mestSandsynligt, jegHarAldrig];
export const CATEGORIES = [['dice', 'Dice'], ['cards', 'Cards'], ['party', 'Party']];
export const gameById = Object.fromEntries(GAMES.map((g) => [g.id, g]));
export const hasBots = (gameId) => !!BOTS[gameId];

export function newTable({ code, hostId }) {
  return {
    code,
    hostId,
    players: [], // { id, name, connected, bot? }
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
  t.rules = allRules(t);
  const me = t.players.find((p) => p.id === pid);
  const isHost = pid === t.hostId;
  const fail = (msg) => { throw new Error(msg); };
  const G = gameById[t.gameId];

  switch (action.type) {
    case 'join': {
      const name = String(action.name || '').trim().slice(0, 20) || 'Player';
      if (me) { me.name = name; me.connected = true; break; }
      // Someone rejoining from a new tab takes back their seat by name.
      const seat = t.players.find((p) => !p.bot && !p.connected && p.name.toLowerCase() === name.toLowerCase());
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
      if (me && !me.bot) me.connected = !!action.value;
      break;
    }
    case 'addBot': {
      if (!isHost) fail('Only the host can add computer players.');
      if (t.phase !== 'lobby') fail('Add computer players between games.');
      if (t.players.length >= 12) fail('The table is full.');
      const used = new Set(t.players.map((p) => p.name));
      const free = BOT_NAMES.filter((n) => !used.has(`${n} (bot)`));
      const base = free.length ? free[Math.floor(rand() * free.length)] : `Bot ${t.players.length + 1}`;
      t.players.push({ id: `bot-${Math.floor(rand() * 1e9).toString(36)}`, name: `${base} (bot)`, connected: true, bot: true });
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
      // Computer players only sit in games that have a bot for them.
      const ids = t.players.filter((p) => !p.bot || hasBots(t.gameId)).map((p) => p.id);
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
      G.apply(t.game, pid, action.action || {}, rand, { isHost });
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
      for (const k of Object.keys(o)) {
        if (o[k] === from) o[k] = to; else walk(o[k]);
        if (k === from) { o[to] = o[k]; delete o[k]; }
      }
    }
  };
  walk(game);
}

/** House rules for every game, with defaults filled in for games or settings added since the table was saved. */
export const allRules = (t) => Object.fromEntries(GAMES.map((g) => [g.id, { ...g.defaults, ...(t.rules?.[g.id] || {}) }]));

/**
 * The next move a computer player wants to make, as { id, action } for applyTable, or null.
 * Each bot decides from its own seat's view of the game, so it can't see hidden cards or dice.
 */
export function botMove(t, rand = Math.random) {
  if (t.phase !== 'playing' || !t.game) return null;
  const bot = BOTS[t.gameId];
  if (!bot) return null;
  const G = gameById[t.gameId];
  for (const p of t.players) {
    if (!p.bot || !t.seated.includes(p.id)) continue;
    const v = G.view(t.game, p.id);
    if (v.phase === 'over') return null;
    const action = bot(v, p.id, rand);
    if (action) return { id: p.id, action: { type: 'play', action } };
  }
  return null;
}

export function viewTable(t, pid) {
  return { ...t, rules: allRules(t), you: pid, game: t.game ? gameById[t.gameId].view(t.game, pid) : null };
}
