// Yatzy screen.
import { CATEGORIES, score, totals } from '../games/yatzy.js';
import { die } from './common.js';

export function howTo(r) {
  return `
    <li>${r.mode === 'together' ? 'Everyone plays their own score sheet at the same time.' : 'Players take turns.'} Each turn you get three rolls. Tap dice to hold them between rolls.</li>
    <li>After rolling, put the score in one empty box. If nothing fits, you have to write 0 somewhere.</li>
    <li>Ones to sixes: the sum of that face. 63 or more in that section gives a 50-point bonus.</li>
    <li>Pair, two pairs, three and four of a kind: the sum of those dice. Small straight (1-5) 15, large straight (2-6) 20, full house and chance: the sum of all dice. Yatzy (five the same) 50.</li>
    <li>When every sheet is full, the highest total wins.</li>`;
}

export const rulesSummary = (r) => (r.mode === 'together' ? 'everyone at once' : 'take turns');
export const isMyTurn = (g, me) => g.phase === 'play' && g.rules.mode === 'turns' && g.turn === me;

function sheetTable(g, ctx, mine) {
  const t = mine ? g.turns[ctx.me] : null;
  const canScore = mine && t && t.rollsLeft < 3 && (g.rules.mode === 'together' || g.turn === ctx.me);
  const players = g.order;
  const head = `<tr><th></th>${players.map((p) => `<th class="${p === ctx.me ? 'me' : ''}">${ctx.name(p)}</th>`).join('')}</tr>`;
  const rows = CATEGORIES.map(([k, label], i) => {
    const cells = players.map((p) => {
      const v = g.sheets[p][k];
      if (v !== undefined) return `<td class="${p === ctx.me ? 'me' : ''}">${v}</td>`;
      if (p === ctx.me && canScore) {
        const pts = score(k, t.dice);
        return `<td class="me"><button class="scorebox ${pts ? '' : 'zero'}" data-g="score" data-k="${k}">${pts}</button></td>`;
      }
      return `<td class="${p === ctx.me ? 'me' : ''} empty"></td>`;
    }).join('');
    const sep = i === 6 ? `<tr class="sub"><th>Bonus</th>${players.map((p) => { const tt = totals(g.sheets[p]); return `<td class="${p === ctx.me ? 'me' : ''}">${tt.bonus || `${tt.upper}/63`}</td>`; }).join('')}</tr>` : '';
    return `${sep}<tr><th>${label}</th>${cells}</tr>`;
  }).join('');
  const total = `<tr class="sum"><th>Total</th>${players.map((p) => `<td class="${p === ctx.me ? 'me' : ''}">${totals(g.sheets[p]).total}</td>`).join('')}</tr>`;
  return `<div class="sheet-wrap"><table class="sheet">${head}${rows}${total}</table></div>`;
}

export function render(g, ctx) {
  const seated = g.order.includes(ctx.me);
  if (g.phase === 'over') {
    const w = g.result.winners;
    const line = w.length > 1 ? `${w.map(ctx.name).join(' and ')} share the win with ${g.result.top}.` : w[0] === ctx.me ? `You win with ${g.result.top}!` : `${ctx.name(w[0])} wins with ${g.result.top}.`;
    return sheetTable(g, ctx, false) + ctx.gameOver(line);
  }
  const myGo = seated && (g.rules.mode === 'together' || g.turn === ctx.me);
  const t = seated ? g.turns[ctx.me] : null;
  const done = seated && CATEGORIES.every(([k]) => k in g.sheets[ctx.me]);
  let play = '';
  if (done) play = '<div class="waiting">Your sheet is full. Waiting for the others…</div>';
  else if (myGo) {
    const rolled = t.rollsLeft < 3;
    play = `
      <div class="hand"><div class="hand-dice">${t.dice.map((d, i) => (rolled
        ? `<button class="pickdie ${t.held[i] ? 'on' : ''}" data-g="hold" data-i="${i}" aria-pressed="${t.held[i]}" aria-label="${t.held[i] ? 'Release' : 'Hold'} die ${d}">${die(d)}</button>`
        : die(0))).join('')}</div>
        <p class="muted">${rolled ? 'Tap dice to hold them. Then roll again or pick a box below.' : 'Roll to start your turn.'}</p></div>
      <button class="btn btn-primary btn-block" data-g="roll" ${t.rollsLeft ? '' : 'disabled'}>${t.rollsLeft ? `Roll (${t.rollsLeft} left)` : 'Pick a box'}</button>`;
  } else if (g.rules.mode === 'turns') {
    const tt = g.turns[g.turn];
    play = `<div class="hand"><div class="hand-dice">${tt.dice.map((d, i) => die(d, tt.held[i] ? 'counts' : '')).join('')}</div><p class="muted">${ctx.name(g.turn)} is playing…</p></div>`;
  }
  const last = g.last ? `<div class="event">${g.last.by === ctx.me ? 'You' : ctx.name(g.last.by)} scored ${g.last.points} in ${CATEGORIES.find(([k]) => k === g.last.cat)[1].toLowerCase()}.</div>` : '';
  return last + play + sheetTable(g, ctx, seated && myGo && !done);
}

export function handle(el) {
  switch (el.dataset.g) {
    case 'roll': return { type: 'roll' };
    case 'hold': return { type: 'hold', index: Number(el.dataset.i) };
    case 'score': return { type: 'score', cat: el.dataset.k };
    default: return null;
  }
}
