// Gris screen.
import { die } from './common.js';

export function howTo(r) {
  return r.twoDice ? `
    <li>On your turn, roll two dice as many times as you like. Each roll adds to your turn total.</li>
    <li>Roll a single ${die(1, 'die-inline')} and you lose the turn total. Roll two ${die(1, 'die-inline')} and your whole score goes back to 0.</li>
    <li>Stop any time to bank your turn total. First to ${r.target} wins.</li>` : `
    <li>On your turn, roll the die as many times as you like. Each roll adds to your turn total.</li>
    <li>Roll a ${die(1, 'die-inline')} and you lose everything from that turn.</li>
    <li>Stop any time to bank your turn total. First to ${r.target} wins.</li>`;
}

export const rulesSummary = (r) => `to ${r.target}${r.twoDice ? ' · two dice' : ''}`;
export const isMyTurn = (g, me) => g.phase === 'turn' && g.turn === me;

export function render(g, ctx) {
  const top = Math.max(...Object.values(g.scores));
  const board = `<ul class="players scoreboard">${g.order.map((p) => `
    <li class="player ${g.turn === p ? 'turn' : ''}"><span class="pname">${ctx.name(p)}${p === ctx.me ? ' <span class="you">(you)</span>' : ''}</span>
      <span class="cups"><span class="meter"><i style="width:${Math.min(100, (g.scores[p] / g.rules.target) * 100)}%"></i></span></span>
      <span class="score ${g.scores[p] === top && top > 0 ? 'lead' : ''}">${g.scores[p]}</span></li>`).join('')}</ul>`;
  const e = g.event;
  let event = '';
  if (e?.type === 'bust') event = `<div class="event bust">${e.by === ctx.me ? 'You' : ctx.name(e.by)} rolled a 1${e.lost ? ` and lost ${e.lost}` : ''}.</div>`;
  if (e?.type === 'wipe') event = `<div class="event bust">Two 1s! ${e.by === ctx.me ? 'Your' : `${ctx.name(e.by)}’s`} score is back to 0.</div>`;
  if (e?.type === 'hold') event = `<div class="event bank">${e.by === ctx.me ? 'You' : ctx.name(e.by)} banked ${e.points}.</div>`;
  if (g.phase === 'over') return board + ctx.gameOver(g.result.winner === ctx.me ? 'You win!' : `${ctx.name(g.result.winner)} wins!`);

  const myTurn = g.turn === ctx.me;
  const last = g.last && g.last.by === g.turn ? `<div class="hand"><div class="hand-dice">${g.last.dice.map((d) => die(d)).join('')}</div></div>` : '';
  const turn = `<div class="current"><p class="eyebrow">${myTurn ? 'Your turn' : `${ctx.name(g.turn)}’s turn`}</p><p class="current-bid">${g.turnPoints}</p><p class="muted">${g.scores[g.turn] + g.turnPoints} if ${myTurn ? 'you stop' : 'they stop'} now</p></div>`;
  const actions = myTurn
    ? `<div class="act-row"><button class="btn btn-primary big-btn" data-g="roll">Roll</button><button class="btn big-btn" data-g="hold" ${g.turnPoints ? '' : 'disabled'}>Stop and bank</button></div>`
    : '<div class="waiting">Waiting…</div>';
  return board + event + turn + last + actions;
}

export function handle(el) {
  switch (el.dataset.g) {
    case 'roll': return { type: 'roll' };
    case 'hold': return { type: 'hold' };
    default: return null;
  }
}
