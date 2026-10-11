// Snyd screen.
import { validBid, lowestBid, biddableFaces, activePlayers } from '../games/snyd.js';
import { t } from '../i18n/index.js';
import { die } from './common.js';

const bidText = (b) => `${b.count} × ${die(b.face, 'die-inline')}`;

export function rulesSummary(r) {
  return [t('{n} dice', { n: r.dicePerPlayer }), r.onesWild ? t('ones wild') : null, r.trappe ? t('trappe') : null, r.tilStede ? t('til stede') : null,
    r.diceLoss === 'others' ? t('last with dice loses') : t('last with dice wins')].filter(Boolean).join(' · ');
}

export const isMyTurn = (g, me) => g.phase === 'bidding' && g.turn === me;

function playerRow(p, g, ctx) {
  const isTurn = g.phase === 'bidding' && g.turn === p.id;
  const last = [...g.history].reverse().find((b) => b.by === p.id);
  const cups = Array.from({ length: Math.max(p.count, 0) }, () => '<i></i>').join('');
  let state = '';
  if (p.out && !p.left) state = g.rules.diceLoss === 'others' ? `<span class="pill pill-safe">${t('safe')}</span>` : `<span class="pill">${t('out')}</span>`;
  if (!ctx.connected(p.id)) state += `<span class="pill pill-warn">${t('offline')}</span>`;
  return `
    <li class="player ${isTurn ? 'turn' : ''} ${p.out ? 'is-out' : ''}">
      <span class="pname">${ctx.name(p.id)}${p.id === ctx.me ? ` <span class="you">(${t('you')})</span>` : ''}</span>
      <span class="cups" aria-label="${t('{n} dice', { n: p.count })}">${cups}</span>
      <span class="plast">${last && g.phase === 'bidding' ? bidText(last) : ''}${state}</span>
    </li>`;
}

export function render(g, ctx) {
  const ui = ctx.ui;
  const me = g.players.find((p) => p.id === ctx.me);
  const players = `<ul class="players">${g.players.filter((p) => !p.left).map((p) => playerRow(p, g, ctx)).join('')}</ul>`;
  if (g.phase === 'reveal' || g.phase === 'over') return players + reveal(g, ctx);

  const myTurn = g.turn === ctx.me;
  const bidBox = g.bid
    ? `<div class="current"><p class="eyebrow">${t('{name} bids', { name: ctx.name(g.bid.by) })}</p><p class="current-bid">${bidText(g.bid)}</p></div>`
    : `<div class="current"><p class="eyebrow">${t('New round')}</p><p class="current-none">${myTurn ? t('You open') : t('{name} opens', { name: ctx.name(g.turn) })}</p></div>`;

  const hand = me && !me.out
    ? `<div class="hand ${ctx.covered ? 'covered' : ''}">
        <div class="hand-dice">${me.dice.map((d) => die(d)).join('')}</div>
        <button class="cover" data-act="cover" aria-label="${ctx.covered ? t('Show my dice') : t('Hide my dice')}">${ctx.covered ? t('Tap to look at your dice') : ''}</button>
        <button class="btn btn-quiet btn-small hide-btn" data-act="cover">${ctx.covered ? t('Show') : t('Hide')}</button>
      </div>`
    : `<div class="card center muted">${me ? t('You’re out of dice. Watch the others finish.') : t('You’re watching this game.')}</div>`;

  let actions;
  if (myTurn) {
    const key = `${g.round}:${g.history.length}`;
    if (ui.pickKey !== key) { ui.pick = lowestBid(g); ui.pickKey = key; }
    const err = validBid(g, ui.pick);
    const maxCount = activePlayers(g).reduce((a, p) => a + p.count + 1, 0);
    actions = `
      <div class="actions card">
        <p class="eyebrow your-turn">${t('Your turn')}</p>
        <div class="picker">
          <div class="stepper">
            <button class="btn step" data-g="count" data-d="-1" ${ui.pick.count <= 1 ? 'disabled' : ''} aria-label="${t('Fewer')}">−</button>
            <span class="count" aria-live="polite">${ui.pick.count}</span>
            <button class="btn step" data-g="count" data-d="1" ${ui.pick.count >= maxCount ? 'disabled' : ''} aria-label="${t('More')}">+</button>
          </div>
          <span class="times">×</span>
          <div class="faces">${biddableFaces(g.rules).map((f) => `<button class="face ${ui.pick.face === f ? 'on' : ''}" data-g="face" data-f="${f}" aria-label="${f}" aria-pressed="${ui.pick.face === f}">${die(f)}</button>`).join('')}</div>
        </div>
        <div class="act-row">
          <button class="btn btn-primary" data-g="bid" ${err ? 'disabled' : ''}>${t('Bid')} ${ui.pick.count} × ${die(ui.pick.face, 'die-inline')}</button>
          ${g.bid ? `<button class="btn btn-snyd" data-g="snyd">${t('Snyd!')}</button>` : ''}
        </div>
        ${err ? `<p class="hint">${t(err.key, err.params)}</p>` : ''}
      </div>`;
  } else {
    actions = `<div class="waiting">${t('Waiting for <b>{name}</b>…', { name: ctx.name(g.turn) })}</div>`;
  }
  const hist = g.history.length > 1
    ? `<div class="history">${g.history.slice(0, -1).map((b) => `<span>${ctx.name(b.by)} ${bidText(b)}</span>`).join('')}</div>`
    : '';
  return players + bidBox + hist + hand + actions;
}

function reveal(g, ctx) {
  const r = g.reveal;
  let out = '';
  if (r) {
    const loserName = ctx.name(r.loser);
    out = `
      <div class="card reveal-head ${r.holds ? 'holds' : 'fails'}">
        <p class="eyebrow">${t('{a} called snyd on {b}', { a: ctx.name(r.caller), b: ctx.name(r.bid.by) })}</p>
        <p class="verdict">${t('{n} × {face} on the table', { n: r.total, face: die(r.bid.face, 'die-inline') })}</p>
        <p class="verdict-sub">${t('The bid was {bid}.', { bid: bidText(r.bid) })} ${r.holds ? t('It holds,') : t('It fails,')} ${r.loser === ctx.me ? t('so <b>you lose</b> the round.') : t('so <b>{name} loses</b> the round.', { name: loserName })}</p>
        <p class="muted">${g.rules.diceLoss === 'others' ? t('Everyone except {name} drops a die.', { name: loserName }) : t('{name} drops a die.', { name: loserName })}</p>
      </div>
      <ul class="reveal-hands">
        ${r.hands.map((h) => `
          <li><span class="pname">${ctx.name(h.id)}${h.trappe ? ` <span class="pill pill-trappe">${t('trappe')}</span>` : ''}</span>
            <span class="rdice">${h.dice.map((d, i) => die(d, h.counting[i] ? 'counts' : 'dim')).join('')}</span>
            <span class="rval">${h.value}</span></li>`).join('')}
      </ul>`;
  }
  if (g.phase === 'over') {
    const res = g.result || {};
    let line = t('Game over.');
    if (res.loser) line = res.loser === ctx.me ? t('You’re the last one with dice. Your round!') : t('{name} is the last one with dice and buys the round.', { name: ctx.name(res.loser) });
    if (res.winner) line = res.winner === ctx.me ? t('You’re the last one with dice. You win!') : t('{name} is the last one with dice and wins.', { name: ctx.name(res.winner) });
    return out + ctx.gameOver(line);
  }
  return `${out}<button class="btn btn-primary btn-block" data-g="next">${t('Next round')}</button>`;
}

/** Handles a tap on a [data-g] element. Returns a game action, or null after changing local state. */
export function handle(el, g, ctx) {
  const ui = ctx.ui;
  switch (el.dataset.g) {
    case 'count': ui.pick = { ...ui.pick, count: Math.max(1, ui.pick.count + Number(el.dataset.d)) }; return null;
    case 'face': ui.pick = { ...ui.pick, face: Number(el.dataset.f) }; return null;
    case 'bid': return { type: 'bid', count: ui.pick.count, face: ui.pick.face };
    case 'snyd': return { type: 'snyd' };
    case 'next': return { type: 'next' };
    default: return null;
  }
}
