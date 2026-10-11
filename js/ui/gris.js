// Gris screen.
import { t } from '../i18n/index.js';
import { die } from './common.js';

export const rulesSummary = (r) => [t('to {n}', { n: r.target }), r.twoDice ? t('two dice') : null].filter(Boolean).join(' · ');
export const isMyTurn = (g, me) => g.phase === 'turn' && g.turn === me;

export function render(g, ctx) {
  const top = Math.max(...Object.values(g.scores));
  const board = `<ul class="players scoreboard">${g.order.map((p) => `
    <li class="player ${g.turn === p ? 'turn' : ''}"><span class="pname">${ctx.name(p)}${p === ctx.me ? ` <span class="you">(${t('you')})</span>` : ''}</span>
      <span class="cups"><span class="meter"><i style="width:${Math.min(100, (g.scores[p] / g.rules.target) * 100)}%"></i></span></span>
      <span class="score ${g.scores[p] === top && top > 0 ? 'lead' : ''}">${g.scores[p]}</span></li>`).join('')}</ul>`;
  const e = g.event;
  const who = (id) => (id === ctx.me ? t('You') : ctx.name(id));
  let event = '';
  if (e?.type === 'bust') event = `<div class="event bust">${e.lost ? t('{name} rolled a 1 and lost {n}.', { name: who(e.by), n: e.lost }) : t('{name} rolled a 1.', { name: who(e.by) })}</div>`;
  if (e?.type === 'wipe') event = `<div class="event bust">${t('Two 1s! {name} is back to 0.', { name: who(e.by) })}</div>`;
  if (e?.type === 'hold') event = `<div class="event bank">${t('{name} banked {n}.', { name: who(e.by), n: e.points })}</div>`;
  if (g.phase === 'over') return board + ctx.gameOver(g.result.winner === ctx.me ? t('You win!') : t('{name} wins!', { name: ctx.name(g.result.winner) }));

  const myTurn = g.turn === ctx.me;
  const last = g.last && g.last.by === g.turn ? `<div class="hand"><div class="hand-dice">${g.last.dice.map((d) => die(d)).join('')}</div></div>` : '';
  const turn = `<div class="current"><p class="eyebrow">${myTurn ? t('Your turn') : t('{name}’s turn', { name: ctx.name(g.turn) })}</p><p class="current-bid">${g.turnPoints}</p><p class="muted">${t('{n} if stopping now', { n: g.scores[g.turn] + g.turnPoints })}</p></div>`;
  const actions = myTurn
    ? `<div class="act-row"><button class="btn btn-primary big-btn" data-g="roll">${t('Roll')}</button><button class="btn big-btn" data-g="hold" ${g.turnPoints ? '' : 'disabled'}>${t('Stop and bank')}</button></div>`
    : `<div class="waiting">${t('Waiting…')}</div>`;
  return board + event + turn + last + actions;
}

export function handle(el) {
  switch (el.dataset.g) {
    case 'roll': return { type: 'roll' };
    case 'hold': return { type: 'hold' };
    default: return null;
  }
}
