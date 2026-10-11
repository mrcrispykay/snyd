// Meyer screen.
import { allowedClaims, rollKey, ORDER } from '../games/meyer.js';
import { t } from '../i18n/index.js';
import { die } from './common.js';

/** The roll's name in the current language (Meyer / Mia / Mäxchen …). */
export function rollName(key) {
  if (key === '21') return t('Meyer');
  if (key === '31') return t('Lille-Meyer');
  if (key[0] === key[1]) return t('Pair {n}', { n: key[0] });
  return key;
}

export function rulesSummary(r) {
  return [t('{n} lives', { n: r.lives }), r.equalAllowed ? t('same roll allowed') : null, r.meyerDouble ? t('top roll costs double') : null, r.skaal ? t('3-2 is cheers') : null,
    r.ending === 'firstOut' ? t('first out loses') : t('last standing wins')].filter(Boolean).join(' · ');
}

export const isMyTurn = (g, me) => g.phase === 'turn' && g.turn === me;

const claimDice = (key) => `${die(Number(key[0]), 'die-inline')}${die(Number(key[1]), 'die-inline')}`;

function lives(n, max) {
  return `<span class="lives" aria-label="${t('{n} lives', { n })}">${Array.from({ length: max }, (_, i) => `<i class="${i < n ? 'on' : ''}"></i>`).join('')}</span>`;
}

export function render(g, ctx) {
  const ui = ctx.ui;
  const players = `<ul class="players">${g.players.filter((p) => !p.left).map((p) => `
    <li class="player ${g.phase === 'turn' && g.turn === p.id ? 'turn' : ''} ${p.out ? 'is-out' : ''}">
      <span class="pname">${ctx.name(p.id)}${p.id === ctx.me ? ` <span class="you">(${t('you')})</span>` : ''}</span>
      <span class="cups">${lives(p.lives, g.rules.lives)}</span>
      <span class="plast">${p.out ? `<span class="pill">${t('out')}</span>` : ''}${ctx.connected(p.id) ? '' : `<span class="pill pill-warn">${t('offline')}</span>`}</span>
    </li>`).join('')}</ul>`;

  if (g.phase === 'reveal' || g.phase === 'over') return players + reveal(g, ctx);

  const myTurn = g.turn === ctx.me;
  const claim = g.claim
    ? `<div class="current"><p class="eyebrow">${g.claim.blind ? t('{name} passed blind', { name: ctx.name(g.claim.by) }) : t('{name} says', { name: ctx.name(g.claim.by) })}</p>
        <p class="current-bid">${rollName(g.claim.key)}</p><p class="claim-dice">${claimDice(g.claim.key)}</p></div>`
    : `<div class="current"><p class="eyebrow">${t('New round')}</p><p class="current-none">${myTurn ? t('You start') : t('{name} starts', { name: ctx.name(g.turn) })}</p></div>`;
  const hist = g.history.length > 1
    ? `<div class="history">${g.history.slice(0, -1).map((c) => `<span>${ctx.name(c.by)}: ${c.blind ? t('blind') : rollName(c.key)}</span>`).join('')}</div>`
    : '';

  if (!myTurn) {
    let doing = t('Waiting for <b>{name}</b>…', { name: ctx.name(g.turn) });
    if (g.cup) doing = g.cup.looked ? t('<b>{name}</b> is looking under the cup…', { name: ctx.name(g.turn) }) : t('<b>{name}</b> rolled…', { name: ctx.name(g.turn) });
    return players + claim + hist + `<div class="cup-big ${g.cup ? 'shaken' : ''}" aria-hidden="true"></div><div class="waiting">${doing}</div>`;
  }

  let body;
  if (!g.cup) {
    body = `
      <div class="actions card">
        <p class="eyebrow your-turn">${t('Your turn')}</p>
        <p class="muted">${g.claim ? t('Believe {name} and roll, or lift the cup.', { name: ctx.name(g.claim.by) }) : t('Roll the dice.')}</p>
        <div class="act-row">
          <button class="btn btn-primary" data-g="roll">${t('Roll')}</button>
          ${g.claim ? `<button class="btn btn-snyd" data-g="lift">${t('Lift!')}</button>` : ''}
        </div>
      </div>`;
  } else if (!g.cup.looked) {
    body = `
      <button class="cup-big shaken tap" data-g="look" aria-label="${t('Look under the cup')}"><span>${t('Tap to look')}</span></button>
      ${g.claim && g.rules.blindPass ? `<div class="act-row"><button class="btn" data-g="blind">${t('Pass blind ({claim})', { claim: rollName(g.claim.key) })}</button></div>` : ''}`;
  } else {
    const truth = rollKey(g.cup.dice);
    const allowed = allowedClaims(g);
    const key = `${g.round}:${g.history.length}`;
    if (ui.claimKey !== key) { ui.claim = allowed.includes(truth) ? truth : allowed[0]; ui.claimKey = key; }
    const options = ORDER.slice().reverse().filter((k) => allowed.includes(k));
    body = `
      <div class="hand"><div class="hand-dice">${die(g.cup.dice[0])}${die(g.cup.dice[1])}</div><p class="muted">${t('You rolled <b>{roll}</b>', { roll: rollName(truth) })}</p></div>
      ${truth === '32' && g.rules.skaal ? `<button class="btn btn-snyd btn-block" data-g="skaal">${t('Cheers!')}</button>` : ''}
      <div class="actions card">
        <p class="eyebrow your-turn">${t('Announce')}</p>
        <div class="claims">${options.map((k) => `<button class="claim ${ui.claim === k ? 'on' : ''} ${k === truth ? 'truth' : ''}" data-g="pick" data-k="${k}" aria-pressed="${ui.claim === k}">${rollName(k)}</button>`).join('')}</div>
        <button class="btn btn-primary btn-block" data-g="announce" ${allowed.includes(ui.claim) ? '' : 'disabled'}>${t('Say “{claim}”', { claim: rollName(ui.claim) })}${ui.claim === truth ? ` (${t('true')})` : ''}</button>
        ${allowed.includes(truth) ? '' : `<p class="hint">${t('Your roll isn’t high enough. Time to lie.')}</p>`}
      </div>`;
  }
  return players + claim + hist + body;
}

function reveal(g, ctx) {
  const r = g.reveal;
  let out = '';
  if (r && r.type === 'skaal') {
    out = `<div class="card reveal-head holds"><p class="eyebrow">${t('{name} rolled', { name: ctx.name(r.by) })}</p><p class="verdict">${die(r.dice[0], 'die-inline')} ${die(r.dice[1], 'die-inline')} ${t('Cheers!')}</p><p class="verdict-sub">${t('Everyone drinks. Nobody loses a life, and a new round starts.')}</p></div>`;
  } else if (r) {
    const said = r.claim.blind ? t('{name} passed blind on <b>{claim}</b>.', { name: ctx.name(r.claim.by), claim: rollName(r.claim.key) }) : t('{name} said <b>{claim}</b>.', { name: ctx.name(r.claim.by), claim: rollName(r.claim.key) });
    const verdict = r.truthful ? t('That holds,') : t('That was a bluff,');
    const loses = r.loser === ctx.me
      ? (r.lost === 2 ? t('so <b>you lose 2 lives</b>.') : t('so <b>you lose a life</b>.'))
      : (r.lost === 2 ? t('so <b>{name} loses 2 lives</b>.', { name: ctx.name(r.loser) }) : t('so <b>{name} loses a life</b>.', { name: ctx.name(r.loser) }));
    out = `
      <div class="card reveal-head ${r.truthful ? 'holds' : 'fails'}">
        <p class="eyebrow">${t('{a} lifted {b}’s cup', { a: ctx.name(r.lifter), b: ctx.name(r.claim.by) })}</p>
        <p class="verdict">${die(r.dice[0], 'die-inline')} ${die(r.dice[1], 'die-inline')} ${rollName(r.actual)}</p>
        <p class="verdict-sub">${said} ${verdict} ${loses}</p>
      </div>`;
  }
  if (g.phase === 'over') {
    const res = g.result || {};
    let line = t('Game over.');
    if (res.loser) line = res.loser === ctx.me ? t('You’re out of lives. Your round!') : t('{name} is out of lives and buys the round.', { name: ctx.name(res.loser) });
    if (res.winner) line = res.winner === ctx.me ? t('You’re the last one standing. You win!') : t('{name} is the last one standing and wins.', { name: ctx.name(res.winner) });
    return out + ctx.gameOver(line);
  }
  return `${out}<button class="btn btn-primary btn-block" data-g="next">${t('Next round')}</button>`;
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
