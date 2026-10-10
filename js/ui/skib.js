// Skib, kaptajn og mandskab screen.
import { die } from './common.js';

const ROLE = ['Ship', 'Captain', 'Crew'];
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

export function howTo(r) {
  return `
    <li>You get ${r.rolls} rolls with five dice. You need a ${die(6, 'die-inline')} (ship), then a ${die(5, 'die-inline')} (captain), then a ${die(4, 'die-inline')} (crew), in that order. They’re set aside automatically.</li>
    <li>Once all three are aside, the other two dice are your <b>cargo</b>. Keep it, or use a roll you have left to try for more.</li>
    <li>No ship, captain and crew by the last roll means no cargo.</li>
    <li>When everyone has played, the biggest cargo wins the round and the smallest drinks. ${r.rounds > 1 ? `After ${r.rounds} rounds, whoever lost the most rounds buys.` : ''}</li>`;
}

export const rulesSummary = (r) => `${r.rolls} rolls · ${r.rounds} round${r.rounds > 1 ? 's' : ''}`;
export const isMyTurn = (g, me) => g.phase === 'turn' && g.turn === me;

function board(g, ctx) {
  return `<ul class="players scoreboard">${g.order.map((p) => {
    const res = g.results[p];
    let right = '';
    if (res !== undefined) right = `<span class="score">${res || '–'}</span>`;
    else if (g.turn === p) right = '<span class="muted">rolling…</span>';
    return `<li class="player ${g.turn === p ? 'turn' : ''}"><span class="pname">${ctx.name(p)}${p === ctx.me ? ' <span class="you">(you)</span>' : ''}</span>
      <span class="cups muted">${g.wins[p]} won · ${g.losses[p]} lost</span>${right}</li>`;
  }).join('')}</ul>`;
}

function ship(g) {
  const slots = [6, 5, 4].map((v, i) => `<div class="slot ${i < g.found ? 'on' : ''}">${i < g.found ? die(v) : die(0)}<small>${ROLE[i]}</small></div>`).join('');
  const cargo = g.found === 3 ? g.dice.reduce((a, b) => a + b, 0) : null;
  return `<div class="hand ship"><div class="slots">${slots}<div class="slot cargo">${g.found === 3 ? g.dice.map((d) => die(d)).join('') : g.dice.map((d) => die(d, 'dim')).join('')}<small>Cargo${cargo !== null ? ` ${cargo}` : ''}</small></div></div></div>`;
}

export function render(g, ctx) {
  const top = `<p class="eyebrow center">Round ${g.round} of ${g.rules.rounds}</p>`;
  if (g.phase === 'roundover' || g.phase === 'over') {
    const rr = g.roundResult;
    const names = (ids) => ids.map((p) => (p === ctx.me ? 'you' : ctx.name(p))).join(' and ');
    const head = `<div class="card reveal-head ${rr.winners.length ? 'holds' : 'fails'}">
      <p class="verdict">${rr.winners.length ? `${cap(names(rr.winners))} win${rr.winners.length > 1 || rr.winners[0] === ctx.me ? '' : 's'}` : 'No cargo at all!'}</p>
      <p class="verdict-sub">Smallest cargo: <b>${names(rr.losers)}</b>. Drink up.</p></div>`;
    if (g.phase === 'over') {
      const plural = g.result.losers.length > 1 || g.result.losers[0] === ctx.me;
      const who = names(g.result.losers);
      return top + head + board(g, ctx) + ctx.gameOver(`${who[0].toUpperCase()}${who.slice(1)} lost the most rounds and ${plural ? 'buy' : 'buys'}.`);
    }
    return top + head + board(g, ctx) + '<button class="btn btn-primary btn-block" data-g="next">Next round</button>';
  }
  const myTurn = g.turn === ctx.me;
  const rolled = g.rollsLeft < g.rules.rolls;
  let actions = `<div class="waiting">${ctx.name(g.turn)} has ${g.rollsLeft} roll${g.rollsLeft === 1 ? '' : 's'} left…</div>`;
  if (myTurn) {
    actions = `<div class="act-row">
      <button class="btn btn-primary" data-g="roll">${g.found === 3 ? 'Roll the cargo again' : `Roll ${5 - g.held.length} dice`} (${g.rollsLeft} left)</button>
      ${g.found === 3 ? `<button class="btn" data-g="stop">Keep cargo ${g.dice.reduce((a, b) => a + b, 0)}</button>` : ''}
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
