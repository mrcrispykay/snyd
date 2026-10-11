// Kongens kop (King's Cup): take turns drawing a card and do what it says. The fourth king drinks the cup.
import { newDeck } from './cards.js';

export const id = 'kongens-kop';
export const name = 'Kongens kop';
export const category = 'cards';
export const tagline = 'Draw a card, follow its rule. Don’t draw the last king.';
export const minPlayers = 2;
export const maxPlayers = 12;

export const defaults = {
  r1: 'Waterfall: Everyone drinks. You can’t stop before the person before you stops.',
  r2: 'You: Pick someone to drink.',
  r3: 'Me: You drink.',
  r4: 'Floor: Last one to touch the floor drinks.',
  r5: 'Guys: All the guys drink.',
  r6: 'Girls: All the girls drink.',
  r7: 'Heaven: Last one to point at the sky drinks.',
  r8: 'Mate: Pick a drinking buddy. They drink whenever you do.',
  r9: 'Rhyme: Say a word. Go round rhyming on it. First to fail drinks.',
  r10: 'Categories: Pick a category. Go round naming things in it. First to fail drinks.',
  r11: 'Rule: Make a rule. Anyone who breaks it drinks.',
  r12: 'Questions: You’re question master. Anyone who answers your question drinks.',
  r13: 'King: Pour some of your drink into the cup. The fourth king drinks it all.',
};

const LABEL = { 1: 'Ace', 11: 'Jack', 12: 'Queen', 13: 'King' };
export const ruleInfo = Object.fromEntries(Array.from({ length: 13 }, (_, i) => [`r${i + 1}`, { label: LABEL[i + 1] || String(i + 1), text: true }]));

/** Splits a rule text into its title and description at the first colon. */
export function ruleFor(rules, rank) {
  const text = rules[`r${rank}`] || '';
  const i = text.indexOf(':');
  return i > 0 ? { title: text.slice(0, i).trim(), text: text.slice(i + 1).trim() } : { title: text.trim(), text: '' };
}

export function start(playerIds, rules, rand = Math.random) {
  return {
    rules: { ...defaults, ...rules },
    players: playerIds.slice(),
    phase: 'play',
    deck: newDeck(rand),
    turn: playerIds[Math.floor(rand() * playerIds.length)],
    current: null,
    kings: 0,
    history: [],
    result: null,
  };
}

export function apply(s, pid, action) {
  const fail = (msg, params) => { throw Object.assign(new Error(msg), { params }); };
  if (action.type !== 'draw') fail('Unknown action.');
  if (s.phase !== 'play') fail('The game is over.');
  if (s.turn !== pid) fail('It’s not your turn.');
  const card = s.deck.pop();
  s.current = { card, by: pid };
  s.history.unshift({ card, by: pid });
  s.history = s.history.slice(0, 8);
  if (card.r === 13) s.kings += 1;
  if (s.kings >= 4 || !s.deck.length) {
    s.phase = 'over';
    s.result = { cup: s.kings >= 4 ? pid : null };
    return s;
  }
  const i = s.players.indexOf(pid);
  s.turn = s.players[(i + 1) % s.players.length];
  return s;
}

export function removePlayer(s, pid) {
  const i = s.players.indexOf(pid);
  s.players = s.players.filter((p) => p !== pid);
  if (s.players.length < 1) return false;
  if (s.turn === pid) s.turn = s.players[i % s.players.length];
  return true;
}

export const view = (s) => ({ ...s, deck: s.deck.length });
