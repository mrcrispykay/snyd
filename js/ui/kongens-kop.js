// Kongens kop screen.
import { defaults } from '../games/kongens-kop.js';
import { t, kongensKopDefault } from '../i18n/index.js';
import { esc, card } from './common.js';

/** A card's rule as { title, text }. Untouched defaults show in this phone's language. */
export function ruleFor(rules, rank) {
  const k = `r${rank}`;
  const raw = rules[k] === defaults[k] ? kongensKopDefault(k) : (rules[k] || '');
  const i = raw.indexOf(':');
  return i > 0 ? { title: raw.slice(0, i).trim(), text: raw.slice(i + 1).trim() } : { title: raw.trim(), text: '' };
}

export const rulesSummary = () => t('house rules per card');
export const isMyTurn = (g, me) => g.phase === 'play' && g.turn === me;

export function render(g, ctx) {
  const kings = Array.from({ length: 4 }, (_, i) => `<span class="king ${i < g.kings ? 'on' : ''}">♚</span>`).join('');
  const cur = g.current;
  const rule = cur ? ruleFor(g.rules, cur.card.r) : null;
  const shown = cur
    ? `<div class="drawn">${card(cur.card, 'big')}
        <p class="eyebrow">${t('{name} drew', { name: ctx.name(cur.by) })}</p>
        <p class="rule-title">${esc(rule.title)}</p>
        ${rule.text ? `<p class="kk-text">${esc(rule.text)}</p>` : ''}</div>`
    : `<div class="drawn">${card(null, 'big')}<p class="muted">${t('No cards drawn yet.')}</p></div>`;
  const status = `<div class="kk-status"><span class="kings" aria-label="${t('{n} of 4 kings drawn', { n: g.kings })}">${kings}</span><span class="muted">${t('{n} cards left', { n: g.deck })}</span></div>`;

  if (g.phase === 'over') {
    const line = g.result.cup ? (g.result.cup === ctx.me ? t('You drew the fourth king. Drink the cup!') : t('{name} drew the fourth king and drinks the cup!', { name: ctx.name(g.result.cup) })) : t('The deck is empty.');
    return status + shown + ctx.gameOver(line);
  }
  const myTurn = g.turn === ctx.me;
  return status + shown + (myTurn
    ? `<button class="btn btn-primary btn-block big-btn" data-g="draw">${t('Draw a card')}</button>`
    : `<div class="waiting">${t('{name} draws next…', { name: ctx.name(g.turn) })}</div>`)
    + (g.history.length > 1 ? `<div class="history">${g.history.slice(1, 6).map((h) => `<span>${ctx.name(h.by)} ${card(h.card, 'mini')}</span>`).join('')}</div>` : '');
}

export function handle(el) {
  return el.dataset.g === 'draw' ? { type: 'draw' } : null;
}
