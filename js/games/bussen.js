// Bussen (Ride the bus): four guessing questions build your hand, the pyramid hands out sips for
// matching cards, and whoever is left with the most cards rides the bus.
import { newDeck, SUITS } from './cards.js';

export const id = 'bussen';
export const name = 'Bussen';
export const category = 'cards';
export const tagline = 'Four guesses, the pyramid, and one unlucky bus ride.';
export const minPlayers = 2;
export const maxPlayers = 10;

export const defaults = {
  wrongCost: 'rising', // 'one': a wrong guess is 1 sip; 'rising': 1, 2, 3, 4 sips for questions 1-4
  pyramidRows: 4,
  busLength: 5,
};

export const ruleInfo = {
  wrongCost: { label: 'Wrong guesses cost', options: [['one', '1 sip'], ['rising', '1, 2, 3, 4 sips']] },
  pyramidRows: { label: 'Pyramid rows', options: [3, 4, 5] },
  busLength: { label: 'Bus length', options: [4, 5, 6] },
};

export const QUESTIONS = ['Red or black?', 'Higher or lower?', 'Between or outside?', 'Which suit?'];
export const value = (c) => (c.r === 1 ? 14 : c.r); // aces high

function draw(s, rand) {
  if (!s.deck.length) s.deck = newDeck(rand);
  return s.deck.pop();
}

export function start(playerIds, rules, rand = Math.random) {
  return {
    rules: { ...defaults, ...rules },
    order: playerIds.slice(),
    deck: newDeck(rand),
    hands: Object.fromEntries(playerIds.map((p) => [p, []])),
    drank: Object.fromEntries(playerIds.map((p) => [p, 0])),
    gave: Object.fromEntries(playerIds.map((p) => [p, 0])),
    phase: 'questions', // questions | pyramid | bus | over
    q: 1,
    turn: playerIds[0],
    last: null,
    pyramid: null,
    flipped: 0,
    lastFlip: null,
    bus: null,
    result: null,
  };
}

/** Was `guess` right for card `c` given the player's earlier cards? */
export function judge(q, guess, c, hand) {
  switch (q) {
    case 1: return guess === ((c.s === 'H' || c.s === 'D') ? 'red' : 'black');
    case 2: {
      const a = value(hand[0]);
      return (guess === 'higher' && value(c) > a) || (guess === 'lower' && value(c) < a);
    }
    case 3: {
      const lo = Math.min(value(hand[0]), value(hand[1]));
      const hi = Math.max(value(hand[0]), value(hand[1]));
      const v = value(c);
      return (guess === 'between' && v > lo && v < hi) || (guess === 'outside' && (v < lo || v > hi));
    }
    case 4: return guess === c.s;
    default: return false;
  }
}

function buildPyramid(s, rand) {
  // Row 1 is the bottom (widest, 1 sip); the top row is worth the most.
  const rows = [];
  const n = s.rules.pyramidRows;
  for (let r = 1; r <= n; r++) rows.push(Array.from({ length: n - r + 1 }, () => draw(s, rand)));
  s.pyramid = rows;
  s.flipped = 0;
  s.phase = 'pyramid';
  s.turn = null;
}

function pyramidCard(s, k) {
  let i = k;
  for (let r = 0; r < s.pyramid.length; r++) {
    if (i < s.pyramid[r].length) return { row: r + 1, card: s.pyramid[r][i] };
    i -= s.pyramid[r].length;
  }
  return null;
}
const pyramidSize = (s) => s.pyramid.reduce((a, r) => a + r.length, 0);

function boardBus(s, rand) {
  const most = Math.max(...s.order.map((p) => s.hands[p].length));
  const riders = s.order.filter((p) => s.hands[p].length === most);
  const rider = riders[Math.floor(rand() * riders.length)];
  s.phase = 'bus';
  s.bus = { rider, tries: 1, pos: 0, cards: [draw(s, rand)], last: null };
  s.turn = rider;
}

export function apply(s, pid, action, rand = Math.random) {
  const fail = (msg, params) => { throw Object.assign(new Error(msg), { params }); };
  switch (action.type) {
    case 'answer': {
      if (s.phase !== 'questions') fail('The questions are over.');
      if (s.turn !== pid) fail('It’s not your turn.');
      const c = draw(s, rand);
      const ok = judge(s.q, action.guess, c, s.hands[pid]);
      const cost = s.rules.wrongCost === 'rising' ? s.q : 1;
      if (!ok) s.drank[pid] += cost;
      s.hands[pid].push(c);
      s.last = { by: pid, q: s.q, guess: action.guess, card: c, ok, cost };
      const i = s.order.indexOf(pid);
      if (i === s.order.length - 1) {
        if (s.q === 4) buildPyramid(s, rand);
        else { s.q += 1; s.turn = s.order[0]; }
      } else s.turn = s.order[i + 1];
      break;
    }
    case 'flip': {
      if (s.phase !== 'pyramid') fail('Not at the pyramid.');
      const { row, card } = pyramidCard(s, s.flipped);
      s.flipped += 1;
      const matches = [];
      for (const p of s.order) {
        const same = s.hands[p].filter((h) => h.r === card.r);
        if (same.length) {
          s.hands[p] = s.hands[p].filter((h) => h.r !== card.r);
          s.gave[p] += row * same.length;
          matches.push({ id: p, count: same.length, sips: row * same.length });
        }
      }
      s.lastFlip = { card, row, matches };
      break;
    }
    case 'bus': {
      if (s.phase !== 'pyramid') fail('Not at the pyramid.');
      if (s.flipped < pyramidSize(s)) fail('Turn the whole pyramid first.');
      boardBus(s, rand);
      break;
    }
    case 'ride': {
      if (s.phase !== 'bus') fail('Nobody is on the bus.');
      if (pid !== s.bus.rider) fail('Only the rider guesses.');
      const b = s.bus;
      const cur = b.cards[b.pos];
      const next = draw(s, rand);
      const ok = (action.guess === 'higher' && value(next) > value(cur)) || (action.guess === 'lower' && value(next) < value(cur));
      b.cards.push(next);
      b.last = { guess: action.guess, card: next, ok };
      if (ok) {
        b.pos += 1;
        if (b.pos >= s.rules.busLength - 1) {
          s.phase = 'over';
          s.result = { rider: b.rider, tries: b.tries };
        }
      } else {
        s.drank[b.rider] += b.pos + 1;
        b.last.cost = b.pos + 1;
        b.tries += 1;
        b.pos = 0;
        b.cards = [next];
      }
      break;
    }
    default:
      fail('Unknown action.');
  }
  return s;
}

export function removePlayer(s, pid) {
  const i = s.order.indexOf(pid);
  s.order = s.order.filter((p) => p !== pid);
  if (s.order.length < 1) return false;
  delete s.hands[pid];
  if (s.phase === 'questions' && s.turn === pid) {
    if (i < s.order.length) s.turn = s.order[i];
    else if (s.q < 4) { s.q += 1; s.turn = s.order[0]; }
    else buildPyramid(s, Math.random);
  }
  if (s.phase === 'bus' && s.bus.rider === pid) { s.phase = 'over'; s.result = { rider: pid, tries: s.bus.tries, left: true }; }
  return true;
}

export function view(s, pid) {
  const shown = s.pyramid ? s.pyramid.map((row, r) => row.map((c, i) => {
    let k = i;
    for (let x = 0; x < r; x++) k += s.pyramid[x].length;
    return k < s.flipped ? c : null;
  })) : null;
  return { ...s, deck: s.deck.length, pyramid: shown, pyramidSize: s.pyramid ? pyramidSize(s) : 0, mine: s.hands[pid] || [] };
}

export { SUITS };
