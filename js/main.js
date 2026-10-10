// Snyd: screens and wiring. One phone hosts (runs the engine), the others join.
import {
  newGame, apply, viewFor, validBid, lowestBid, biddableFaces, RULE_INFO, DEFAULT_RULES, activePlayers,
} from './engine.js';
import { hostRoom, joinRoom } from './net.js';

const app = document.getElementById('app');

// ---------- storage (always optional) ----------
const store = {
  get(k, d, area = 'local') { try { const v = (area === 'local' ? localStorage : sessionStorage).getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v, area = 'local') { try { (area === 'local' ? localStorage : sessionStorage).setItem(k, JSON.stringify(v)); } catch { /* private mode */ } },
  del(k, area = 'local') { try { (area === 'local' ? localStorage : sessionStorage).removeItem(k); } catch { /* ignore */ } },
};

const rid = () => Math.random().toString(36).slice(2, 10);
// One id per browser tab, so two tabs on one device are two players.
let myId = store.get('snyd.id', null, 'session');
if (!myId) { myId = rid(); store.set('snyd.id', myId, 'session'); }

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const newCode = () => Array.from({ length: 4 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
const joinUrl = (code) => `${location.origin}${location.pathname}?r=${code}`;

// ---------- session ----------
let session = null; // { role, code, view, status, ok, net }
let game = null; // host only: the full state
const ui = { pick: null, pickKey: '', covered: store.get('snyd.covered', false), leaveArmed: false, toast: '', toastTimer: null };

function toast(msg) {
  ui.toast = msg;
  clearTimeout(ui.toastTimer);
  ui.toastTimer = setTimeout(() => { ui.toast = ''; render(); }, 3500);
  render();
}

function setStatus(text, ok) {
  if (!session) return;
  session.status = text;
  session.ok = ok;
  render();
}

// ---------- dice ----------
const PIPS = {
  1: [[50, 50]],
  2: [[29, 29], [71, 71]],
  3: [[27, 27], [50, 50], [73, 73]],
  4: [[29, 29], [71, 29], [29, 71], [71, 71]],
  5: [[27, 27], [73, 27], [50, 50], [27, 73], [73, 73]],
  6: [[29, 25], [71, 25], [29, 50], [71, 50], [29, 75], [71, 75]],
};
function die(v, cls = '') {
  if (!v) return `<span class="die die-hidden ${cls}" aria-label="hidden die"></span>`;
  const pips = PIPS[v].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="${v === 1 ? 13 : 9.5}"/>`).join('');
  return `<svg class="die ${v === 1 ? 'die-one' : ''} ${cls}" viewBox="0 0 100 100" role="img" aria-label="${v}"><rect x="3" y="3" width="94" height="94" rx="20"/>${pips}</svg>`;
}
const bidText = (b) => `${b.count} × ${die(b.face, 'die-inline')}`;

// ---------- actions ----------
function act(action) {
  if (!session) return;
  if (session.role === 'host') hostDispatch(myId, action);
  else if (!session.net?.act(action)) toast('Not connected to the table right now.');
}

function hostDispatch(pid, action) {
  try {
    game = apply(game, pid, action);
  } catch (e) {
    if (pid === myId) toast(e.message);
    else session.net?.send(pid, { t: 'error', msg: e.message, fatal: action.type === 'join' });
    return;
  }
  store.set(`snyd.host.${game.code}`, game);
  broadcast();
}

function broadcast() {
  for (const p of game.players) if (p.id !== myId) session.net?.send(p.id, { t: 'state', view: viewFor(game, p.id) });
  receive(viewFor(game, myId));
}

function receive(view) {
  const prev = session.view;
  session.view = view;
  if (view.phase === 'bidding' && view.turn === myId && prev?.turn !== myId) {
    try { navigator.vibrate?.(70); } catch { /* ignore */ }
  }
  render();
}

// ---------- hosting / joining ----------
async function startHosting(name, code = null, saved = null) {
  store.set('snyd.name', name);
  const resume = !!saved;
  let attempt = 0;
  for (;;) {
    const c = code || newCode();
    game = saved || newGame({ code: c, hostId: myId });
    if (!saved) game = apply(game, myId, { type: 'join', name });
    session = { role: 'host', code: c, view: viewFor(game, myId), status: 'Opening the table…', ok: false, net: null };
    render();
    try {
      session.net = await hostRoom(c, {
        reclaim: resume,
        onHello: (pid, pname) => hostDispatch(pid, { type: 'join', name: pname }),
        onAction: (pid, action) => hostDispatch(pid, action),
        onPresence: (pid, on) => { if (game.players.some((p) => p.id === pid)) hostDispatch(pid, { type: 'connected', value: on }); },
        onStatus: setStatus,
      });
      store.set('snyd.session', { role: 'host', code: c }, 'session');
      store.set(`snyd.host.${c}`, game);
      broadcast();
      keepAwake();
      return;
    } catch (e) {
      if (e.message === 'code-taken' && attempt++ < 5 && !code) continue;
      session = null;
      toast(e.message === 'code-taken' ? 'That table code is in use. Try again.' : e.message);
      renderHome();
      return;
    }
  }
}

function startJoining(name, code) {
  code = code.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4);
  if (code.length !== 4) { toast('Table codes have 4 letters.'); return; }
  store.set('snyd.name', name);
  session = { role: 'client', code, view: null, status: 'Connecting…', ok: false, net: null };
  store.set('snyd.session', { role: 'client', code }, 'session');
  session.net = joinRoom(code, {
    id: myId,
    name,
    onStatus: setStatus,
    onMessage: (msg) => {
      if (msg.t === 'state') receive(msg.view);
      if (msg.t === 'error') {
        if (msg.fatal) { leave(); toast(msg.msg); } else toast(msg.msg);
      }
    },
  });
  keepAwake();
  render();
}

function leave() {
  if (session?.role === 'host' && game) store.del(`snyd.host.${game.code}`);
  session?.net?.close();
  session = null;
  game = null;
  store.del('snyd.session', 'session');
  history.replaceState(null, '', location.pathname);
  render();
}

let wake = null;
async function keepAwake() {
  try { if (!wake || wake.released) wake = await navigator.wakeLock?.request('screen'); } catch { /* optional */ }
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && session) keepAwake(); });
window.addEventListener('beforeunload', (e) => {
  if (session?.role === 'host' && game && game.players.length > 1) { e.preventDefault(); e.returnValue = ''; }
});

// ---------- screens ----------
function render() {
  if (!session) renderHome();
  else renderTable();
}

function toastHtml() {
  return ui.toast ? `<div class="toast" role="status">${esc(ui.toast)}</div>` : '';
}

function rulesSummary(r) {
  const parts = [`${r.dicePerPlayer} dice each`];
  parts.push(r.onesWild ? 'ones are wild' : 'ones are plain');
  if (r.trappe) parts.push('trappe counts');
  if (r.tilStede) parts.push('til stede');
  parts.push(r.diceLoss === 'others' ? 'last with dice loses' : 'last with dice wins');
  if (r.minOpeningCount > 1) parts.push(`open with ${r.minOpeningCount}+`);
  return parts.join(' · ');
}

function howTo(r) {
  return `
    <details class="howto">
      <summary>How to play</summary>
      <ol>
        <li>Everyone shakes their dice in secret. Look at your own, not anyone else’s.</li>
        <li>Take turns bidding how many dice of one face are on the <b>whole table</b>, e.g. “5 × ${die(4, 'die-inline')}”. Each bid must be more dice, or the same number with a higher face.</li>
        ${r.onesWild ? `<li>${die(1, 'die-inline')} is wild: it counts as whatever face is bid.</li>` : ''}
        ${r.trappe ? `<li><b>Trappe:</b> if your dice run 1-2-3… with no gaps (all of them), they count as your number of dice + 1. A lone ${die(1, 'die-inline')} counts as 2.</li>` : ''}
        ${r.tilStede ? '<li><b>Til stede:</b> wilds and trappes only count if at least one real die shows the bid face.</li>' : ''}
        <li>Don’t believe the last bid? Call <b>Snyd!</b> Everyone’s dice are shown. If the bid holds, the caller loses the round; if not, the bidder loses.</li>
        <li>${r.diceLoss === 'others' ? 'Everyone <b>except</b> the round’s loser drops a die. Players with no dice left are safe. The last player with dice loses the game.' : 'The round’s loser drops a die. Players with no dice left are out. The last player with dice wins.'}</li>
        <li>The round’s loser starts the next round.</li>
      </ol>
    </details>`;
}

function renderHome() {
  const params = new URLSearchParams(location.search);
  const code = (params.get('r') || '').toUpperCase();
  const name = store.get('snyd.name', '');
  app.innerHTML = `
    <section class="home">
      <header class="brand">
        <div class="brand-dice">${die(1)}${die(6)}${die(3)}</div>
        <h1>Snyd</h1>
        <p class="tag">The Danish bar dice game of bluffing. Everyone plays on their own phone.</p>
      </header>
      <form id="home-form" class="card form" autocomplete="off">
        <label for="name">Your name</label>
        <input id="name" name="name" maxlength="20" placeholder="e.g. Kasper" value="${esc(name)}" required>
        ${code ? `
          <p class="joining">Joining table <b class="code">${esc(code)}</b></p>
          <button class="btn btn-primary" data-do="join">Join table</button>
          <button class="btn btn-quiet" type="button" data-do="host">Start a new table instead</button>
        ` : `
          <button class="btn btn-primary" data-do="host">Start a table</button>
          <div class="or"><span>or join one</span></div>
          <label for="code">Table code</label>
          <div class="row">
            <input id="code" name="code" maxlength="4" placeholder="ABCD" autocapitalize="characters" inputmode="text" class="code-input">
            <button class="btn" data-do="join">Join</button>
          </div>
        `}
      </form>
      ${howTo(DEFAULT_RULES)}
      ${toastHtml()}
    </section>`;
  const form = app.querySelector('#home-form');
  form.addEventListener('submit', (e) => e.preventDefault());
  form.querySelectorAll('[data-do]').forEach((b) => b.addEventListener('click', (e) => {
    e.preventDefault();
    const n = form.querySelector('#name').value.trim();
    if (!n) { form.querySelector('#name').focus(); toast('Enter your name first.'); return; }
    if (b.dataset.do === 'host') startHosting(n);
    else startJoining(n, code || form.querySelector('#code').value);
  }));
}

function statusBar() {
  const v = session.view;
  return `
    <header class="topbar">
      <span class="code-chip" aria-label="Table code">${esc(session.code)}</span>
      <span class="status ${session.ok ? 'ok' : 'bad'}"><i></i>${esc(session.status || '')}</span>
      ${v && v.round && v.phase !== 'lobby' ? `<span class="round">Round ${v.round}</span>` : ''}
      <button class="btn btn-quiet btn-small" data-act="leave">${ui.leaveArmed ? 'Tap again to leave' : 'Leave'}</button>
    </header>`;
}

function renderTable() {
  const v = session.view;
  let body = '';
  if (!v) body = `<div class="card center"><p>${esc(session.status)}</p><p class="muted">Table ${esc(session.code)}</p></div>`;
  else if (v.phase === 'lobby') body = lobby(v);
  else body = tableView(v);
  app.innerHTML = `<section class="tablepage">${statusBar()}${body}${toastHtml()}</section>`;
  wire();
  const qr = app.querySelector('#qr');
  if (qr) drawQr(qr, joinUrl(session.code));
}

function lobby(v) {
  const isHost = v.hostId === myId;
  const r = v.rules;
  const ruleControls = Object.entries(RULE_INFO).map(([k, info]) => {
    const val = r[k];
    let ctrl;
    if (typeof DEFAULT_RULES[k] === 'boolean') {
      ctrl = `<button class="switch" role="switch" aria-checked="${val}" data-rule="${k}" data-value="${!val}" ${isHost ? '' : 'disabled'}><span></span></button>`;
    } else {
      const opts = info.options.map((o) => (Array.isArray(o) ? o : [o, String(o)]));
      ctrl = `<div class="seg ${opts.length > 3 ? '' : 'seg-wide'}">${opts.map(([ov, ol]) => `<button data-rule="${k}" data-value="${ov}" aria-pressed="${String(val) === String(ov)}" ${isHost ? '' : 'disabled'}>${esc(ol)}</button>`).join('')}</div>`;
    }
    return `<div class="rule ${typeof DEFAULT_RULES[k] === 'boolean' ? '' : 'rule-stack'}"><div><b>${info.label}</b>${info.help ? `<small>${info.help}</small>` : ''}</div>${ctrl}</div>`;
  }).join('');
  return `
    <div class="card invite">
      <div class="invite-text">
        <p class="eyebrow">Table code</p>
        <p class="big-code">${esc(session.code)}</p>
        <p class="muted">Friends scan the code or open the link and type the table code.</p>
        <div class="row">
          <button class="btn btn-small" data-act="share">Share link</button>
        </div>
      </div>
      <div id="qr" class="qr" aria-label="QR code with the join link"></div>
    </div>
    <div class="card">
      <p class="eyebrow">At the table · ${v.players.length}</p>
      <ul class="lobby-players">
        ${v.players.map((p) => `<li><span class="dot ${p.connected ? 'on' : ''}"></span>${esc(p.name)}${p.id === v.hostId ? ' <span class="pill">host</span>' : ''}${p.id === myId ? ' <span class="pill">you</span>' : ''}
          ${isHost && p.id !== myId ? `<button class="btn btn-quiet btn-small" data-act="remove" data-id="${p.id}">Remove</button>` : ''}</li>`).join('')}
      </ul>
      ${isHost
        ? `<button class="btn btn-primary btn-block" data-act="start" ${v.players.length < 2 ? 'disabled' : ''}>${v.players.length < 2 ? 'Waiting for players…' : `Start game with ${v.players.length}`}</button>`
        : '<p class="muted">Waiting for the host to start.</p>'}
    </div>
    <div class="card">
      <p class="eyebrow">House rules${isHost ? '' : ' · set by the host'}</p>
      ${ruleControls}
    </div>
    ${howTo(r)}`;
}

function playerRow(p, v) {
  const isTurn = v.phase === 'bidding' && v.turn === p.id;
  const last = [...v.history].reverse().find((b) => b.by === p.id);
  const dice = Array.from({ length: Math.max(p.count, 0) }, () => '<i></i>').join('');
  let state = '';
  if (p.out) state = v.rules.diceLoss === 'others' ? '<span class="pill pill-safe">safe</span>' : '<span class="pill">out</span>';
  if (!p.connected) state += '<span class="pill pill-warn">offline</span>';
  return `
    <li class="player ${isTurn ? 'turn' : ''} ${p.out ? 'is-out' : ''}">
      <span class="pname">${esc(p.name)}${p.id === myId ? ' <span class="you">(you)</span>' : ''}</span>
      <span class="cups" aria-label="${p.count} dice">${dice}</span>
      <span class="plast">${last && v.phase === 'bidding' ? bidText(last) : ''}${state}</span>
    </li>`;
}

function tableView(v) {
  const me = v.players.find((p) => p.id === myId);
  const byName = (id) => esc(v.players.find((p) => p.id === id)?.name || '?');
  const players = `<ul class="players">${v.players.map((p) => playerRow(p, v)).join('')}</ul>`;

  if (v.phase === 'reveal' || v.phase === 'over') return players + revealView(v, byName);

  const myTurn = v.turn === myId;
  const bidBox = v.bid
    ? `<div class="current"><p class="eyebrow">${byName(v.bid.by)} bids</p><p class="current-bid">${bidText(v.bid)}</p></div>`
    : `<div class="current"><p class="eyebrow">New round</p><p class="current-none">${myTurn ? 'You open' : `${byName(v.turn)} opens`}</p></div>`;

  const hand = me && !me.out
    ? `<div class="hand ${ui.covered ? 'covered' : ''}">
        <div class="hand-dice">${me.dice.map((d) => die(d)).join('')}</div>
        <button class="cover" data-act="cover" aria-label="${ui.covered ? 'Show my dice' : 'Hide my dice'}">${ui.covered ? 'Tap to look at your dice' : ''}</button>
        <button class="btn btn-quiet btn-small hide-btn" data-act="cover">${ui.covered ? 'Show' : 'Hide'}</button>
      </div>`
    : `<div class="card center muted">${me ? 'You’re out of dice. Watch the others finish.' : 'You’re watching.'}</div>`;

  let actions;
  if (myTurn) {
    const key = `${v.round}:${v.history.length}`;
    if (ui.pickKey !== key) { ui.pick = lowestBid(v); ui.pickKey = key; }
    const err = validBid(v, ui.pick);
    const maxCount = activePlayers(v).reduce((a, p) => a + p.count + 1, 0);
    actions = `
      <div class="actions card">
        <p class="eyebrow your-turn">Your turn</p>
        <div class="picker">
          <div class="stepper">
            <button class="btn step" data-act="count" data-d="-1" ${ui.pick.count <= 1 ? 'disabled' : ''} aria-label="Fewer">−</button>
            <span class="count" aria-live="polite">${ui.pick.count}</span>
            <button class="btn step" data-act="count" data-d="1" ${ui.pick.count >= maxCount ? 'disabled' : ''} aria-label="More">+</button>
          </div>
          <span class="times">×</span>
          <div class="faces">${biddableFaces(v.rules).map((f) => `<button class="face ${ui.pick.face === f ? 'on' : ''}" data-act="face" data-f="${f}" aria-label="${f}" aria-pressed="${ui.pick.face === f}">${die(f)}</button>`).join('')}</div>
        </div>
        <div class="act-row">
          <button class="btn btn-primary" data-act="bid" ${err ? 'disabled' : ''}>Bid ${ui.pick.count} × ${die(ui.pick.face, 'die-inline')}</button>
          ${v.bid ? '<button class="btn btn-snyd" data-act="snyd">Snyd!</button>' : ''}
        </div>
        ${err ? `<p class="hint">${esc(err)}</p>` : ''}
      </div>`;
  } else {
    actions = `<div class="waiting">Waiting for <b>${byName(v.turn)}</b>…</div>`;
  }
  const hist = v.history.length > 1
    ? `<div class="history">${v.history.slice(0, -1).map((b) => `<span>${byName(b.by)} ${bidText(b)}</span>`).join('')}</div>`
    : '';
  return players + bidBox + hist + hand + actions;
}

function revealView(v, byName) {
  const r = v.reveal;
  let head = '';
  if (r) {
    const loserName = byName(r.loser);
    head = `
      <div class="card reveal-head ${r.holds ? 'holds' : 'fails'}">
        <p class="eyebrow">${byName(r.caller)} called snyd on ${byName(r.bid.by)}</p>
        <p class="verdict">${r.total} × ${die(r.bid.face, 'die-inline')} on the table</p>
        <p class="verdict-sub">The bid was ${bidText(r.bid)}. It ${r.holds ? '<b>holds</b>' : '<b>fails</b>'}, so <b>${r.loser === myId ? 'you lose' : `${loserName} loses`}</b> the round.</p>
        <p class="muted">${v.rules.diceLoss === 'others' ? `Everyone except ${loserName} drops a die.` : `${loserName} drops a die.`}</p>
      </div>
      <ul class="reveal-hands">
        ${r.hands.map((h) => `
          <li><span class="pname">${byName(h.id)}${h.trappe ? ' <span class="pill pill-trappe">trappe</span>' : ''}</span>
            <span class="rdice">${h.dice.map((d, i) => die(d, h.counting[i] ? 'counts' : 'dim')).join('')}</span>
            <span class="rval">${h.value}</span></li>`).join('')}
      </ul>`;
  }
  if (v.phase === 'over') {
    const res = v.result || {};
    const isHost = v.hostId === myId;
    let line = 'Game over.';
    if (res.loser) line = res.loser === myId ? 'You’re the last one with dice. Your round!' : `${byName(res.loser)} is the last one with dice and buys the round.`;
    if (res.winner) line = res.winner === myId ? 'You’re the last one with dice. You win!' : `${byName(res.winner)} is the last one with dice and wins.`;
    return `${head}
      <div class="card gameover">
        <p class="eyebrow">Game over</p>
        <p class="final">${line}</p>
        ${isHost ? '<div class="act-row"><button class="btn btn-primary" data-act="start">Play again</button><button class="btn" data-act="lobby">Change rules</button></div>' : '<p class="muted">The host can start a new game.</p>'}
      </div>`;
  }
  return `${head}<button class="btn btn-primary btn-block" data-act="next">Next round</button>`;
}

// ---------- events ----------
function wire() {
  app.querySelectorAll('[data-act]').forEach((el) => el.addEventListener('click', (e) => {
    e.preventDefault();
    const a = el.dataset.act;
    const v = session?.view;
    switch (a) {
      case 'leave':
        if (ui.leaveArmed) { ui.leaveArmed = false; leave(); return; }
        ui.leaveArmed = true;
        setTimeout(() => { ui.leaveArmed = false; if (session) render(); }, 3000);
        render();
        return;
      case 'share': {
        const url = joinUrl(session.code);
        if (navigator.share) navigator.share({ title: 'Snyd', text: `Join my Snyd table: ${session.code}`, url }).catch(() => {});
        else navigator.clipboard?.writeText(url).then(() => toast('Link copied.'), () => toast(url));
        return;
      }
      case 'start': act({ type: 'start' }); return;
      case 'lobby': act({ type: 'lobby' }); return;
      case 'remove': act({ type: 'remove', id: el.dataset.id }); return;
      case 'next': act({ type: 'next' }); return;
      case 'snyd': act({ type: 'snyd' }); return;
      case 'bid': act({ type: 'bid', count: ui.pick.count, face: ui.pick.face }); return;
      case 'cover': ui.covered = !ui.covered; store.set('snyd.covered', ui.covered); render(); return;
      case 'count': ui.pick = { ...ui.pick, count: Math.max(1, ui.pick.count + Number(el.dataset.d)) }; render(); return;
      case 'face': ui.pick = { ...ui.pick, face: Number(el.dataset.f) }; render(); return;
      default: if (v) render();
    }
  }));
  app.querySelectorAll('[data-rule]').forEach((el) => el.addEventListener('click', (e) => {
    e.preventDefault();
    const k = el.dataset.rule;
    let val = el.dataset.value;
    if (typeof DEFAULT_RULES[k] === 'boolean') val = val === 'true';
    else if (typeof DEFAULT_RULES[k] === 'number') val = Number(val);
    act({ type: 'rules', rules: { [k]: val } });
  }));
}

function drawQr(el, text) {
  if (typeof window.qrcode !== 'function') { el.hidden = true; return; }
  try {
    const qr = window.qrcode(0, 'M');
    qr.addData(text);
    qr.make();
    el.innerHTML = qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
  } catch { el.hidden = true; }
}

// ---------- boot ----------
const saved = store.get('snyd.session', null, 'session');
if (saved?.role === 'host' && store.get(`snyd.host.${saved.code}`, null)) {
  startHosting(store.get('snyd.name', 'Host'), saved.code, store.get(`snyd.host.${saved.code}`, null));
} else if (saved?.role === 'client') {
  startJoining(store.get('snyd.name', 'Player'), saved.code);
} else {
  render();
}

if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
