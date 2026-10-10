// Hesteløb (horse race): the four aces race up a track as cards are turned. Bet sips on a horse.
// When every horse has passed a track card, it is turned and that suit's horse steps back.
import { newDeck, SUITS, shuffle } from './cards.js';

export const id = 'hestelob';
export const name = 'Hesteløb';
export const category = 'cards';
export const tagline = 'Bet sips on an ace and watch the horse race.';
export const minPlayers = 2;
export const maxPlayers = 12;

export const defaults = {
  trackLength: 7,
  payout: 2, // winners hand out their bet × payout
};

export const ruleInfo = {
  trackLength: { label: 'Track length', options: [5, 7, 9] },
  payout: { label: 'Winners hand out', options: [[1, 'Their bet'], [2, 'Double their bet']] },
};

export function start(playerIds, rules, rand = Math.random) {
  const r = { ...defaults, ...rules };
  const deck = newDeck(rand).filter((c) => c.r !== 1);
  const track = deck.splice(0, r.trackLength);
  return {
    rules: r,
    players: playerIds.slice(),
    phase: 'betting', // betting | race | over
    bets: {}, // pid -> { suit, sips }
    horses: { S: 0, H: 0, D: 0, C: 0 },
    track,
    trackShown: track.map(() => false),
    deck,
    used: [],
    last: null,
    winner: null,
    result: null,
  };
}

const finish = (s) => s.rules.trackLength + 1;

export function apply(s, pid, action, rand = Math.random, meta = {}) {
  const fail = (msg) => { throw new Error(msg); };
  switch (action.type) {
    case 'bet': {
      if (s.phase !== 'betting') fail('Bets are closed.');
      if (!SUITS.includes(action.suit)) fail('Pick a horse.');
      const sips = Math.round(Number(action.sips));
      if (!(sips >= 1 && sips <= 20)) fail('Bet between 1 and 20 sips.');
      s.bets[pid] = { suit: action.suit, sips };
      break;
    }
    case 'go': {
      if (s.phase !== 'betting') fail('The race has started.');
      const all = s.players.every((p) => s.bets[p]);
      if (!all && !meta.isHost) fail('Waiting for everyone to bet.');
      if (!Object.keys(s.bets).length) fail('Nobody has bet yet.');
      s.phase = 'race';
      break;
    }
    case 'draw': {
      if (s.phase !== 'race') fail('The race isn’t running.');
      if (!s.deck.length) { s.deck = shuffle(s.used, rand); s.used = []; }
      const card = s.deck.pop();
      s.used.push(card);
      s.horses[card.s] += 1;
      s.last = { card, back: null };
      if (s.horses[card.s] >= finish(s)) { win(s, card.s); break; }
      // Turn every track card that all horses have passed; its suit steps back.
      for (let i = 0; i < s.track.length; i++) {
        if (s.trackShown[i]) continue;
        if (SUITS.every((x) => s.horses[x] >= i + 1)) {
          s.trackShown[i] = true;
          const t = s.track[i];
          s.horses[t.s] = Math.max(0, s.horses[t.s] - 1);
          s.last.back = t;
        }
      }
      break;
    }
    default:
      fail('Unknown action.');
  }
  return s;
}

function win(s, suit) {
  s.phase = 'over';
  s.winner = suit;
  s.result = s.players.filter((p) => s.bets[p]).map((p) => {
    const b = s.bets[p];
    return b.suit === suit ? { id: p, gives: b.sips * s.rules.payout } : { id: p, drinks: b.sips };
  });
}

export function removePlayer(s, pid) {
  s.players = s.players.filter((p) => p !== pid);
  delete s.bets[pid];
  return s.players.length >= 1;
}

export function view(s) {
  return { ...s, deck: s.deck.length, used: s.used.length, track: s.track.map((c, i) => (s.trackShown[i] ? c : null)) };
}
