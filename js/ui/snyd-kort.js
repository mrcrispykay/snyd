// Snyd med kort screen.
import { rankName } from '../games/snyd-kort.js';
import { card } from './common.js';

export function howTo(r) {
  return `
    <li>All cards are dealt. On your turn, play 1 to ${r.maxCards} cards face down and say they’re the rank that’s up: aces first, then twos, threes … kings, and round again.</li>
    <li>Lie if you have to. Anyone who doesn’t believe the last play can call <b>Snyd!</b> before the next player plays.</li>
    <li>If the play was honest, the caller takes the whole pile. If it was a lie, the player who lied takes it.</li>
    <li>The first player to get rid of all their cards (without being caught) wins.</li>`;
}

export const rulesSummary = (r) => `up to ${r.maxCards} cards a play`;
export const isMyTurn = (g, me) => g.phase === 'play' && g.turn === me;

export function render(g, ctx) {
  const ui = ctx.ui;
  const players = `<ul class="players">${g.order.map((p) => `<li class="player ${g.turn === p && g.phase === 'play' ? 'turn' : ''}">
    <span class="pname">${ctx.name(p)}${p === ctx.me ? ' <span class="you">(you)</span>' : ''}</span>
    <span class="cups">${Array.from({ length: Math.min(g.counts[p], 26) }, () => '<i class="cardback"></i>').join('')}</span>
    <span class="plast">${g.counts[p]}</span></li>`).join('')}</ul>`;
  const lp = g.lastPlay;
  const claim = lp ? `<div class="current"><p class="eyebrow">${ctx.name(lp.by)} played</p><p class="current-bid">${lp.count} ${lp.count === 1 ? rankName(lp.rank).replace(/s$/, '') : rankName(lp.rank)}</p><p class="muted">Pile: ${g.pile} cards</p></div>` : `<div class="current"><p class="eyebrow">First play</p><p class="current-none">${ctx.name(g.turn)} starts with aces</p></div>`;

  if (g.phase === 'reveal' || (g.phase === 'over' && g.reveal)) {
    const r = g.reveal;
    const head = `<div class="card reveal-head ${r.truthful ? 'holds' : 'fails'}">
      <p class="eyebrow">${ctx.name(r.caller)} called snyd on ${ctx.name(r.by)}</p>
      <div class="hand-dice">${r.cards.map((c) => card(c, c.r === r.rank ? '' : 'liar')).join('')}</div>
      <p class="verdict-sub">They said ${r.cards.length} ${rankName(r.rank)}. ${r.truthful ? 'True!' : 'A lie!'} <b>${r.taker === ctx.me ? 'You take' : `${ctx.name(r.taker)} takes`}</b> the pile of ${r.pile}.</p></div>`;
    if (g.phase === 'over') return head + players + ctx.gameOver(g.result.winner === ctx.me ? 'You’re out of cards. You win!' : `${ctx.name(g.result.winner)} is out of cards and wins!`);
    return head + players + '<button class="btn btn-primary btn-block" data-g="next">Continue</button>';
  }
  if (g.phase === 'over') return players + ctx.gameOver(g.result.winner === ctx.me ? 'You’re out of cards. You win!' : `${ctx.name(g.result.winner)} is out of cards and wins!`);

  const canCall = lp && lp.open && lp.by !== ctx.me && g.order.includes(ctx.me);
  const myTurn = g.turn === ctx.me;
  const key = g.mine.map((c) => c.i).join(',');
  if (ui.handKey !== key) { ui.sel = []; ui.handKey = key; }
  const hand = g.mine.length ? `<div class="hand cards-hand"><div class="fan">${g.mine.map((c) => `<button class="pickcard ${ui.sel.includes(c.i) ? 'on' : ''}" data-g="sel" data-i="${c.i}" ${myTurn ? '' : 'disabled'} aria-pressed="${ui.sel.includes(c.i)}">${card(c)}</button>`).join('')}</div></div>` : '';
  const actions = myTurn
    ? `<div class="act-row"><button class="btn btn-primary" data-g="play" ${ui.sel.length >= 1 && ui.sel.length <= g.rules.maxCards ? '' : 'disabled'}>Play ${ui.sel.length || ''} as ${rankName(g.rank)}</button>${canCall ? '<button class="btn btn-snyd" data-g="call">Snyd!</button>' : ''}</div>
       <p class="hint">${ui.sel.length > g.rules.maxCards ? `At most ${g.rules.maxCards} cards.` : `Up now: <b>${rankName(g.rank)}</b>. Tap cards to pick them.`}</p>`
    : `${canCall ? '<button class="btn btn-snyd btn-block" data-g="call">Snyd!</button>' : ''}<div class="waiting">${ctx.name(g.turn)} plays ${rankName(g.rank)}…</div>`;
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
