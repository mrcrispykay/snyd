// Sjavs screen.
import { legalCards, strength, isTrump, trumpCount, betterBid, SUITS } from '../games/sjavs.js';
import { t } from '../i18n/index.js';
import { card, suitGlyph } from './common.js';
import { suitName } from './hestelob.js';

export const rulesSummary = (r) => t('count down from {n}', { n: r.rubber });
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
  const seatName = (seat) => (seat === me ? t('You') : ctx.name(g.seats[seat]));
  const teamNames = (tm) => [tm, tm + 2].map((s) => (s === me ? t('you') : ctx.name(g.seats[s]))).join(' & ');
  const myTeam = me >= 0 ? me % 2 : 0;
  const scores = `<div class="sjavs-score">
    ${[myTeam, 1 - myTeam].map((tm) => `<div class="team ${tm === myTeam && me >= 0 ? 'mine' : ''}"><small>${teamNames(tm)}</small><b>${g.left[tm]}</b></div>`).join('')}
  </div>`;

  // The table: you at the bottom, partner on top, opponents left and right.
  const rel = (k) => (me >= 0 ? (me + k) % 4 : k);
  const playedBy = Object.fromEntries(g.trick.map((x) => [x.seat, x.card]));
  const spot = (seat, pos) => `<div class="spot ${pos} ${g.turn === seat || (g.phase === 'bidding' && g.bidTurn === seat) ? 'active' : ''}">
      <span class="sname">${seatName(seat)}${g.declarer === seat ? ` <span class="pill pill-trappe">${t('trumps')}</span>` : ''}</span>
      ${playedBy[seat] ? card(playedBy[seat], 'mid') : `<span class="ccount">${t('{n} cards', { n: g.counts[seat] })}</span>`}
    </div>`;
  const center = g.trump ? `${t('Trumps')} ${suitGlyph(g.trump)}` : g.bid ? `${t('Bid')}: ${g.bid.length}${g.bid.clubs ? ' ♣' : ''}` : t('Bidding');
  const table = `<div class="sjavs-table">${spot(rel(2), 'top')}${spot(rel(1), 'left')}${spot(rel(3), 'right')}${spot(rel(0), 'bottom')}<div class="center-info">${center}</div></div>`;

  const hand = sortHand(g.mine, g.trump);
  const legal = g.phase === 'playing' && g.turn === me ? legalCards(g.mine, g.trick, g.trump) : [];
  const key = `${g.deal}:${g.mine.length}`;
  if (ui.key !== key) { ui.armed = null; ui.key = key; }
  const handHtml = g.mine.length ? `<div class="hand cards-hand"><div class="fan">${hand.map(({ c, i }) => `<button class="pickcard ${ui.armed === i ? 'on' : ''} ${legal.includes(i) ? 'legal' : ''}" data-g="card" data-i="${i}" ${legal.includes(i) ? '' : 'disabled'}>${card(c)}</button>`).join('')}</div>
    ${legal.length ? `<p class="hint">${ui.armed !== null && legal.includes(ui.armed) ? t('Tap the card again to play it.') : t('Your turn. Tap a card, then tap again to play it.')}</p>` : ''}</div>` : '';

  if (g.phase === 'bidding') {
    const myTurn = g.bidTurn === me;
    const opts = SUITS.map((s) => ({ s, n: trumpCount(g.mine, s) }));
    const counts = `<p class="muted center">${t('Your trumps per suit:')} ${opts.map((o) => `${suitGlyph(o.s)} ${o.n}`).join(' · ')}</p>`;
    const bids = myTurn ? `<div class="act-row">${opts.filter((o) => o.n >= 5 && betterBid({ length: o.n, clubs: o.s === 'C' }, g.bid))
      .map((o) => `<button class="btn btn-primary" data-g="bid" data-s="${o.s}">${t('Bid {n}', { n: o.n })} ${suitGlyph(o.s)}</button>`).join('')}
      <button class="btn" data-g="pass">${t('Pass')}</button></div>` : `<div class="waiting">${t('{name} is bidding…', { name: seatName(g.bidTurn) })}</div>`;
    let cur = '';
    if (g.bid) cur = `<div class="event">${t('{name} bid {n}', { name: seatName(g.bid.seat), n: g.bid.length })}${g.bid.clubs ? ` ${t('in clubs')}` : ''}${g.bid.suit && g.bid.seat === me ? ` (${suitName(g.bid.suit).toLowerCase()})` : ''}.</div>`;
    else if (g.dealResult?.redeal) cur = `<div class="event">${t('Nobody could bid, so the cards were dealt again.')}</div>`;
    return scores + table + cur + bids + counts + handHtml;
  }

  if (g.phase === 'scored' || g.phase === 'over') {
    const r = g.dealResult;
    const line = r.tie ? t('60–60. Nobody scores, and the next deal is worth 2 more.')
      : `${r.team === myTeam ? t('Your team scores <b>{n}</b>', { n: r.points }) : t('{names} score <b>{n}</b>', { names: teamNames(r.team), n: r.points })}${r.vol ? ` (${t('all tricks!')})` : ''}.`;
    const head = `<div class="card reveal-head ${r.team === r.declTeam ? 'holds' : 'fails'}">
      <p class="eyebrow">${t('Trumps')} ${suitGlyph(r.trump)} · ${t('{names} took {n} points', { names: teamNames(r.declTeam), n: r.cardPoints })}</p>
      <p class="verdict-sub">${line}</p></div>`;
    if (g.phase === 'over') {
      const w = g.result.team;
      const text = w === myTeam ? t('Your team wins the rubber!') : t('{names} win the rubber!', { names: teamNames(w) });
      return scores + head + ctx.gameOver(`${text}${g.result.double ? ` ${t('A double victory!')}` : ''}`);
    }
    return scores + head + `<button class="btn btn-primary btn-block" data-g="next">${t('Next deal')}</button>`;
  }

  const last = g.lastTrick ? `<div class="history">${t('Last trick to {name}:', { name: seatName(g.lastTrick.winner) })} ${g.lastTrick.cards.map((x) => card(x.card, 'mini')).join('')}</div>` : '';
  const waiting = g.turn !== me ? `<div class="waiting">${t('{name} to play…', { name: seatName(g.turn) })}</div>` : '';
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
