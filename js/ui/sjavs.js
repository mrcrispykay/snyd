// Sjavs screen.
import { legalCards, strength, isTrump, trumpCount, betterBid, SUITS } from '../games/sjavs.js';
import { card, suitGlyph } from './common.js';

const SUIT_NAME = { C: 'clubs', S: 'spades', H: 'hearts', D: 'diamonds' };

export function howTo(r) {
  return `
    <li>Four players in two teams. Partners sit opposite: players 1 and 3 against 2 and 4, in the order you joined.</li>
    <li>32 cards, 8 each. <b>Q♣ Q♠ J♣ J♠ J♥ J♦</b> are always the highest trumps, then A K Q 10 9 8 7 of the trump suit.</li>
    <li><b>Bidding:</b> say how many trumps you’d have (at least 5) in your best suit. Longer beats shorter; at equal length clubs wins. The best bidder’s suit becomes trumps. If everyone passes, the cards are dealt again.</li>
    <li>Follow suit if you can (trumps count as their own suit). Otherwise play anything. Highest trump wins, else the highest card of the suit led.</li>
    <li>Card points: A 11, 10 10, K 4, Q 3, J 2. The trump side needs <b>61 of 120</b>. Scores (double with clubs as trumps): 61–89 is 2, 90+ is 4, all tricks 12 (16 if one player takes them all). If the trump side loses, the others get 4, or 8 if the trump side had 30 or less, and 16 if it took no tricks. 60–60 scores nothing and adds 2 to the next deal.</li>
    <li>Each team counts down from ${r.rubber}. First to 0 wins.</li>`;
}

export const rulesSummary = (r) => `count down from ${r.rubber}`;
export const isMyTurn = (g, me) => (g.phase === 'bidding' && g.bidTurn === g.you) || (g.phase === 'playing' && g.turn === g.you);

const sortHand = (hand, trump) => hand.map((c, i) => ({ c, i })).sort((a, b) => {
  const ta = trump ? isTrump(a.c, trump) : false;
  const tb = trump ? isTrump(b.c, trump) : false;
  if (ta !== tb) return ta ? -1 : 1;
  if (!ta && a.c.s !== b.c.s) return SUITS.indexOf(a.c.s) - SUITS.indexOf(b.c.s);
  return strength(a.c, trump || 'X') - strength(b.c, trump || 'X');
});

export function render(g, ctx) {
  const ui = ctx.ui;
  const me = g.you;
  const seatName = (seat) => (seat === me ? 'You' : ctx.name(g.seats[seat]));
  const teamNames = (t) => [t, t + 2].map((s) => (s === me ? 'you' : ctx.name(g.seats[s]))).join(' & ');
  const myTeam = me >= 0 ? me % 2 : 0;
  const scores = `<div class="sjavs-score">
    ${[myTeam, 1 - myTeam].map((t) => `<div class="team ${t === myTeam && me >= 0 ? 'mine' : ''}"><small>${teamNames(t)}</small><b>${g.left[t]}</b></div>`).join('')}
  </div>`;

  // The table: you at the bottom, partner on top, opponents left and right.
  const rel = (k) => (me >= 0 ? (me + k) % 4 : k);
  const playedBy = Object.fromEntries((g.trick.length ? g.trick : []).map((t) => [t.seat, t.card]));
  const spot = (seat, pos) => `<div class="spot ${pos} ${g.turn === seat || (g.phase === 'bidding' && g.bidTurn === seat) ? 'active' : ''}">
      <span class="sname">${seatName(seat)}${g.declarer === seat ? ' <span class="pill pill-trappe">trumps</span>' : ''}</span>
      ${playedBy[seat] ? card(playedBy[seat], 'mid') : `<span class="ccount">${g.counts[seat]} cards</span>`}
    </div>`;
  const table = `<div class="sjavs-table">${spot(rel(2), 'top')}${spot(rel(1), 'left')}${spot(rel(3), 'right')}${spot(rel(0), 'bottom')}
    <div class="center-info">${g.trump ? `Trumps ${suitGlyph(g.trump)}` : g.bid ? `Bid: ${g.bid.length}${g.bid.clubs ? ' ♣' : ''}` : 'Bidding'}</div></div>`;

  const hand = sortHand(g.mine, g.trump);
  const legal = g.phase === 'playing' && g.turn === me ? legalCards(g.mine, g.trick, g.trump) : [];
  const key = `${g.deal}:${g.mine.length}`;
  if (ui.key !== key) { ui.armed = null; ui.key = key; }
  const handHtml = g.mine.length ? `<div class="hand cards-hand"><div class="fan">${hand.map(({ c, i }) => `<button class="pickcard ${ui.armed === i ? 'on' : ''} ${legal.includes(i) ? 'legal' : ''}" data-g="card" data-i="${i}" ${legal.includes(i) ? '' : 'disabled'}>${card(c)}</button>`).join('')}</div>
    ${legal.length ? `<p class="hint">${ui.armed !== null && legal.includes(ui.armed) ? 'Tap the card again to play it.' : 'Your turn. Tap a card, then tap again to play it.'}</p>` : ''}</div>` : '';

  if (g.phase === 'bidding') {
    const myTurn = g.bidTurn === me;
    const opts = SUITS.map((s) => ({ s, n: trumpCount(g.mine, s) }));
    const counts = `<p class="muted center">Your trumps per suit: ${opts.map((o) => `${suitGlyph(o.s)} ${o.n}`).join(' · ')}</p>`;
    const bids = myTurn ? `<div class="act-row">${opts.filter((o) => o.n >= 5 && betterBid({ length: o.n, clubs: o.s === 'C' }, g.bid))
      .map((o) => `<button class="btn btn-primary" data-g="bid" data-s="${o.s}">Bid ${o.n} ${suitGlyph(o.s)}</button>`).join('')}
      <button class="btn" data-g="pass">Pass</button></div>` : `<div class="waiting">${seatName(g.bidTurn)} is bidding…</div>`;
    const cur = g.bid ? `<div class="event">${seatName(g.bid.seat)} ${g.bid.seat === me ? 'bid' : 'bids'} ${g.bid.length}${g.bid.clubs ? ' in clubs' : ''}${g.bid.suit && g.bid.seat === me ? ` (${SUIT_NAME[g.bid.suit]})` : ''}.</div>` : (g.dealResult?.redeal ? '<div class="event">Nobody could bid, so the cards were dealt again.</div>' : '');
    return scores + table + cur + bids + counts + handHtml;
  }

  if (g.phase === 'scored' || g.phase === 'over') {
    const r = g.dealResult;
    const declNames = teamNames(r.declTeam);
    let line;
    if (r.tie) line = '60–60. Nobody scores, and the next deal is worth 2 more.';
    else line = `${r.team === myTeam ? 'Your team scores' : `${teamNames(r.team)} score`} <b>${r.points}</b>${r.vol ? ' (vol!)' : ''}.`;
    const head = `<div class="card reveal-head ${r.team === r.declTeam ? 'holds' : 'fails'}">
      <p class="eyebrow">Trumps ${suitGlyph(r.trump)} · ${declNames} took ${r.cardPoints} points</p>
      <p class="verdict-sub">${line}</p></div>`;
    if (g.phase === 'over') {
      const winTeam = g.result.team;
      return scores + head + ctx.gameOver(`${winTeam === myTeam ? 'Your team wins' : `${teamNames(winTeam)} win`} the rubber${g.result.double ? ' with a double victory' : ''}!`);
    }
    return scores + head + '<button class="btn btn-primary btn-block" data-g="next">Next deal</button>';
  }

  const last = g.lastTrick ? `<div class="history">Last trick to ${seatName(g.lastTrick.winner)}: ${g.lastTrick.cards.map((t) => card(t.card, 'mini')).join('')}</div>` : '';
  const waiting = g.turn !== me ? `<div class="waiting">${seatName(g.turn)} to play…</div>` : '';
  return scores + table + last + waiting + handHtml;
}

export function handle(el, g, ctx) {
  const ui = ctx.ui;
  switch (el.dataset.g) {
    case 'bid': return { type: 'bid', suit: el.dataset.s };
    case 'pass': return { type: 'pass' };
    case 'next': return { type: 'next' };
    case 'card': {
      const i = Number(el.dataset.i);
      if (ui.armed === i) { ui.armed = null; return { type: 'play', index: i }; }
      ui.armed = i;
      return null;
    }
    default: return null;
  }
}
