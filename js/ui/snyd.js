// Snyd screen.
import { validBid, lowestBid, biddableFaces, activePlayers } from '../games/snyd.js';
import { esc, die } from './common.js';

const bidText = (b) => `${b.count} × ${die(b.face, 'die-inline')}`;

export function howTo(r) {
  return `
    <li>Everyone shakes their dice in secret. Look at your own, not anyone else’s.</li>
    <li>Take turns bidding how many dice of one face are on the <b>whole table</b>, e.g. “5 × ${die(4, 'die-inline')}”. Each bid must be more dice, or the same number with a higher face.</li>
    ${r.onesWild ? `<li>${die(1, 'die-inline')} is wild: it counts as whatever face is bid.</li>` : ''}
    ${r.trappe ? `<li><b>Trappe:</b> if your dice run 1-2-3… with no gaps (all of them), they count as your number of dice + 1. A lone ${die(1, 'die-inline')} counts as 2.</li>` : ''}
    ${r.tilStede ? '<li><b>Til stede:</b> wilds and trappes only count if at least one real die shows the bid face.</li>' : ''}
    <li>Don’t believe the last bid? Call <b>Snyd!</b> Everyone’s dice are shown. If the bid holds, the caller loses the round; if not, the bidder loses.</li>
    <li>${r.diceLoss === 'others' ? 'Everyone <b>except</b> the round’s loser drops a die. Players with no dice left are safe. The last player with dice loses the game.' : 'The round’s loser drops a die. Players with no dice left are out. The last player with dice wins.'}</li>
    <li>The round’s loser starts the next round.</li>`;
}

export function rulesSummary(r) {
  return [`${r.dicePerPlayer} dice`, r.onesWild ? 'ones wild' : null, r.trappe ? 'trappe' : null, r.tilStede ? 'til stede' : null,
    r.diceLoss === 'others' ? 'last with dice loses' : 'last with dice wins'].filter(Boolean).join(' · ');
}

/** Becomes true when it's this player's turn (main.js vibrates). */
export const isMyTurn = (g, me) => g.phase === 'bidding' && g.turn === me;

function playerRow(p, g, ctx) {
  const isTurn = g.phase === 'bidding' && g.turn === p.id;
  const last = [...g.history].reverse().find((b) => b.by === p.id);
  const cups = Array.from({ length: Math.max(p.count, 0) }, () => '<i></i>').join('');
  let state = '';
  if (p.out && !p.left) state = g.rules.diceLoss === 'others' ? '<span class="pill pill-safe">safe</span>' : '<span class="pill">out</span>';
  if (!ctx.connected(p.id)) state += '<span class="pill pill-warn">offline</span>';
  return `
    <li class="player ${isTurn ? 'turn' : ''} ${p.out ? 'is-out' : ''}">
      <span class="pname">${ctx.name(p.id)}${p.id === ctx.me ? ' <span class="you">(you)</span>' : ''}</span>
      <span class="cups" aria-label="${p.count} dice">${cups}</span>
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
    ? `<div class="current"><p class="eyebrow">${ctx.name(g.bid.by)} bids</p><p class="current-bid">${bidText(g.bid)}</p></div>`
    : `<div class="current"><p class="eyebrow">New round</p><p class="current-none">${myTurn ? 'You open' : `${ctx.name(g.turn)} opens`}</p></div>`;

  const hand = me && !me.out
    ? `<div class="hand ${ctx.covered ? 'covered' : ''}">
        <div class="hand-dice">${me.dice.map((d) => die(d)).join('')}</div>
        <button class="cover" data-act="cover" aria-label="${ctx.covered ? 'Show my dice' : 'Hide my dice'}">${ctx.covered ? 'Tap to look at your dice' : ''}</button>
        <button class="btn btn-quiet btn-small hide-btn" data-act="cover">${ctx.covered ? 'Show' : 'Hide'}</button>
      </div>`
    : `<div class="card center muted">${me ? 'You’re out of dice. Watch the others finish.' : 'You’re watching this game.'}</div>`;

  let actions;
  if (myTurn) {
    const key = `${g.round}:${g.history.length}`;
    if (ui.pickKey !== key) { ui.pick = lowestBid(g); ui.pickKey = key; }
    const err = validBid(g, ui.pick);
    const maxCount = activePlayers(g).reduce((a, p) => a + p.count + 1, 0);
    actions = `
      <div class="actions card">
        <p class="eyebrow your-turn">Your turn</p>
        <div class="picker">
          <div class="stepper">
            <button class="btn step" data-g="count" data-d="-1" ${ui.pick.count <= 1 ? 'disabled' : ''} aria-label="Fewer">−</button>
            <span class="count" aria-live="polite">${ui.pick.count}</span>
            <button class="btn step" data-g="count" data-d="1" ${ui.pick.count >= maxCount ? 'disabled' : ''} aria-label="More">+</button>
          </div>
          <span class="times">×</span>
          <div class="faces">${biddableFaces(g.rules).map((f) => `<button class="face ${ui.pick.face === f ? 'on' : ''}" data-g="face" data-f="${f}" aria-label="${f}" aria-pressed="${ui.pick.face === f}">${die(f)}</button>`).join('')}</div>
        </div>
        <div class="act-row">
          <button class="btn btn-primary" data-g="bid" ${err ? 'disabled' : ''}>Bid ${ui.pick.count} × ${die(ui.pick.face, 'die-inline')}</button>
          ${g.bid ? '<button class="btn btn-snyd" data-g="snyd">Snyd!</button>' : ''}
        </div>
        ${err ? `<p class="hint">${esc(err)}</p>` : ''}
      </div>`;
  } else {
    actions = `<div class="waiting">Waiting for <b>${ctx.name(g.turn)}</b>…</div>`;
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
        <p class="eyebrow">${ctx.name(r.caller)} called snyd on ${ctx.name(r.bid.by)}</p>
        <p class="verdict">${r.total} × ${die(r.bid.face, 'die-inline')} on the table</p>
        <p class="verdict-sub">The bid was ${bidText(r.bid)}. It ${r.holds ? '<b>holds</b>' : '<b>fails</b>'}, so <b>${r.loser === ctx.me ? 'you lose' : `${loserName} loses`}</b> the round.</p>
        <p class="muted">${g.rules.diceLoss === 'others' ? `Everyone except ${loserName} drops a die.` : `${loserName} drops a die.`}</p>
      </div>
      <ul class="reveal-hands">
        ${r.hands.map((h) => `
          <li><span class="pname">${ctx.name(h.id)}${h.trappe ? ' <span class="pill pill-trappe">trappe</span>' : ''}</span>
            <span class="rdice">${h.dice.map((d, i) => die(d, h.counting[i] ? 'counts' : 'dim')).join('')}</span>
            <span class="rval">${h.value}</span></li>`).join('')}
      </ul>`;
  }
  if (g.phase === 'over') {
    const res = g.result || {};
    let line = 'Game over.';
    if (res.loser) line = res.loser === ctx.me ? 'You’re the last one with dice. Your round!' : `${ctx.name(res.loser)} is the last one with dice and buys the round.`;
    if (res.winner) line = res.winner === ctx.me ? 'You’re the last one with dice. You win!' : `${ctx.name(res.winner)} is the last one with dice and wins.`;
    return out + ctx.gameOver(line);
  }
  return `${out}<button class="btn btn-primary btn-block" data-g="next">Next round</button>`;
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
