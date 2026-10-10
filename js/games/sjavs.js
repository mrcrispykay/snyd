// Sjavs (Faroese rules, after pagat.com): four players in two fixed partnerships, 32 cards.
// Q♣ Q♠ J♣ J♠ J♥ J♦ are always the top trumps. Bid the length of your best trump suit (clubs wins ties).
// The declaring side needs 61 of the 120 card points. Each side counts down from 24.
import { shuffle } from './cards.js';

export const id = 'sjavs';
export const name = 'Sjavs';
export const category = 'cards';
export const tagline = 'The Faroese trick-taking classic. Two teams, the club queen on top.';
export const minPlayers = 4;
export const maxPlayers = 4;

export const defaults = {
  rubber: 24,
};

export const ruleInfo = {
  rubber: { label: 'Count down from', help: 'Each side starts here; first to 0 wins the rubber.', options: [12, 24] },
};

const PERMANENT = [[12, 'C'], [12, 'S'], [11, 'C'], [11, 'S'], [11, 'H'], [11, 'D']];
const ORDER = [1, 13, 12, 10, 9, 8, 7]; // A K Q 10 9 8 7
const POINTS = { 1: 11, 13: 4, 12: 3, 11: 2, 10: 10 };
export const SUITS = ['C', 'S', 'H', 'D'];

export const cardPoints = (c) => POINTS[c.r] || 0;
const permIndex = (c) => PERMANENT.findIndex(([r, s]) => c.r === r && c.s === s);
export const isTrump = (c, trump) => permIndex(c) >= 0 || c.s === trump;
/** Effective suit: 'T' for any trump. */
export const effSuit = (c, trump) => (isTrump(c, trump) ? 'T' : c.s);
/** Lower is stronger. */
export function strength(c, trump) {
  const p = permIndex(c);
  if (p >= 0) return p;
  if (c.s === trump) return 6 + ORDER.indexOf(c.r);
  return 100 + ORDER.indexOf(c.r);
}

export const trumpCount = (hand, suit) => hand.filter((c) => isTrump(c, suit)).length;

/** Is bid a ({length, clubs}) better than b? Longer wins; at equal length clubs wins. */
export const betterBid = (a, b) => !b || a.length > b.length || (a.length === b.length && a.clubs && !b.clubs);

export function newDeck32(rand = Math.random) {
  const cards = [];
  for (const s of SUITS) for (const r of [1, 7, 8, 9, 10, 11, 12, 13]) cards.push({ r, s });
  return shuffle(cards, rand);
}

export function legalCards(hand, trick, trump) {
  if (!trick.length) return hand.map((_, i) => i);
  const led = effSuit(trick[0].card, trump);
  const same = hand.map((c, i) => [c, i]).filter(([c]) => effSuit(c, trump) === led).map(([, i]) => i);
  return same.length ? same : hand.map((_, i) => i);
}

export function trickWinner(trick, trump) {
  const led = effSuit(trick[0].card, trump);
  let best = trick[0];
  for (const t of trick.slice(1)) {
    const tEff = effSuit(t.card, trump);
    const bEff = effSuit(best.card, trump);
    if (tEff === 'T' && bEff !== 'T') best = t;
    else if (tEff === bEff && (tEff === 'T' || tEff === led) && strength(t.card, trump) < strength(best.card, trump)) best = t;
  }
  return best.seat;
}

/**
 * Game score for one deal. Returns { side: 'decl' | 'def' | null, points }.
 * points: declaring side's card points; tricks: tricks per seat; declTeam: the declaring seats.
 */
export function scoreDeal({ points, tricksBySeat, declTeam, clubs }) {
  const declTricks = declTeam.reduce((a, s) => a + tricksBySeat[s], 0);
  if (declTricks === 8) {
    const solo = declTeam.some((s) => tricksBySeat[s] === 8);
    return { side: 'decl', points: solo ? (clubs ? 24 : 16) : (clubs ? 16 : 12), vol: true };
  }
  if (declTricks === 0) return { side: 'def', points: 16, vol: true };
  if (points >= 90) return { side: 'decl', points: clubs ? 8 : 4 };
  if (points >= 61) return { side: 'decl', points: clubs ? 4 : 2 };
  if (points === 60) return { side: null, points: 0, tie: true };
  if (points >= 31) return { side: 'def', points: clubs ? 8 : 4 };
  return { side: 'def', points: clubs ? 16 : 8 };
}

const teamOf = (seat) => seat % 2; // seats 0 & 2 are team 0, seats 1 & 3 team 1

export function start(playerIds, rules, rand = Math.random) {
  const s = {
    rules: { ...defaults, ...rules },
    seats: playerIds.slice(0, 4),
    crosses: [0, 0],
    dealer: Math.floor(rand() * 4),
    tieBonus: 0,
    deal: 0,
    history: [],
    result: null,
  };
  s.left = [s.rules.rubber, s.rules.rubber];
  newDeal(s, rand);
  return s;
}

function newDeal(s, rand) {
  const deck = newDeck32(rand);
  s.deal += 1;
  s.hands = [0, 1, 2, 3].map((i) => deck.slice(i * 8, i * 8 + 8));
  s.phase = 'bidding';
  s.bid = null; // { seat, length, clubs, suit }
  s.bidTurn = (s.dealer + 1) % 4;
  s.bidsLeft = 4;
  s.trump = null;
  s.declarer = null;
  s.trick = [];
  s.lastTrick = null;
  s.tricksBySeat = [0, 0, 0, 0];
  s.won = [[], []];
  s.turn = null;
  s.dealResult = null;
}

const seatOf = (s, pid) => s.seats.indexOf(pid);

export function apply(s, pid, action, rand = Math.random) {
  const fail = (msg) => { throw new Error(msg); };
  const seat = seatOf(s, pid);
  if (seat < 0) fail('You’re not at this table.');
  switch (action.type) {
    case 'bid':
    case 'pass': {
      if (s.phase !== 'bidding') fail('Bidding is over.');
      if (s.bidTurn !== seat) fail('It’s not your turn to bid.');
      if (action.type === 'bid') {
        const suit = action.suit;
        if (!SUITS.includes(suit)) fail('Pick a suit.');
        const length = trumpCount(s.hands[seat], suit);
        if (length < 5) fail('You need at least five trumps to bid.');
        const bid = { seat, length, clubs: suit === 'C', suit };
        if (!betterBid(bid, s.bid)) fail('That doesn’t beat the current bid.');
        s.bid = bid;
      }
      s.bidsLeft -= 1;
      s.bidTurn = (s.bidTurn + 1) % 4;
      if (s.bidsLeft === 0) {
        if (!s.bid) { newDeal(s, rand); s.dealResult = { redeal: true }; break; }
        s.trump = s.bid.suit;
        s.declarer = s.bid.seat;
        s.phase = 'playing';
        s.turn = (s.dealer + 1) % 4;
      }
      break;
    }
    case 'play': {
      if (s.phase !== 'playing') fail('Not playing right now.');
      if (s.turn !== seat) fail('It’s not your turn.');
      const i = Number(action.index);
      if (!legalCards(s.hands[seat], s.trick, s.trump).includes(i)) fail('You have to follow suit.');
      const card = s.hands[seat].splice(i, 1)[0];
      s.trick.push({ seat, card });
      if (s.trick.length < 4) { s.turn = (seat + 1) % 4; break; }
      const w = trickWinner(s.trick, s.trump);
      s.tricksBySeat[w] += 1;
      s.won[teamOf(w)].push(...s.trick.map((t) => t.card));
      s.lastTrick = { cards: s.trick, winner: w };
      s.trick = [];
      s.turn = w;
      if (s.hands.every((h) => !h.length)) finishDeal(s);
      break;
    }
    case 'next': {
      if (s.phase !== 'scored') fail('The deal isn’t finished.');
      s.dealer = (s.dealer + 1) % 4;
      newDeal(s, rand);
      break;
    }
    default:
      fail('Unknown action.');
  }
  return s;
}

function finishDeal(s) {
  const declTeam = teamOf(s.declarer);
  const points = s.won[declTeam].reduce((a, c) => a + cardPoints(c), 0);
  const res = scoreDeal({ points, tricksBySeat: s.tricksBySeat, declTeam: [declTeam, declTeam + 2], clubs: s.trump === 'C' });
  let team = null;
  let pts = res.points;
  if (res.side === 'decl') team = declTeam;
  if (res.side === 'def') team = 1 - declTeam;
  if (team !== null) { pts += s.tieBonus; s.tieBonus = 0; s.left[team] -= pts; } else s.tieBonus += 2;
  s.dealResult = { ...res, points: pts, team, declTeam, cardPoints: points, trump: s.trump, declarer: s.declarer };
  s.history.unshift({ deal: s.deal, team, points: pts, trump: s.trump });
  s.phase = 'scored';
  s.turn = null;
  if (team !== null && s.left[team] <= 0) {
    const other = 1 - team;
    s.phase = 'over';
    s.result = { team, double: s.left[other] === s.rules.rubber };
    s.crosses[team] += 1;
  }
}

export function removePlayer() {
  return false; // Sjavs needs exactly four
}

export function view(s, pid) {
  const seat = seatOf(s, pid);
  return {
    ...s,
    you: seat,
    hands: undefined,
    mine: seat >= 0 ? s.hands[seat] : [],
    counts: s.hands.map((h) => h.length),
    bid: s.bid ? { ...s.bid, suit: s.phase === 'bidding' && s.bid.seat !== seat ? null : s.bid.suit } : null,
    won: undefined,
    wonPoints: s.phase === 'scored' || s.phase === 'over' ? s.won.map((w) => w.reduce((a, c) => a + cardPoints(c), 0)) : null,
  };
}
