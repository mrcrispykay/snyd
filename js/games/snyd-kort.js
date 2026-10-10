// Snyd med kort (Cheat / Bullshit): play cards face down, claiming they're the next rank.
// Anyone can call "Snyd!" before the next player plays. Get rid of all your cards to win.
import { newDeck } from './cards.js';

export const id = 'snyd-kort';
export const name = 'Snyd med kort';
export const category = 'cards';
export const tagline = 'Play cards face down and lie about them. Empty your hand first.';
export const minPlayers = 3;
export const maxPlayers = 8;

export const defaults = {
  maxCards: 4,
};

export const ruleInfo = {
  maxCards: { label: 'Most cards in one play', options: [3, 4] },
};

export const RANK_NAME = { 1: 'aces', 11: 'jacks', 12: 'queens', 13: 'kings' };
export const rankName = (r) => RANK_NAME[r] || `${r}s`;
const nextRank = (r) => (r % 13) + 1;

export function start(playerIds, rules, rand = Math.random) {
  const deck = newDeck(rand);
  const order = playerIds.slice();
  const hands = Object.fromEntries(order.map((p) => [p, []]));
  deck.forEach((c, i) => hands[order[i % order.length]].push(c));
  return {
    rules: { ...defaults, ...rules },
    order,
    hands,
    pile: [],
    rank: 1,
    turn: order[Math.floor(rand() * order.length)],
    lastPlay: null, // { by, count, rank, cards, open }
    reveal: null,
    log: [],
    phase: 'play', // play | reveal | over
    result: null,
  };
}

const after = (s, pid) => s.order[(s.order.indexOf(pid) + 1) % s.order.length];

/** The previous play stands. If that player has no cards left, they win. */
function accept(s) {
  const lp = s.lastPlay;
  if (!lp || !lp.open) return false;
  lp.open = false;
  if (!s.hands[lp.by].length) {
    s.phase = 'over';
    s.result = { winner: lp.by };
    return true;
  }
  return false;
}

export function apply(s, pid, action) {
  const fail = (msg) => { throw new Error(msg); };
  switch (action.type) {
    case 'play': {
      if (s.phase !== 'play') fail('Wait for the next turn.');
      if (s.turn !== pid) fail('It’s not your turn.');
      const idx = [...new Set((action.cards || []).map(Number))].filter((i) => i >= 0 && i < s.hands[pid].length);
      if (!idx.length || idx.length > s.rules.maxCards) fail(`Play 1 to ${s.rules.maxCards} cards.`);
      if (accept(s)) return s;
      const cards = idx.map((i) => s.hands[pid][i]);
      s.hands[pid] = s.hands[pid].filter((_, i) => !idx.includes(i));
      s.pile.push(...cards);
      s.lastPlay = { by: pid, count: cards.length, rank: s.rank, cards, open: true };
      s.log.unshift({ by: pid, count: cards.length, rank: s.rank });
      s.log = s.log.slice(0, 6);
      s.rank = nextRank(s.rank);
      s.turn = after(s, pid);
      break;
    }
    case 'call': {
      if (s.phase !== 'play') fail('Wait for the next turn.');
      const lp = s.lastPlay;
      if (!lp || !lp.open) fail('There’s nothing to call.');
      if (lp.by === pid) fail('You can’t call your own play.');
      const truthful = lp.cards.every((c) => c.r === lp.rank);
      const taker = truthful ? pid : lp.by;
      s.hands[taker].push(...s.pile);
      s.reveal = { caller: pid, by: lp.by, cards: lp.cards, rank: lp.rank, truthful, taker, pile: s.pile.length };
      s.pile = [];
      lp.open = false;
      s.phase = 'reveal';
      if (truthful && !s.hands[lp.by].length) { s.phase = 'over'; s.result = { winner: lp.by }; }
      break;
    }
    case 'next': {
      if (s.phase !== 'reveal') fail('Nothing to continue.');
      s.phase = 'play';
      s.reveal = null;
      break;
    }
    default:
      fail('Unknown action.');
  }
  return s;
}

export function removePlayer(s, pid) {
  const cards = s.hands[pid] || [];
  const nxt = after(s, pid);
  s.order = s.order.filter((p) => p !== pid);
  delete s.hands[pid];
  if (s.order.length < 2) return false;
  s.pile.push(...cards);
  if (s.turn === pid) s.turn = nxt;
  if (s.lastPlay?.by === pid) s.lastPlay.open = false;
  return true;
}

/** Your own hand only; played cards stay face down until someone calls. */
export function view(s, pid) {
  return {
    ...s,
    hands: undefined,
    counts: Object.fromEntries(s.order.map((p) => [p, s.hands[p].length])),
    mine: (s.hands[pid] || []).map((c, i) => ({ ...c, i })).sort((a, b) => a.r - b.r || a.s.localeCompare(b.s)),
    pile: s.pile.length,
    lastPlay: s.lastPlay ? { ...s.lastPlay, cards: undefined } : null,
  };
}
