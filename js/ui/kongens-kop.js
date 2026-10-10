// Kongens kop screen.
import { ruleFor } from '../games/kongens-kop.js';
import { esc, card } from './common.js';

export function howTo() {
  return `
    <li>Take turns drawing a card. Everyone sees it, and its rule says who drinks.</li>
    <li>The rules for each card are in the house rules. Change them to your own before you start.</li>
    <li>Every king goes into the cup. Whoever draws the <b>fourth king</b> drinks the cup.</li>`;
}

export const rulesSummary = () => 'house rules per card';
export const isMyTurn = (g, me) => g.phase === 'play' && g.turn === me;

export function render(g, ctx) {
  const kings = Array.from({ length: 4 }, (_, i) => `<span class="king ${i < g.kings ? 'on' : ''}">♚</span>`).join('');
  const cur = g.current;
  const rule = cur ? ruleFor(g.rules, cur.card.r) : null;
  const shown = cur
    ? `<div class="drawn">${card(cur.card, 'big')}
        <p class="eyebrow">${ctx.name(cur.by)} drew</p>
        <p class="rule-title">${esc(rule.title)}</p>
        ${rule.text ? `<p class="kk-text">${esc(rule.text)}</p>` : ''}</div>`
    : '<div class="drawn">' + card(null, 'big') + '<p class="muted">No cards drawn yet.</p></div>';
  const status = `<div class="kk-status"><span class="kings" aria-label="${g.kings} of 4 kings drawn">${kings}</span><span class="muted">${g.deck} cards left</span></div>`;

  if (g.phase === 'over') {
    const line = g.result.cup ? (g.result.cup === ctx.me ? 'You drew the fourth king. Drink the cup!' : `${ctx.name(g.result.cup)} drew the fourth king and drinks the cup!`) : 'The deck is empty.';
    return status + shown + ctx.gameOver(line);
  }
  const myTurn = g.turn === ctx.me;
  return status + shown + (myTurn
    ? '<button class="btn btn-primary btn-block big-btn" data-g="draw">Draw a card</button>'
    : `<div class="waiting">${ctx.name(g.turn)} draws next…</div>`)
    + (g.history.length > 1 ? `<div class="history">${g.history.slice(1, 6).map((h) => `<span>${ctx.name(h.by)} ${card(h.card, 'mini')}</span>`).join('')}</div>` : '');
}

export function handle(el) {
  return el.dataset.g === 'draw' ? { type: 'draw' } : null;
}
