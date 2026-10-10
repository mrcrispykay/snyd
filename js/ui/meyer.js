// Meyer screen.
import { allowedClaims, rollKey, rollName, ORDER } from '../games/meyer.js';
import { esc, die } from './common.js';

const claimDice = (key) => `${die(Number(key[0]), 'die-inline')}${die(Number(key[1]), 'die-inline')}`;

export function howTo(r) {
  return `
    <li>On your turn you roll two dice under the cup. Only you can look.</li>
    <li>Announce what you rolled, or lie. Your announcement has to be ${r.equalAllowed ? '<b>the same or higher</b>' : '<b>higher</b>'} than the last one. Then the cup goes on.</li>
    <li>Rolls from highest: <b>Meyer</b> (${claimDice('21')}), <b>Lille-Meyer</b> (${claimDice('31')}), pairs from 6-6 down to 1-1, then the high die first: 65, 64 … down to 32.</li>
    <li>Don’t believe the last player? <b>Lift</b> the cup instead of rolling. If the roll was at least what they said, you lose a life. If they lied, they lose one.${r.meyerDouble ? ' A Meyer costs 2 lives.' : ''}</li>
    ${r.blindPass ? '<li>Can’t think of a lie? Roll and <b>pass blind</b> without looking. You claim the same roll as before, and the next player can lift you.</li>' : ''}
    ${r.skaal ? `<li>Roll ${claimDice('32')} and you can call <b>Skål!</b>: everyone drinks and a new round starts.</li>` : ''}
    <li>${r.ending === 'firstOut' ? 'The first player to lose all their lives loses the game.' : 'Players out of lives are out. The last one with lives wins.'}</li>`;
}

export function rulesSummary(r) {
  return [`${r.lives} lives`, r.equalAllowed ? 'det eller derover' : null, r.meyerDouble ? 'Meyer double' : null, r.skaal ? '3-2 skål' : null,
    r.ending === 'firstOut' ? 'first out loses' : 'last standing wins'].filter(Boolean).join(' · ');
}

export const isMyTurn = (g, me) => g.phase === 'turn' && g.turn === me;

function lives(n, max) {
  return `<span class="lives" aria-label="${n} lives">${Array.from({ length: max }, (_, i) => `<i class="${i < n ? 'on' : ''}"></i>`).join('')}</span>`;
}

export function render(g, ctx) {
  const ui = ctx.ui;
  const players = `<ul class="players">${g.players.filter((p) => !p.left).map((p) => `
    <li class="player ${g.phase === 'turn' && g.turn === p.id ? 'turn' : ''} ${p.out ? 'is-out' : ''}">
      <span class="pname">${ctx.name(p.id)}${p.id === ctx.me ? ' <span class="you">(you)</span>' : ''}</span>
      <span class="cups">${lives(p.lives, g.rules.lives)}</span>
      <span class="plast">${p.out ? '<span class="pill">out</span>' : ''}${ctx.connected(p.id) ? '' : '<span class="pill pill-warn">offline</span>'}</span>
    </li>`).join('')}</ul>`;

  if (g.phase === 'reveal' || g.phase === 'over') return players + reveal(g, ctx);

  const myTurn = g.turn === ctx.me;
  const claim = g.claim
    ? `<div class="current"><p class="eyebrow">${ctx.name(g.claim.by)} ${g.claim.blind ? 'passed blind' : 'says'}</p>
        <p class="current-bid">${rollName(g.claim.key)}</p><p class="claim-dice">${claimDice(g.claim.key)}</p></div>`
    : `<div class="current"><p class="eyebrow">New round</p><p class="current-none">${myTurn ? 'You start' : `${ctx.name(g.turn)} starts`}</p></div>`;
  const hist = g.history.length > 1
    ? `<div class="history">${g.history.slice(0, -1).map((c) => `<span>${ctx.name(c.by)}: ${c.blind ? 'blind' : rollName(c.key)}</span>`).join('')}</div>`
    : '';

  if (!myTurn) {
    let doing = `Waiting for <b>${ctx.name(g.turn)}</b>…`;
    if (g.cup) doing = g.cup.looked ? `<b>${ctx.name(g.turn)}</b> is looking under the cup…` : `<b>${ctx.name(g.turn)}</b> rolled…`;
    return players + claim + hist + `<div class="cup-big ${g.cup ? 'shaken' : ''}" aria-hidden="true"></div><div class="waiting">${doing}</div>`;
  }

  let body;
  if (!g.cup) {
    body = `
      <div class="actions card">
        <p class="eyebrow your-turn">Your turn</p>
        <p class="muted">${g.claim ? `Believe ${ctx.name(g.claim.by)} and roll, or lift the cup.` : 'Roll the dice.'}</p>
        <div class="act-row">
          <button class="btn btn-primary" data-g="roll">Roll</button>
          ${g.claim ? '<button class="btn btn-snyd" data-g="lift">Lift!</button>' : ''}
        </div>
      </div>`;
  } else if (!g.cup.looked) {
    body = `
      <button class="cup-big shaken tap" data-g="look" aria-label="Look under the cup"><span>Tap to look</span></button>
      ${g.claim && g.rules.blindPass ? `<div class="act-row"><button class="btn" data-g="blind">Pass blind (${esc(rollName(g.claim.key))})</button></div>` : ''}`;
  } else {
    const truth = rollKey(g.cup.dice);
    const allowed = allowedClaims(g);
    const key = `${g.round}:${g.history.length}`;
    if (ui.claimKey !== key) { ui.claim = allowed.includes(truth) ? truth : allowed[0]; ui.claimKey = key; }
    const options = ORDER.slice().reverse().filter((k) => allowed.includes(k));
    body = `
      <div class="hand"><div class="hand-dice">${die(g.cup.dice[0])}${die(g.cup.dice[1])}</div><p class="muted">You rolled <b>${rollName(truth)}</b></p></div>
      ${truth === '32' && g.rules.skaal ? '<button class="btn btn-snyd btn-block" data-g="skaal">Skål!</button>' : ''}
      <div class="actions card">
        <p class="eyebrow your-turn">Announce</p>
        <div class="claims">${options.map((k) => `<button class="claim ${ui.claim === k ? 'on' : ''} ${k === truth ? 'truth' : ''}" data-g="pick" data-k="${k}" aria-pressed="${ui.claim === k}">${rollName(k)}</button>`).join('')}</div>
        <button class="btn btn-primary btn-block" data-g="announce" ${allowed.includes(ui.claim) ? '' : 'disabled'}>Say “${esc(rollName(ui.claim))}”${ui.claim === truth ? ' (true)' : ''}</button>
        ${allowed.includes(truth) ? '' : '<p class="hint">Your roll isn’t high enough. Time to lie.</p>'}
      </div>`;
  }
  return players + claim + hist + body;
}

function reveal(g, ctx) {
  const r = g.reveal;
  let out = '';
  if (r && r.type === 'skaal') {
    out = `<div class="card reveal-head holds"><p class="eyebrow">${ctx.name(r.by)} rolled</p><p class="verdict">${die(r.dice[0], 'die-inline')} ${die(r.dice[1], 'die-inline')} Skål!</p><p class="verdict-sub">Everyone drinks. Nobody loses a life, and a new round starts.</p></div>`;
  } else if (r) {
    out = `
      <div class="card reveal-head ${r.truthful ? 'holds' : 'fails'}">
        <p class="eyebrow">${ctx.name(r.lifter)} lifted ${ctx.name(r.claim.by)}’s cup</p>
        <p class="verdict">${die(r.dice[0], 'die-inline')} ${die(r.dice[1], 'die-inline')} ${rollName(r.actual)}</p>
        <p class="verdict-sub">${ctx.name(r.claim.by)} ${r.claim.blind ? 'passed blind on' : 'said'} <b>${rollName(r.claim.key)}</b>. ${r.truthful ? 'That holds' : 'That was a bluff'}, so <b>${r.loser === ctx.me ? 'you lose' : `${ctx.name(r.loser)} loses`} ${r.lost === 2 ? '2 lives' : 'a life'}</b>.</p>
      </div>`;
  }
  if (g.phase === 'over') {
    const res = g.result || {};
    let line = 'Game over.';
    if (res.loser) line = res.loser === ctx.me ? 'You’re out of lives. Your round!' : `${ctx.name(res.loser)} is out of lives and buys the round.`;
    if (res.winner) line = res.winner === ctx.me ? 'You’re the last one standing. You win!' : `${ctx.name(res.winner)} is the last one standing and wins.`;
    return out + ctx.gameOver(line);
  }
  return `${out}<button class="btn btn-primary btn-block" data-g="next">Next round</button>`;
}

export function handle(el, g, ctx) {
  switch (el.dataset.g) {
    case 'roll': return { type: 'roll' };
    case 'lift': return { type: 'lift' };
    case 'look': return { type: 'look' };
    case 'blind': return { type: 'blind' };
    case 'skaal': return { type: 'skaal' };
    case 'pick': ctx.ui.claim = el.dataset.k; return null;
    case 'announce': return { type: 'announce', key: ctx.ui.claim };
    case 'next': return { type: 'next' };
    default: return null;
  }
}
