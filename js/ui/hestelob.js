// Hesteløb screen.
import { t } from '../i18n/index.js';
import { card, suitGlyph } from './common.js';

const SUITS = ['S', 'H', 'D', 'C'];
export const suitName = (s) => t({ S: 'Spades', H: 'Hearts', D: 'Diamonds', C: 'Clubs' }[s]);

export const rulesSummary = (r) => `${t('track of {n}', { n: r.trackLength })} · ${r.payout === 2 ? t('winners hand out double') : t('winners hand out their bet')}`;
export const isMyTurn = (g, me) => g.phase === 'betting' && !g.bets[me] && g.players.includes(me);

function track(g) {
  const L = g.rules.trackLength;
  const lanes = SUITS.map((s) => {
    const pos = g.horses[s];
    const cells = Array.from({ length: L + 2 }, (_, i) => `<span class="cell ${i === 0 ? 'start' : i === L + 1 ? 'goal' : ''}">${i === pos ? card({ r: 1, s }, 'horse') : ''}</span>`).join('');
    return `<div class="lane">${cells}</div>`;
  }).join('');
  const side = `<div class="lane side"><span class="cell start"></span>${g.track.map((c) => `<span class="cell">${card(c, 'mini')}</span>`).join('')}<span class="cell goal">🏁</span></div>`;
  return `<div class="race" style="--cols:${L + 2}">${side}${lanes}</div>`;
}

export function render(g, ctx) {
  const ui = ctx.ui;
  const bets = `<ul class="players">${g.players.map((p) => {
    const b = g.bets[p];
    return `<li class="player"><span class="pname">${ctx.name(p)}${p === ctx.me ? ` <span class="you">(${t('you')})</span>` : ''}</span>
      <span class="plast">${b ? t('{n} on {suit}', { n: b.sips, suit: suitGlyph(b.suit) }) : `<span class="muted">${g.phase === 'betting' ? t('betting…') : t('no bet')}</span>`}</span></li>`;
  }).join('')}</ul>`;

  if (g.phase === 'betting') {
    const mine = g.bets[ctx.me];
    ui.suit = ui.suit || mine?.suit || null;
    ui.sips = ui.sips || mine?.sips || 2;
    const all = g.players.every((p) => g.bets[p]);
    const seated = g.players.includes(ctx.me);
    return `${track(g)}
      ${seated ? `<div class="actions card">
        <p class="eyebrow your-turn">${mine ? t('Your bet is in. You can still change it.') : t('Place your bet')}</p>
        <div class="suits">${SUITS.map((s) => `<button class="suitbtn ${ui.suit === s ? 'on' : ''}" data-g="suit" data-s="${s}" aria-pressed="${ui.suit === s}" aria-label="${suitName(s)}">${card({ r: 1, s })}</button>`).join('')}</div>
        <div class="stepper center-row">
          <button class="btn step" data-g="sips" data-d="-1" ${ui.sips <= 1 ? 'disabled' : ''} aria-label="${t('Fewer')}">−</button>
          <span class="count">${ui.sips}</span><span class="muted">${t('sips')}</span>
          <button class="btn step" data-g="sips" data-d="1" ${ui.sips >= 20 ? 'disabled' : ''} aria-label="${t('More')}">+</button>
        </div>
        <button class="btn btn-primary btn-block" data-g="bet" ${ui.suit ? '' : 'disabled'}>${mine ? t('Change bet') : t('Place bet')}</button>
      </div>` : ''}
      ${bets}
      ${all || ctx.isHost ? `<button class="btn btn-snyd btn-block" data-g="go">${all ? t('And they’re off!') : t('Start without the others')}</button>` : `<p class="waiting">${t('The race starts when everyone has bet.')}</p>`}`;
  }

  const last = g.last
    ? `<div class="drawn">${card(g.last.card, 'big')}<p>${t('{suit} move.', { suit: suitName(g.last.card.s) })}${g.last.back ? ` ${t('{card} sends {suit} back a step.', { card: card(g.last.back, 'mini'), suit: suitName(g.last.back.s) })}` : ''}</p></div>`
    : `<p class="waiting">${t('Turn the first card!')}</p>`;

  if (g.phase === 'over') {
    const res = g.result.map((x) => `<li class="player"><span class="pname">${ctx.name(x.id)}</span><span class="plast">${x.gives ? t('hands out <b>{n}</b>', { n: x.gives }) : t('drinks <b>{n}</b>', { n: x.drinks })}</span></li>`).join('');
    return `${track(g)}${last}<ul class="players">${res}</ul>` + ctx.gameOver(`${card({ r: 1, s: g.winner }, 'mini')} ${t('{suit} wins the race!', { suit: suitName(g.winner) })}`);
  }
  return `${track(g)}${last}<button class="btn btn-primary btn-block big-btn" data-g="draw">${t('Turn a card')}</button><p class="muted center">${t('{n} cards left in the deck', { n: g.deck })}</p>${bets}`;
}

export function handle(el, g, ctx) {
  const ui = ctx.ui;
  switch (el.dataset.g) {
    case 'suit': ui.suit = el.dataset.s; return null;
    case 'sips': ui.sips = Math.max(1, Math.min(20, ui.sips + Number(el.dataset.d))); return null;
    case 'bet': return { type: 'bet', suit: ui.suit, sips: ui.sips };
    case 'go': return { type: 'go' };
    case 'draw': return { type: 'draw' };
    default: return null;
  }
}
