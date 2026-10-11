// 10.000 screen.
import { scoreDice, bestKeep } from '../games/tiotusind.js';
import { t, num as n } from '../i18n/index.js';
import { die } from './common.js';

export function rulesSummary(r) {
  return [t('to {n}', { n: n(r.target) }), r.openingMin ? t('{n} to start', { n: n(r.openingMin) }) : null, r.straights ? t('straights') : null, r.fullHouse ? t('full house') : null, r.hotDice ? t('hot dice') : null].filter(Boolean).join(' · ');
}

export const isMyTurn = (g, me) => g.phase === 'turn' && g.turn === me;

export function render(g, ctx) {
  const ui = ctx.ui;
  const top = Math.max(...g.players.map((p) => p.score));
  const board = `<ul class="players scoreboard">${g.order.map((pid) => g.players.find((p) => p.id === pid)).filter(Boolean).map((p) => `
    <li class="player ${g.turn === p.id ? 'turn' : ''}">
      <span class="pname">${ctx.name(p.id)}${p.id === ctx.me ? ` <span class="you">(${t('you')})</span>` : ''}</span>
      <span class="cups muted">${p.score === 0 && g.rules.openingMin ? t('not on the board') : ''}${g.finalRound?.remaining.includes(p.id) ? t('last turn') : ''}${ctx.connected(p.id) ? '' : ` · ${t('offline')}`}</span>
      <span class="score ${p.score === top && top > 0 ? 'lead' : ''}">${n(p.score)}</span>
    </li>`).join('')}</ul>`;

  let event = '';
  const e = g.event;
  const who = (id) => (id === ctx.me ? t('You') : ctx.name(id));
  if (e?.type === 'bust') event = `<div class="event bust">${t('{name} rolled {dice}. Nothing scores.', { name: who(e.by), dice: e.roll.map((d) => die(d, 'die-inline')).join('') })}${e.lost ? ` ${t('{n} lost.', { n: n(e.lost) })}` : ''}</div>`;
  if (e?.type === 'bank') event = `<div class="event bank">${t('{name} banked {n}.', { name: who(e.by), n: n(e.points) })}${e.reached ? ` ${t('Everyone else gets one last turn!')}` : ''}</div>`;
  const final = g.finalRound && g.phase === 'turn' ? `<div class="event">${t('Last round: {name} is on {n}.', { name: ctx.name(g.finalRound.by), n: n(g.players.find((p) => p.id === g.finalRound.by)?.score || 0) })}</div>` : '';

  if (g.phase === 'over') {
    const w = g.result.winners;
    const line = w.length > 1 ? t('{names} share the win with {n}.', { names: w.map(ctx.name).join(' & '), n: n(g.result.top) })
      : w[0] === ctx.me ? t('You win with {n}!', { n: n(g.result.top) }) : t('{name} wins with {n}.', { name: ctx.name(w[0]), n: n(g.result.top) });
    return board + event + ctx.gameOver(line);
  }

  const myTurn = g.turn === ctx.me;
  const kept = g.kept.length
    ? `<div class="kept"><span class="eyebrow">${t('Set aside')}</span>${g.kept.map((k) => (k.hot ? `<span class="pill pill-trappe">${t('hot dice')}</span>` : `<span class="kept-group">${k.dice.map((d) => die(d, 'die-small')).join('')}<small>${n(k.pts)}</small></span>`)).join('')}</div>`
    : '';

  const rollKey = `${g.turn}:${g.roll.join('')}:${g.kept.length}`;
  if (ui.rollKey !== rollKey) { ui.sel = []; ui.rollKey = rollKey; }
  const sel = ui.sel;
  const selPts = sel.length ? scoreDice(sel.map((i) => g.roll[i]), g.rules) : 0;
  const after = g.turnPoints + (selPts || 0);

  const rollDice = g.roll.length
    ? `<div class="hand"><div class="hand-dice">${g.roll.map((d, i) => (myTurn
      ? `<button class="pickdie ${sel.includes(i) ? 'on' : ''}" data-g="sel" data-i="${i}" aria-pressed="${sel.includes(i)}" aria-label="${d}">${die(d)}</button>`
      : die(d))).join('')}</div></div>`
    : `<div class="hand"><p class="muted">${myTurn ? t('Your turn. Roll the dice!') : t('{name} is about to roll…', { name: ctx.name(g.turn) })}</p></div>`;

  const turnLine = `<div class="current"><p class="eyebrow">${myTurn ? t('Your turn') : t('{name}’s turn', { name: ctx.name(g.turn) })}</p><p class="current-bid">${n(myTurn ? after : g.turnPoints)}</p></div>`;

  if (!myTurn) return board + event + final + turnLine + kept + rollDice + `<div class="waiting">${t('Waiting for <b>{name}</b>…', { name: ctx.name(g.turn) })}</div>`;

  let actions;
  if (!g.roll.length) {
    actions = `<button class="btn btn-primary btn-block" data-g="roll">${t('Roll {n} dice', { n: g.diceLeft })}</button>`;
  } else {
    const valid = sel.length > 0 && selPts !== null;
    const left = g.diceLeft - sel.length;
    const rollCount = left === 0 && g.rules.hotDice ? 5 : left;
    const me = g.players.find((p) => p.id === ctx.me);
    const canBank = valid && (me.score > 0 || after >= g.rules.openingMin);
    let hint = t('Tap the dice you want to set aside.');
    if (sel.length && selPts === null) hint = t('Some of those dice don’t score.');
    else if (valid && !canBank) hint = t('You need {n} in one turn to get on the board.', { n: n(g.rules.openingMin) });
    else if (valid) hint = t('{n} from these dice.', { n: n(selPts) });
    const best = bestKeep(g.roll, g.rules);
    actions = `
      <div class="actions card">
        <p class="hint">${hint}</p>
        <div class="act-row">
          <button class="btn" data-g="roll" ${valid && rollCount > 0 ? '' : 'disabled'}>${rollCount === 1 ? t('Roll 1 die') : t('Roll {n} dice', { n: rollCount || '' })}</button>
          <button class="btn btn-primary" data-g="bank" ${canBank ? '' : 'disabled'}>${t('Bank')} ${valid ? n(after) : ''}</button>
        </div>
        ${best.pts && !sel.length ? `<button class="btn btn-quiet btn-small" data-g="best">${t('Pick the best ({n})', { n: n(best.pts) })}</button>` : ''}
      </div>`;
  }
  return board + event + final + turnLine + kept + rollDice + actions;
}

export function handle(el, g, ctx) {
  const ui = ctx.ui;
  switch (el.dataset.g) {
    case 'sel': {
      const i = Number(el.dataset.i);
      ui.sel = ui.sel.includes(i) ? ui.sel.filter((x) => x !== i) : [...ui.sel, i];
      return null;
    }
    case 'best': ui.sel = bestKeep(g.roll, g.rules).idx; return null;
    case 'roll': return { type: 'roll', keep: ui.sel };
    case 'bank': return { type: 'bank', keep: ui.sel };
    default: return null;
  }
}
