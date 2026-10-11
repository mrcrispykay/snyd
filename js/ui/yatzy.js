// Yatzy screen.
import { CATEGORIES, score, totals } from '../games/yatzy.js';
import { t } from '../i18n/index.js';
import { die } from './common.js';

const LABEL = {
  ones: 'Ones', twos: 'Twos', threes: 'Threes', fours: 'Fours', fives: 'Fives', sixes: 'Sixes', pair: 'One pair', twoPairs: 'Two pairs',
  three: 'Three of a kind', four: 'Four of a kind', small: 'Small straight', large: 'Large straight', house: 'Full house', chance: 'Chance', yatzy: 'Yahtzee',
};
const label = (k) => t(LABEL[k]);

export const rulesSummary = (r) => (r.mode === 'together' ? t('everyone at once') : t('take turns'));
export const isMyTurn = (g, me) => g.phase === 'play' && g.rules.mode === 'turns' && g.turn === me;

function sheetTable(g, ctx, mine) {
  const tt = mine ? g.turns[ctx.me] : null;
  const canScore = mine && tt && tt.rollsLeft < 3 && (g.rules.mode === 'together' || g.turn === ctx.me);
  const players = g.order;
  const head = `<tr><th></th>${players.map((p) => `<th class="${p === ctx.me ? 'me' : ''}">${ctx.name(p)}</th>`).join('')}</tr>`;
  const rows = CATEGORIES.map(([k], i) => {
    const cells = players.map((p) => {
      const v = g.sheets[p][k];
      if (v !== undefined) return `<td class="${p === ctx.me ? 'me' : ''}">${v}</td>`;
      if (p === ctx.me && canScore) {
        const pts = score(k, tt.dice);
        return `<td class="me"><button class="scorebox ${pts ? '' : 'zero'}" data-g="score" data-k="${k}">${pts}</button></td>`;
      }
      return `<td class="${p === ctx.me ? 'me' : ''} empty"></td>`;
    }).join('');
    const sep = i === 6 ? `<tr class="sub"><th>${t('Bonus')}</th>${players.map((p) => { const x = totals(g.sheets[p]); return `<td class="${p === ctx.me ? 'me' : ''}">${x.bonus || `${x.upper}/63`}</td>`; }).join('')}</tr>` : '';
    return `${sep}<tr><th>${label(k)}</th>${cells}</tr>`;
  }).join('');
  const total = `<tr class="sum"><th>${t('Total')}</th>${players.map((p) => `<td class="${p === ctx.me ? 'me' : ''}">${totals(g.sheets[p]).total}</td>`).join('')}</tr>`;
  return `<div class="sheet-wrap"><table class="sheet">${head}${rows}${total}</table></div>`;
}

export function render(g, ctx) {
  const seated = g.order.includes(ctx.me);
  if (g.phase === 'over') {
    const w = g.result.winners;
    const line = w.length > 1 ? t('{names} share the win with {n}.', { names: w.map(ctx.name).join(' & '), n: g.result.top })
      : w[0] === ctx.me ? t('You win with {n}!', { n: g.result.top }) : t('{name} wins with {n}.', { name: ctx.name(w[0]), n: g.result.top });
    return sheetTable(g, ctx, false) + ctx.gameOver(line);
  }
  const myGo = seated && (g.rules.mode === 'together' || g.turn === ctx.me);
  const tt = seated ? g.turns[ctx.me] : null;
  const done = seated && CATEGORIES.every(([k]) => k in g.sheets[ctx.me]);
  let play = '';
  if (done) play = `<div class="waiting">${t('Your sheet is full. Waiting for the others…')}</div>`;
  else if (myGo) {
    const rolled = tt.rollsLeft < 3;
    play = `
      <div class="hand"><div class="hand-dice">${tt.dice.map((d, i) => (rolled
        ? `<button class="pickdie ${tt.held[i] ? 'on' : ''}" data-g="hold" data-i="${i}" aria-pressed="${tt.held[i]}" aria-label="${d}">${die(d)}</button>`
        : die(0))).join('')}</div>
        <p class="muted">${rolled ? t('Tap dice to hold them. Then roll again or pick a box below.') : t('Roll to start your turn.')}</p></div>
      <button class="btn btn-primary btn-block" data-g="roll" ${tt.rollsLeft ? '' : 'disabled'}>${tt.rollsLeft ? t('Roll ({n} left)', { n: tt.rollsLeft }) : t('Pick a box')}</button>`;
  } else if (g.rules.mode === 'turns') {
    const ot = g.turns[g.turn];
    play = `<div class="hand"><div class="hand-dice">${ot.dice.map((d, i) => die(d, ot.held[i] ? 'counts' : '')).join('')}</div><p class="muted">${t('{name} is playing…', { name: ctx.name(g.turn) })}</p></div>`;
  }
  const last = g.last ? `<div class="event">${t('{name} scored {n} in {box}.', { name: g.last.by === ctx.me ? t('You') : ctx.name(g.last.by), n: g.last.points, box: label(g.last.cat).toLowerCase() })}</div>` : '';
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
