// Computer players for the dice games. Each bot gets the game exactly as its own seat sees it
// and returns one action, or null when it has nothing to do right now.
import { lowestBid, validBid, biddableFaces, handValue, activePlayers } from '../games/snyd.js';
import { allowedClaims, rollKey, rank, ORDER } from '../games/meyer.js';
import { bestKeep } from '../games/tiotusind.js';
import { CATEGORIES, score } from '../games/yatzy.js';
import { atLeast, chance } from './util.js';

// ---------- Snyd ----------
/** Chance a bid holds, given only our own dice. */
function snydOdds(g, me, bid) {
  const mine = g.players.find((p) => p.id === me);
  const own = handValue(mine.dice, bid.face, g.rules).value;
  const unknown = activePlayers(g).filter((p) => p.id !== me).reduce((a, p) => a + p.count, 0);
  const p = g.rules.onesWild && bid.face !== 1 ? 1 / 3 : 1 / 6;
  return atLeast(bid.count - own, unknown, p);
}

export function snyd(g, me, rand) {
  if (g.phase !== 'bidding' || g.turn !== me) return null;
  const key = `${me}:${g.round}:${g.history.length}`;
  const bluff = chance(`${key}:bluff`) < 0.2;
  if (g.bid && snydOdds(g, me, g.bid) < 0.35 + (bluff ? -0.2 : 0)) return { type: 'snyd' };
  // Consider the cheapest raise for every face, plus one extra die.
  const start = lowestBid(g);
  const options = [];
  for (const face of biddableFaces(g.rules)) {
    for (let count = start.count; count <= start.count + 1; count++) {
      const b = { count, face };
      if (!validBid(g, b)) options.push({ ...b, odds: snydOdds(g, me, b) });
    }
  }
  options.sort((a, b) => b.odds - a.odds || a.count - b.count);
  const best = options[0];
  if (!best) return g.bid ? { type: 'snyd' } : null;
  if (g.bid && best.odds < 0.25 && !bluff) return { type: 'snyd' };
  // Now and then pick the second-best option to be less predictable.
  const choice = options.length > 1 && chance(`${key}:mix`) < 0.25 ? options[1] : best;
  return { type: 'bid', count: choice.count, face: choice.face };
}

// ---------- Meyer ----------
const ROLL_P = Object.fromEntries(ORDER.map((k) => [k, k[0] === k[1] ? 1 / 36 : 2 / 36]));
/** Chance a fresh roll is at least `key`. */
export const meyerAtLeast = (key) => ORDER.filter((k) => rank(k) >= rank(key)).reduce((a, k) => a + ROLL_P[k], 0);

export function meyer(g, me, rand) {
  if (g.phase !== 'turn' || g.turn !== me) return null;
  const key = `${me}:${g.round}:${g.history.length}`;
  if (!g.cup) {
    if (g.claim) {
      // The claim might be a lie, so lift a little earlier than the raw odds say.
      const odds = meyerAtLeast(g.claim.key);
      if (odds < 0.3 + chance(`${key}:lift`) * 0.2) return { type: 'lift' };
    }
    return { type: 'roll' };
  }
  if (!g.cup.looked) {
    if (g.claim && g.rules.blindPass && chance(`${key}:blind`) < 0.08) return { type: 'blind' };
    return { type: 'look' };
  }
  const truth = rollKey(g.cup.dice);
  if (truth === '32' && g.rules.skaal) return { type: 'skaal' };
  const allowed = allowedClaims(g);
  if (allowed.includes(truth)) {
    // Mostly honest, sometimes a small exaggeration.
    const up = allowed.filter((k) => rank(k) > rank(truth));
    if (up.length && chance(`${key}:up`) < 0.2) return { type: 'announce', key: up[0] };
    return { type: 'announce', key: truth };
  }
  // Has to lie: the lowest allowed claim is the most believable, sometimes one above.
  const lie = chance(`${key}:lie`) < 0.25 && allowed[1] ? allowed[1] : allowed[0];
  return { type: 'announce', key: lie };
}

// ---------- 10.000 ----------
export function tiotusind(g, me) {
  if (g.phase !== 'turn' || g.turn !== me) return null;
  if (!g.roll.length) return { type: 'roll' };
  const best = bestKeep(g.roll, g.rules);
  const meP = g.players.find((p) => p.id === me);
  const total = g.turnPoints + best.pts;
  let left = g.diceLeft - best.idx.length;
  if (left === 0 && g.rules.hotDice) left = 5;
  const canBank = meP.score > 0 || total >= g.rules.openingMin;
  if (!canBank) return { type: 'roll', keep: best.idx };
  if (g.finalRound) {
    const lead = Math.max(...g.players.filter((p) => p.id !== me).map((p) => p.score));
    return meP.score + total > lead ? { type: 'bank', keep: best.idx } : { type: 'roll', keep: best.idx };
  }
  if (left === 5) return total >= 2000 ? { type: 'bank', keep: best.idx } : { type: 'roll', keep: best.idx };
  const enough = { 1: 250, 2: 300, 3: 400, 4: 1000 }[left] ?? 300;
  return total >= enough ? { type: 'bank', keep: best.idx } : { type: 'roll', keep: best.idx };
}

// ---------- Gris ----------
export function gris(g, me) {
  if (g.phase !== 'turn' || g.turn !== me) return null;
  const target = g.rules.target;
  const mine = g.scores[me];
  if (g.turnPoints && (mine + g.turnPoints >= target || g.turnPoints >= (g.rules.twoDice ? 18 : 20))) return { type: 'hold' };
  return { type: 'roll' };
}

// ---------- Skib, kaptajn og mandskab ----------
export function skib(g, me) {
  if (g.phase !== 'turn' || g.turn !== me) return null;
  if (g.found === 3 && g.dice.reduce((a, b) => a + b, 0) >= 8) return { type: 'stop' };
  return { type: 'roll' };
}

// ---------- Yatzy ----------
const SCRATCH = ['ones', 'yatzy', 'twos', 'four', 'large', 'small', 'threes', 'twoPairs', 'house', 'three', 'fours', 'pair', 'fives', 'sixes', 'chance'];

function yatzyPick(open, dice) {
  let best = null;
  for (const k of open) {
    let v = score(k, dice);
    if (k === 'chance') v -= 12; // keep chance for later
    if (['ones', 'twos', 'threes'].includes(k)) v += 2;
    if (!best || v > best.v) best = { k, v };
  }
  if (best && score(best.k, dice) > 0) return best.k;
  return SCRATCH.find((k) => open.includes(k)) || open[0];
}

export function yatzy(g, me) {
  if (g.phase !== 'play' || !g.order.includes(me)) return null;
  if (g.rules.mode === 'turns' && g.turn !== me) return null;
  const open = CATEGORIES.map(([k]) => k).filter((k) => !(k in g.sheets[me]));
  if (!open.length) return null;
  const t = g.turns[me];
  if (t.rollsLeft === 3) return { type: 'roll' };
  const done = ['yatzy', 'large', 'small', 'house'].find((k) => open.includes(k) && score(k, t.dice) > 0);
  if (done || t.rollsLeft === 0) return { type: 'score', cat: done || yatzyPick(open, t.dice) };
  // Hold the most common face (higher face on ties), then roll.
  const counts = [0, 0, 0, 0, 0, 0, 0];
  t.dice.forEach((d) => counts[d]++);
  let face = 6;
  for (let f = 6; f >= 1; f--) if (counts[f] > counts[face]) face = f;
  const want = t.dice.map((d) => d === face);
  const i = want.findIndex((w, j) => w !== t.held[j]);
  if (i >= 0) return { type: 'hold', index: i };
  return { type: 'roll' };
}
