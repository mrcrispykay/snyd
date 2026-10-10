// Bussen screen.
import { QUESTIONS } from '../games/bussen.js';
import { card } from './common.js';

const SUITS = [['S', '♠'], ['H', '♥'], ['D', '♦'], ['C', '♣']];
const OPTIONS = {
  1: [['red', 'Red'], ['black', 'Black']],
  2: [['higher', 'Higher'], ['lower', 'Lower']],
  3: [['between', 'Between'], ['outside', 'Outside']],
  4: SUITS.map(([s, g]) => [s, g]),
};

export function howTo(r) {
  return `
    <li><b>Four questions.</b> In turn, everyone guesses: red or black, then higher or lower than your first card, then between or outside your first two, then the suit. Each guess deals you a card. A wrong guess costs ${r.wrongCost === 'rising' ? '1, 2, 3 or 4 sips (question number)' : 'a sip'}. Equal counts as wrong. Aces are high.</li>
    <li><b>The pyramid.</b> ${r.pyramidRows} rows of cards are turned one at a time. Anyone holding the same rank lays it down and hands out sips: 1 per card on the bottom row, more for each row up.</li>
    <li><b>The bus.</b> Whoever has the most cards left rides the bus: ${r.busLength} cards, higher or lower each time. A wrong guess costs a sip per card reached, and the ride starts over.</li>`;
}

export const rulesSummary = (r) => `${r.wrongCost === 'rising' ? 'rising cost' : '1 sip per miss'} · ${r.pyramidRows}-row pyramid · bus of ${r.busLength}`;
export const isMyTurn = (g, me) => (g.phase === 'questions' || g.phase === 'bus') && g.turn === me;

function tally(g, ctx) {
  return `<ul class="players scoreboard">${g.order.map((p) => `<li class="player ${g.turn === p ? 'turn' : ''}">
    <span class="pname">${ctx.name(p)}${p === ctx.me ? ' <span class="you">(you)</span>' : ''}</span>
    <span class="cups muted">${g.hands[p].length} cards · drank ${g.drank[p]} · gave ${g.gave[p]}</span>
    <span class="plast">${g.hands[p].map((c) => card(c, 'mini')).join('')}</span></li>`).join('')}</ul>`;
}

export function render(g, ctx) {
  const mine = g.mine || [];
  const hand = mine.length ? `<div class="hand"><div class="hand-dice">${mine.map((c) => card(c)).join('')}</div><p class="muted">Your cards</p></div>` : '';
  if (g.phase === 'questions') {
    const l = g.last;
    const last = l ? `<div class="event ${l.ok ? 'bank' : 'bust'}">${l.by === ctx.me ? 'You' : ctx.name(l.by)} said ${l.guess === 'red' || l.guess === 'black' || l.guess.length > 1 ? l.guess : { S: 'spades', H: 'hearts', D: 'diamonds', C: 'clubs' }[l.guess]} and got ${card(l.card, 'mini')}. ${l.ok ? 'Right!' : `Wrong: drink ${l.cost}.`}</div>` : '';
    const myTurn = g.turn === ctx.me;
    const q = `<div class="current"><p class="eyebrow">Question ${g.q} of 4</p><p class="current-none">${QUESTIONS[g.q - 1]}</p></div>`;
    const buttons = myTurn
      ? `<div class="act-row">${OPTIONS[g.q].map(([v, label]) => `<button class="btn ${g.q === 4 && (v === 'H' || v === 'D') ? 'red-suit' : ''} big-btn" data-g="answer" data-v="${v}">${label}</button>`).join('')}</div>`
      : `<div class="waiting">${ctx.name(g.turn)} is guessing…</div>`;
    return last + q + hand + buttons + tally(g, ctx);
  }
  if (g.phase === 'pyramid') {
    const rows = g.pyramid.slice().reverse().map((row, ri) => `<div class="prow"><span class="pval">${g.pyramid.length - ri}</span>${row.map((c) => card(c, 'mid')).join('')}</div>`).join('');
    const lf = g.lastFlip;
    const flip = lf ? `<div class="event ${lf.matches.length ? 'bank' : ''}">${card(lf.card, 'mini')} row ${lf.row}: ${lf.matches.length ? lf.matches.map((m) => `${m.id === ctx.me ? 'you hand' : `${ctx.name(m.id)} hands`} out ${m.sips}`).join(', ') : 'no matches'}.</div>` : '';
    const done = g.flipped >= g.pyramidSize;
    return `<div class="pyramid">${rows}</div>${flip}
      ${done ? '<button class="btn btn-snyd btn-block big-btn" data-g="bus">Who rides the bus?</button>' : '<button class="btn btn-primary btn-block big-btn" data-g="flip">Turn the next card</button>'}
      ${hand}${tally(g, ctx)}`;
  }
  const b = g.bus;
  const riderName = b.rider === ctx.me ? 'You' : ctx.name(b.rider);
  const slots = Array.from({ length: g.rules.busLength }, (_, i) => card(i <= b.pos ? b.cards[i] : null, 'mid')).join('');
  const last = b.last ? `<div class="event ${b.last.ok ? 'bank' : 'bust'}">${b.last.guess} → ${card(b.last.card, 'mini')} ${b.last.ok ? 'Right!' : `Wrong! Drink ${b.last.cost} and start over.`}</div>` : '';
  const head = `<div class="current"><p class="eyebrow">${riderName} ${b.rider === ctx.me ? 'are' : 'is'} on the bus · try ${b.tries}</p></div><div class="bus">${slots}</div>`;
  if (g.phase === 'over') return head + last + ctx.gameOver(`${riderName} got off the bus after ${g.result.tries} ${g.result.tries === 1 ? 'try' : 'tries'}.`);
  const mineBus = b.rider === ctx.me;
  return head + last + (mineBus
    ? '<div class="act-row"><button class="btn btn-primary big-btn" data-g="ride" data-v="higher">Higher</button><button class="btn btn-primary big-btn" data-g="ride" data-v="lower">Lower</button></div>'
    : `<div class="waiting">${riderName} is guessing…</div>`) + tally(g, ctx);
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
