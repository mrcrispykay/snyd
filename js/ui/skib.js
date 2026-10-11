// Skib, kaptajn og mandskab screen.
import { t } from '../i18n/index.js';
import { die } from './common.js';

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

export const rulesSummary = (r) => [t('{n} rolls', { n: r.rolls }), r.rounds > 1 ? t('{n} rounds', { n: r.rounds }) : t('1 round')].join(' · ');
export const isMyTurn = (g, me) => g.phase === 'turn' && g.turn === me;

function board(g, ctx) {
  return `<ul class="players scoreboard">${g.order.map((p) => {
    const res = g.results[p];
    let right = '';
    if (res !== undefined) right = `<span class="score">${res || '–'}</span>`;
    else if (g.turn === p) right = `<span class="muted">${t('rolling…')}</span>`;
    return `<li class="player ${g.turn === p ? 'turn' : ''}"><span class="pname">${ctx.name(p)}${p === ctx.me ? ` <span class="you">(${t('you')})</span>` : ''}</span>
      <span class="cups muted">${t('{w} won · {l} lost', { w: g.wins[p], l: g.losses[p] })}</span>${right}</li>`;
  }).join('')}</ul>`;
}

function ship(g) {
  const roles = [t('Ship'), t('Captain'), t('Crew')];
  const slots = [6, 5, 4].map((v, i) => `<div class="slot ${i < g.found ? 'on' : ''}">${i < g.found ? die(v) : die(0)}<small>${roles[i]}</small></div>`).join('');
  const cargo = g.found === 3 ? g.dice.reduce((a, b) => a + b, 0) : null;
  return `<div class="hand ship"><div class="slots">${slots}<div class="slot cargo">${g.dice.map((d) => die(d, g.found === 3 ? '' : 'dim')).join('')}<small>${t('Cargo')}${cargo !== null ? ` ${cargo}` : ''}</small></div></div></div>`;
}

export function render(g, ctx) {
  const top = `<p class="eyebrow center">${t('Round {a} of {b}', { a: g.round, b: g.rules.rounds })}</p>`;
  const names = (ids) => ids.map((p) => (p === ctx.me ? t('you') : ctx.name(p))).join(' & ');
  if (g.phase === 'roundover' || g.phase === 'over') {
    const rr = g.roundResult;
    const head = `<div class="card reveal-head ${rr.winners.length ? 'holds' : 'fails'}">
      <p class="verdict">${rr.winners.length ? cap(t('{names} win', { names: names(rr.winners) })) : t('No cargo at all!')}</p>
      <p class="verdict-sub">${t('Smallest cargo: <b>{names}</b>. Drink up.', { names: names(rr.losers) })}</p></div>`;
    if (g.phase === 'over') return top + head + board(g, ctx) + ctx.gameOver(cap(t('{names} lost the most rounds and buy.', { names: names(g.result.losers) })));
    return top + head + board(g, ctx) + `<button class="btn btn-primary btn-block" data-g="next">${t('Next round')}</button>`;
  }
  const myTurn = g.turn === ctx.me;
  const rolled = g.rollsLeft < g.rules.rolls;
  let actions = `<div class="waiting">${t('{name} has {n} rolls left…', { name: ctx.name(g.turn), n: g.rollsLeft })}</div>`;
  if (myTurn) {
    actions = `<div class="act-row">
      <button class="btn btn-primary" data-g="roll">${g.found === 3 ? t('Roll the cargo again') : t('Roll {n} dice', { n: 5 - g.held.length })} (${t('{n} left', { n: g.rollsLeft })})</button>
      ${g.found === 3 ? `<button class="btn" data-g="stop">${t('Keep cargo {n}', { n: g.dice.reduce((a, b) => a + b, 0) })}</button>` : ''}
    </div>`;
  }
  return top + board(g, ctx) + (rolled || myTurn ? ship(g) : '') + actions;
}

export function handle(el) {
  switch (el.dataset.g) {
    case 'roll': return { type: 'roll' };
    case 'stop': return { type: 'stop' };
    case 'next': return { type: 'next' };
    default: return null;
  }
}
