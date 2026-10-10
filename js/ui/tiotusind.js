// 10.000 screen.
import { scoreDice, bestKeep } from '../games/tiotusind.js';
import { die } from './common.js';

const n = (v) => v.toLocaleString('da-DK');

export function howTo(r) {
  return `
    <li>On your turn, roll five dice. Set aside at least one scoring die, then roll the rest again or <b>bank</b> your points.</li>
    <li>If a roll has nothing that scores, you lose everything from that turn.</li>
    <li>Scores: ${die(1, 'die-inline')} 100 · ${die(5, 'die-inline')} 50 · three of a kind = face × 100 (three ${die(1, 'die-inline')} = 1.000) · four of a kind 1.500 · five of a kind 2.000${r.straights ? ' · straight 2.000' : ''}${r.fullHouse ? ' · full house 2.500' : ''}. Combinations count only within one roll.</li>
    ${r.openingMin ? `<li>You need ${n(r.openingMin)} in one turn before you’re on the board.</li>` : ''}
    ${r.hotDice ? '<li>When all five dice have scored, you can roll all five again.</li>' : ''}
    <li>The first to ${n(r.target)} gets the others one last turn each. Highest score wins.</li>`;
}

export function rulesSummary(r) {
  return [`to ${n(r.target)}`, r.openingMin ? `${r.openingMin} to start` : null, r.straights ? 'straights' : null, r.fullHouse ? 'full house' : null, r.hotDice ? 'hot dice' : null].filter(Boolean).join(' · ');
}

export const isMyTurn = (g, me) => g.phase === 'turn' && g.turn === me;

export function render(g, ctx) {
  const ui = ctx.ui;
  const top = Math.max(...g.players.map((p) => p.score));
  const board = `<ul class="players scoreboard">${g.order.map((pid) => g.players.find((p) => p.id === pid)).filter(Boolean).map((p) => `
    <li class="player ${g.turn === p.id ? 'turn' : ''}">
      <span class="pname">${ctx.name(p.id)}${p.id === ctx.me ? ' <span class="you">(you)</span>' : ''}</span>
      <span class="cups muted">${p.score === 0 && g.rules.openingMin ? 'not on the board' : ''}${g.finalRound?.remaining.includes(p.id) ? 'last turn' : ''}${ctx.connected(p.id) ? '' : ' · offline'}</span>
      <span class="score ${p.score === top && top > 0 ? 'lead' : ''}">${n(p.score)}</span>
    </li>`).join('')}</ul>`;

  let event = '';
  const e = g.event;
  if (e?.type === 'bust') event = `<div class="event bust">${e.by === ctx.me ? 'You' : ctx.name(e.by)} rolled ${e.roll.map((d) => die(d, 'die-inline')).join('')}. Nothing scores${e.lost ? `, ${n(e.lost)} lost` : ''}.</div>`;
  if (e?.type === 'bank') event = `<div class="event bank">${e.by === ctx.me ? 'You' : ctx.name(e.by)} banked ${n(e.points)}.${e.reached ? ' Everyone else gets one last turn!' : ''}</div>`;
  const final = g.finalRound && g.phase === 'turn' ? `<div class="event">Last round: ${ctx.name(g.finalRound.by)} is on ${n(g.players.find((p) => p.id === g.finalRound.by)?.score || 0)}.</div>` : '';

  if (g.phase === 'over') {
    const w = g.result.winners;
    const line = w.length > 1 ? `${w.map(ctx.name).join(' and ')} share the win with ${n(g.result.top)}.`
      : w[0] === ctx.me ? `You win with ${n(g.result.top)}!` : `${ctx.name(w[0])} wins with ${n(g.result.top)}.`;
    return board + event + ctx.gameOver(line);
  }

  const myTurn = g.turn === ctx.me;
  const kept = g.kept.length
    ? `<div class="kept"><span class="eyebrow">Set aside</span>${g.kept.map((k) => (k.hot ? '<span class="pill pill-trappe">hot dice</span>' : `<span class="kept-group">${k.dice.map((d) => die(d, 'die-small')).join('')}<small>${n(k.pts)}</small></span>`)).join('')}</div>`
    : '';

  const rollKey = `${g.turn}:${g.roll.join('')}:${g.kept.length}`;
  if (ui.rollKey !== rollKey) { ui.sel = []; ui.rollKey = rollKey; }
  const sel = ui.sel;
  const selDice = sel.map((i) => g.roll[i]);
  const selPts = sel.length ? scoreDice(selDice, g.rules) : 0;
  const after = g.turnPoints + (selPts || 0);

  const rollDice = g.roll.length
    ? `<div class="hand"><div class="hand-dice">${g.roll.map((d, i) => (myTurn
      ? `<button class="pickdie ${sel.includes(i) ? 'on' : ''}" data-g="sel" data-i="${i}" aria-pressed="${sel.includes(i)}" aria-label="Die ${d}">${die(d)}</button>`
      : die(d))).join('')}</div></div>`
    : `<div class="hand"><p class="muted">${myTurn ? 'Your turn. Roll the dice!' : `${ctx.name(g.turn)} is about to roll…`}</p></div>`;

  const turnLine = `<div class="current"><p class="eyebrow">${myTurn ? 'Your turn' : `${ctx.name(g.turn)}’s turn`}</p><p class="current-bid">${n(myTurn ? after : g.turnPoints)}</p></div>`;

  if (!myTurn) return board + event + final + turnLine + kept + rollDice + `<div class="waiting">Waiting for <b>${ctx.name(g.turn)}</b>…</div>`;

  let actions;
  if (!g.roll.length) {
    actions = `<button class="btn btn-primary btn-block" data-g="roll">Roll ${g.diceLeft} dice</button>`;
  } else {
    const valid = sel.length > 0 && selPts !== null;
    const left = g.diceLeft - sel.length;
    const rollCount = left === 0 && g.rules.hotDice ? 5 : left;
    const me = g.players.find((p) => p.id === ctx.me);
    const canBank = valid && (me.score > 0 || after >= g.rules.openingMin);
    let hint = 'Tap the dice you want to set aside.';
    if (sel.length && selPts === null) hint = 'Some of those dice don’t score.';
    else if (valid && !canBank) hint = `You need ${n(g.rules.openingMin)} in one turn to get on the board.`;
    else if (valid) hint = `${n(selPts)} from these dice.`;
    const best = bestKeep(g.roll, g.rules);
    actions = `
      <div class="actions card">
        <p class="hint">${hint}</p>
        <div class="act-row">
          <button class="btn" data-g="roll" ${valid && rollCount > 0 ? '' : 'disabled'}>Roll ${rollCount || ''} ${rollCount === 1 ? 'die' : 'dice'}</button>
          <button class="btn btn-primary" data-g="bank" ${canBank ? '' : 'disabled'}>Bank ${valid ? n(after) : ''}</button>
        </div>
        ${best.pts && !sel.length ? `<button class="btn btn-quiet btn-small" data-g="best">Pick the best (${n(best.pts)})</button>` : ''}
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
