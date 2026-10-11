// Snyd med kort screen.
import { t } from '../i18n/index.js';
import { card } from './common.js';

const RANK = { 1: 'A', 11: 'J', 12: 'Q', 13: 'K' };
/** "aces", "7s", … in the current language. */
export const rankName = (r) => ({ 1: t('aces'), 11: t('jacks'), 12: t('queens'), 13: t('kings') }[r] || t('{n}s', { n: r }));

export const rulesSummary = (r) => t('up to {n} cards a play', { n: r.maxCards });
export const isMyTurn = (g, me) => g.phase === 'play' && g.turn === me;

export function render(g, ctx) {
  const ui = ctx.ui;
  const win = (id) => (id === ctx.me ? t('You’re out of cards. You win!') : t('{name} is out of cards and wins!', { name: ctx.name(id) }));
  const players = `<ul class="players">${g.order.map((p) => `<li class="player ${g.turn === p && g.phase === 'play' ? 'turn' : ''}">
    <span class="pname">${ctx.name(p)}${p === ctx.me ? ` <span class="you">(${t('you')})</span>` : ''}</span>
    <span class="cups">${Array.from({ length: Math.min(g.counts[p], 26) }, () => '<i class="cardback"></i>').join('')}</span>
    <span class="plast">${g.counts[p]}</span></li>`).join('')}</ul>`;
  const lp = g.lastPlay;
  const claim = lp
    ? `<div class="current"><p class="eyebrow">${t('{name} played', { name: ctx.name(lp.by) })}</p><p class="current-bid">${lp.count} × ${RANK[lp.rank] || lp.rank}</p><p class="muted">${t('Pile: {n} cards', { n: g.pile })}</p></div>`
    : `<div class="current"><p class="eyebrow">${t('First play')}</p><p class="current-none">${t('{name} starts with aces', { name: ctx.name(g.turn) })}</p></div>`;

  if (g.phase === 'reveal' || (g.phase === 'over' && g.reveal)) {
    const r = g.reveal;
    const head = `<div class="card reveal-head ${r.truthful ? 'holds' : 'fails'}">
      <p class="eyebrow">${t('{a} called cheat on {b}', { a: ctx.name(r.caller), b: ctx.name(r.by) })}</p>
      <div class="hand-dice">${r.cards.map((c) => card(c, c.r === r.rank ? '' : 'liar')).join('')}</div>
      <p class="verdict-sub">${t('They said {n} {rank}.', { n: r.cards.length, rank: rankName(r.rank) })} ${r.truthful ? t('True!') : t('A lie!')} ${r.taker === ctx.me ? t('<b>You take</b> the pile of {n}.', { n: r.pile }) : t('<b>{name} takes</b> the pile of {n}.', { name: ctx.name(r.taker), n: r.pile })}</p></div>`;
    if (g.phase === 'over') return head + players + ctx.gameOver(win(g.result.winner));
    return head + players + `<button class="btn btn-primary btn-block" data-g="next">${t('Continue')}</button>`;
  }
  if (g.phase === 'over') return players + ctx.gameOver(win(g.result.winner));

  const canCall = lp && lp.open && lp.by !== ctx.me && g.order.includes(ctx.me);
  const myTurn = g.turn === ctx.me;
  const key = g.mine.map((c) => c.i).join(',');
  if (ui.handKey !== key) { ui.sel = []; ui.handKey = key; }
  const hand = g.mine.length ? `<div class="hand cards-hand"><div class="fan">${g.mine.map((c) => `<button class="pickcard ${ui.sel.includes(c.i) ? 'on' : ''}" data-g="sel" data-i="${c.i}" ${myTurn ? '' : 'disabled'} aria-pressed="${ui.sel.includes(c.i)}">${card(c)}</button>`).join('')}</div></div>` : '';
  const actions = myTurn
    ? `<div class="act-row"><button class="btn btn-primary" data-g="play" ${ui.sel.length >= 1 && ui.sel.length <= g.rules.maxCards ? '' : 'disabled'}>${t('Play {n} as {rank}', { n: ui.sel.length || '', rank: rankName(g.rank) })}</button>${canCall ? `<button class="btn btn-snyd" data-g="call">${t('Cheat!')}</button>` : ''}</div>
       <p class="hint">${ui.sel.length > g.rules.maxCards ? t('At most {n} cards.', { n: g.rules.maxCards }) : t('Up now: <b>{rank}</b>. Tap cards to pick them.', { rank: rankName(g.rank) })}</p>`
    : `${canCall ? `<button class="btn btn-snyd btn-block" data-g="call">${t('Cheat!')}</button>` : ''}<div class="waiting">${t('{name} plays {rank}…', { name: ctx.name(g.turn), rank: rankName(g.rank) })}</div>`;
  return players + claim + actions + hand;
}

export function handle(el, g, ctx) {
  const ui = ctx.ui;
  switch (el.dataset.g) {
    case 'sel': {
      const i = Number(el.dataset.i);
      ui.sel = ui.sel.includes(i) ? ui.sel.filter((x) => x !== i) : [...ui.sel, i];
      return null;
    }
    case 'play': return { type: 'play', cards: ui.sel };
    case 'call': return { type: 'call' };
    case 'next': return { type: 'next' };
    default: return null;
  }
}
