// Computer players for the card games.
import { legalCards, trickWinner, strength, cardPoints, trumpCount, betterBid, SUITS as SJAVS_SUITS } from '../games/sjavs.js';
import { value as bussenValue } from '../games/bussen.js';
import { chance, pick } from './util.js';

// ---------- Sjavs ----------
export function sjavs(g, me, rand) {
  const seat = g.you;
  if (seat < 0) return null;
  if (g.phase === 'bidding') {
    if (g.bidTurn !== seat) return null;
    const options = SJAVS_SUITS.map((s) => ({ s, length: trumpCount(g.mine, s), clubs: s === 'C' }))
      .filter((o) => o.length >= 5 && betterBid(o, g.bid))
      .sort((a, b) => b.length - a.length || (b.clubs ? 1 : 0) - (a.clubs ? 1 : 0));
    return options.length ? { type: 'bid', suit: options[0].s } : { type: 'pass' };
  }
  if (g.phase !== 'playing' || g.turn !== seat) return null;
  const legal = legalCards(g.mine, g.trick, g.trump);
  const cards = legal.map((i) => ({ i, c: g.mine[i] }));
  const weakest = (list) => list.slice().sort((a, b) => cardPoints(a.c) - cardPoints(b.c) || strength(b.c, g.trump) - strength(a.c, g.trump))[0];

  if (!g.trick.length) {
    // Lead an ace in a plain suit if possible, else the weakest card; lead trumps when strong in them.
    const declaring = g.declarer % 2 === seat % 2;
    const trumps = cards.filter(({ c }) => strength(c, g.trump) < 100);
    if (declaring && trumps.length >= 3) return { type: 'play', index: trumps.sort((a, b) => strength(a.c, g.trump) - strength(b.c, g.trump))[0].i };
    const ace = cards.find(({ c }) => c.r === 1 && strength(c, g.trump) >= 100);
    return { type: 'play', index: (ace || weakest(cards)).i };
  }

  const winner = trickWinner(g.trick, g.trump);
  const partnerWins = winner % 2 === seat % 2;
  const last = g.trick.length === 3;
  if (partnerWins && (last || strength(g.trick.find((t) => t.seat === winner).card, g.trump) < 8)) {
    // Partner has it: give them points, but don't waste a top trump.
    const smear = cards.filter(({ c }) => strength(c, g.trump) >= 6).sort((a, b) => cardPoints(b.c) - cardPoints(a.c))[0];
    return { type: 'play', index: (smear || weakest(cards)).i };
  }
  const winners = cards.filter(({ c }) => trickWinner([...g.trick, { seat, card: c }], g.trump) === seat);
  const pointsOnTable = g.trick.reduce((a, t) => a + cardPoints(t.card), 0);
  if (winners.length && (last || pointsOnTable >= 10 || partnerWins === false)) {
    // Win as cheaply as possible.
    const cheap = winners.sort((a, b) => strength(b.c, g.trump) - strength(a.c, g.trump) || cardPoints(a.c) - cardPoints(b.c))[0];
    return { type: 'play', index: cheap.i };
  }
  return { type: 'play', index: weakest(cards).i };
}

// ---------- Snyd med kort ----------
export function snydKort(g, me, rand) {
  if (!g.order.includes(me)) return null;
  const lp = g.lastPlay;
  // Calling: impossible claims always, last cards usually, otherwise now and then.
  if (g.phase === 'play' && lp && lp.open && lp.by !== me) {
    const mineOfRank = g.mine.filter((c) => c.r === lp.rank).length;
    const key = `${me}:${g.log.length}:${g.pile}:${lp.by}`;
    const impossible = mineOfRank + lp.count > 4;
    const finishing = g.counts[lp.by] === 0;
    const suspicious = lp.count >= 3 || (lp.count === 2 && mineOfRank >= 2);
    if (impossible || (finishing && chance(`${key}:fin`) < 0.85) || (suspicious && chance(`${key}:sus`) < 0.35) || chance(`${key}:any`) < 0.08) {
      return { type: 'call' };
    }
  }
  if (g.phase !== 'play' || g.turn !== me) return null;
  const real = g.mine.filter((c) => c.r === g.rank).slice(0, g.rules.maxCards);
  if (real.length) {
    // Sometimes sneak one extra card in with the real ones.
    const extra = real.length < g.rules.maxCards && chance(`${me}:${g.log.length}:sneak`) < 0.25
      ? g.mine.filter((c) => c.r !== g.rank).slice(-1) : [];
    return { type: 'play', cards: [...real, ...extra].map((c) => c.i) };
  }
  // Bluff with the card whose rank is furthest away in the order.
  const dist = (c) => ((c.r - g.rank + 13) % 13);
  const far = g.mine.slice().sort((a, b) => dist(b) - dist(a))[0];
  return { type: 'play', cards: [far.i] };
}

// ---------- Hesteløb ----------
export function hestelob(g, me, rand) {
  if (g.phase !== 'betting' || !g.players.includes(me) || g.bets[me]) return null;
  return { type: 'bet', suit: pick(['S', 'H', 'D', 'C'], rand), sips: 1 + Math.floor(rand() * 4) };
}

// ---------- Kongens kop ----------
export function kongensKop(g, me) {
  return g.phase === 'play' && g.turn === me ? { type: 'draw' } : null;
}

// ---------- Bussen ----------
export function bussen(g, me, rand) {
  if (g.phase === 'questions' && g.turn === me) {
    const hand = g.hands[me];
    if (g.q === 1) return { type: 'answer', guess: rand() < 0.5 ? 'red' : 'black' };
    if (g.q === 2) return { type: 'answer', guess: bussenValue(hand[0]) >= 8 ? 'lower' : 'higher' };
    if (g.q === 3) {
      const gap = Math.abs(bussenValue(hand[0]) - bussenValue(hand[1]));
      return { type: 'answer', guess: gap >= 7 ? 'between' : 'outside' };
    }
    return { type: 'answer', guess: pick(['S', 'H', 'D', 'C'], rand) };
  }
  if (g.phase === 'bus' && g.bus.rider === me) {
    const cur = g.bus.cards[g.bus.pos];
    return { type: 'ride', guess: bussenValue(cur) >= 8 ? 'lower' : 'higher' };
  }
  return null;
}
