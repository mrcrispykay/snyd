// A standard 52-card deck. Ranks: 1 = ace … 11 = jack, 12 = queen, 13 = king. Suits: S H D C.

export const SUITS = ['S', 'H', 'D', 'C'];
export const SUIT_NAME = { S: 'Spades', H: 'Hearts', D: 'Diamonds', C: 'Clubs' };
export const SUIT_GLYPH = { S: '♠', H: '♥', D: '♦', C: '♣' };
export const RANK_LABEL = { 1: 'A', 11: 'J', 12: 'Q', 13: 'K' };
export const rankLabel = (r) => RANK_LABEL[r] || String(r);
export const isRed = (c) => c.s === 'H' || c.s === 'D';
export const cardName = (c) => `${rankLabel(c.r)}${SUIT_GLYPH[c.s]}`;

export function shuffle(items, rand = Math.random) {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function newDeck(rand = Math.random) {
  const cards = [];
  for (const s of SUITS) for (let r = 1; r <= 13; r++) cards.push({ r, s });
  return shuffle(cards, rand);
}
