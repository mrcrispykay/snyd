// Bussen screen.
import { t } from '../i18n/index.js';
import { card } from './common.js';
import { suitName } from './hestelob.js';

const QUESTIONS = ['Red or black?', 'Higher or lower?', 'Between or outside?', 'Which suit?'];
const OPTIONS = {
  1: [['red', 'Red'], ['black', 'Black']],
  2: [['higher', 'Higher'], ['lower', 'Lower']],
  3: [['between', 'Between'], ['outside', 'Outside']],
  4: [['S', '♠'], ['H', '♥'], ['D', '♦'], ['C', '♣']],
};
const GUESS = { red: 'red', black: 'black', higher: 'higher', lower: 'lower', between: 'between', outside: 'outside' };
const guessText = (g) => (GUESS[g] ? t(GUESS[g]) : suitName(g).toLowerCase());

export const rulesSummary = (r) => `${r.wrongCost === 'rising' ? t('rising cost') : t('1 sip per miss')} · ${t('{n}-row pyramid', { n: r.pyramidRows })} · ${t('bus of {n}', { n: r.busLength })}`;
export const isMyTurn = (g, me) => (g.phase === 'questions' || g.phase === 'bus') && g.turn === me;

function tally(g, ctx) {
  return `<ul class="players scoreboard">${g.order.map((p) => `<li class="player ${g.turn === p ? 'turn' : ''}">
    <span class="pname">${ctx.name(p)}${p === ctx.me ? ` <span class="you">(${t('you')})</span>` : ''}</span>
    <span class="cups muted">${t('{c} cards · drank {d} · gave {g}', { c: g.hands[p].length, d: g.drank[p], g: g.gave[p] })}</span>
    <span class="plast">${g.hands[p].map((c) => card(c, 'mini')).join('')}</span></li>`).join('')}</ul>`;
}

export function render(g, ctx) {
  const mine = g.mine || [];
  const who = (id) => (id === ctx.me ? t('You') : ctx.name(id));
  const hand = mine.length ? `<div class="hand"><div class="hand-dice">${mine.map((c) => card(c)).join('')}</div><p class="muted">${t('Your cards')}</p></div>` : '';
  if (g.phase === 'questions') {
    const l = g.last;
    const last = l ? `<div class="event ${l.ok ? 'bank' : 'bust'}">${t('{name} said {guess} and got {card}.', { name: who(l.by), guess: guessText(l.guess), card: card(l.card, 'mini') })} ${l.ok ? t('Right!') : t('Wrong: drink {n}.', { n: l.cost })}</div>` : '';
    const myTurn = g.turn === ctx.me;
    const q = `<div class="current"><p class="eyebrow">${t('Question {n} of 4', { n: g.q })}</p><p class="current-none">${t(QUESTIONS[g.q - 1])}</p></div>`;
    const buttons = myTurn
      ? `<div class="act-row">${OPTIONS[g.q].map(([v, lbl]) => `<button class="btn ${g.q === 4 && (v === 'H' || v === 'D') ? 'red-suit' : ''} big-btn" data-g="answer" data-v="${v}" aria-label="${g.q === 4 ? suitName(v) : t(lbl)}">${g.q === 4 ? lbl : t(lbl)}</button>`).join('')}</div>`
      : `<div class="waiting">${t('{name} is guessing…', { name: ctx.name(g.turn) })}</div>`;
    return last + q + hand + buttons + tally(g, ctx);
  }
  if (g.phase === 'pyramid') {
    const rows = g.pyramid.slice().reverse().map((row, ri) => `<div class="prow"><span class="pval">${g.pyramid.length - ri}</span>${row.map((c) => card(c, 'mid')).join('')}</div>`).join('');
    const lf = g.lastFlip;
    const flip = lf ? `<div class="event ${lf.matches.length ? 'bank' : ''}">${card(lf.card, 'mini')} ${t('row {n}', { n: lf.row })}: ${lf.matches.length ? lf.matches.map((m) => t('{name} hands out {n}', { name: who(m.id), n: m.sips })).join(', ') : t('no matches')}.</div>` : '';
    const done = g.flipped >= g.pyramidSize;
    return `<div class="pyramid">${rows}</div>${flip}
      ${done ? `<button class="btn btn-snyd btn-block big-btn" data-g="bus">${t('Who rides the bus?')}</button>` : `<button class="btn btn-primary btn-block big-btn" data-g="flip">${t('Turn the next card')}</button>`}
      ${hand}${tally(g, ctx)}`;
  }
  const b = g.bus;
  const slots = Array.from({ length: g.rules.busLength }, (_, i) => card(i <= b.pos ? b.cards[i] : null, 'mid')).join('');
  const last = b.last ? `<div class="event ${b.last.ok ? 'bank' : 'bust'}">${guessText(b.last.guess)} → ${card(b.last.card, 'mini')} ${b.last.ok ? t('Right!') : t('Wrong! Drink {n} and start over.', { n: b.last.cost })}</div>` : '';
  const head = `<div class="current"><p class="eyebrow">${b.rider === ctx.me ? t('You’re on the bus · try {n}', { n: b.tries }) : t('{name} is on the bus · try {n}', { name: ctx.name(b.rider), n: b.tries })}</p></div><div class="bus">${slots}</div>`;
  if (g.phase === 'over') {
    const n = g.result.tries;
    return head + last + ctx.gameOver(b.rider === ctx.me ? t('You got off the bus after {n} tries.', { n }) : t('{name} got off the bus after {n} tries.', { name: ctx.name(b.rider), n }));
  }
  return head + last + (b.rider === ctx.me
    ? `<div class="act-row"><button class="btn btn-primary big-btn" data-g="ride" data-v="higher">${t('Higher')}</button><button class="btn btn-primary big-btn" data-g="ride" data-v="lower">${t('Lower')}</button></div>`
    : `<div class="waiting">${t('{name} is guessing…', { name: ctx.name(b.rider) })}</div>`) + tally(g, ctx);
}

export function handle(el) {
  switch (el.dataset.g) {
    case 'answer': return { type: 'answer', guess: el.dataset.v };
    case 'flip': return { type: 'flip' };
    case 'bus': return { type: 'bus' };
    case 'ride': return { type: 'ride', guess: el.dataset.v };
    default: return null;
  }
}
