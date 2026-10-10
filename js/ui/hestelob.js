// Hesteløb screen.
import { card, suitGlyph } from './common.js';

const SUITS = ['S', 'H', 'D', 'C'];
const SUIT_NAME = { S: 'Spades', H: 'Hearts', D: 'Diamonds', C: 'Clubs' };

export function howTo(r) {
  return `
    <li>The four aces are horses. Before the race, everyone bets sips on one of them.</li>
    <li>Cards are turned one at a time. Each card moves the ace of its suit one step forward.</li>
    <li>Beside the track lie ${r.trackLength} face-down cards. When every horse has passed one, it’s turned over, and the horse of that suit steps back.</li>
    <li>The first ace past the finish wins. Everyone who bet on it hands out ${r.payout === 2 ? 'double' : ''} their bet; everyone else drinks theirs.</li>`;
}

export const rulesSummary = (r) => `track of ${r.trackLength} · winners hand out ${r.payout === 2 ? 'double' : 'their bet'}`;
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
    return `<li class="player"><span class="pname">${ctx.name(p)}${p === ctx.me ? ' <span class="you">(you)</span>' : ''}</span>
      <span class="plast">${b ? `${b.sips} on ${suitGlyph(b.suit)}` : `<span class="muted">${g.phase === 'betting' ? 'betting…' : 'no bet'}</span>`}</span></li>`;
  }).join('')}</ul>`;

  if (g.phase === 'betting') {
    const mine = g.bets[ctx.me];
    ui.suit = ui.suit || mine?.suit || null;
    ui.sips = ui.sips || mine?.sips || 2;
    const all = g.players.every((p) => g.bets[p]);
    const seated = g.players.includes(ctx.me);
    return `${track(g)}
      ${seated ? `<div class="actions card">
        <p class="eyebrow your-turn">${mine ? 'Your bet is in. You can still change it.' : 'Place your bet'}</p>
        <div class="suits">${SUITS.map((s) => `<button class="suitbtn ${ui.suit === s ? 'on' : ''}" data-g="suit" data-s="${s}" aria-pressed="${ui.suit === s}" aria-label="${SUIT_NAME[s]}">${card({ r: 1, s })}</button>`).join('')}</div>
        <div class="stepper center-row">
          <button class="btn step" data-g="sips" data-d="-1" ${ui.sips <= 1 ? 'disabled' : ''} aria-label="Fewer sips">−</button>
          <span class="count">${ui.sips}</span><span class="muted">sips</span>
          <button class="btn step" data-g="sips" data-d="1" ${ui.sips >= 20 ? 'disabled' : ''} aria-label="More sips">+</button>
        </div>
        <button class="btn btn-primary btn-block" data-g="bet" ${ui.suit ? '' : 'disabled'}>${mine ? 'Change bet' : 'Place bet'}</button>
      </div>` : ''}
      ${bets}
      ${all || ctx.isHost ? `<button class="btn btn-snyd btn-block" data-g="go">${all ? 'And they’re off!' : 'Start without the others'}</button>` : '<p class="waiting">The race starts when everyone has bet.</p>'}`;
  }

  const last = g.last ? `<div class="drawn">${card(g.last.card, 'big')}<p>${SUIT_NAME[g.last.card.s]} move${g.last.back ? `, and ${card(g.last.back, 'mini')} sends ${SUIT_NAME[g.last.back.s]} back a step` : ''}.</p></div>` : '<p class="waiting">Turn the first card!</p>';

  if (g.phase === 'over') {
    const res = g.result.map((x) => `<li class="player"><span class="pname">${ctx.name(x.id)}</span><span class="plast">${x.gives ? `hands out <b>${x.gives}</b>` : `drinks <b>${x.drinks}</b>`}</span></li>`).join('');
    return `${track(g)}${last}<ul class="players">${res}</ul>` + ctx.gameOver(`${card({ r: 1, s: g.winner }, 'mini')} ${SUIT_NAME[g.winner]} wins the race!`);
  }
  return `${track(g)}${last}<button class="btn btn-primary btn-block big-btn" data-g="draw">Turn a card</button><p class="muted center">${g.deck} cards left in the deck</p>${bets}`;
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
