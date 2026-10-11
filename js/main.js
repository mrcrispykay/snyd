// Bodega: screens and wiring. One phone hosts the table (runs the engines), the others join.
import { newTable, applyTable, viewTable, botMove, hasBots, GAMES, CATEGORIES, gameById } from './table.js';
import { hostRoom, joinRoom } from './net.js';
import {
  t, num, LANGS, getLang, setLang, gameName, gameTagline, otherNames, rulesText, kongensKopDefault,
} from './i18n/index.js';
import { esc, die, card, vibrate } from './ui/common.js';
import * as snydUi from './ui/snyd.js';
import * as meyerUi from './ui/meyer.js';
import * as tiotusindUi from './ui/tiotusind.js';
import * as hestelobUi from './ui/hestelob.js';
import * as kongensKopUi from './ui/kongens-kop.js';
import * as mestUi from './ui/mest-sandsynligt.js';
import * as aldrigUi from './ui/jeg-har-aldrig.js';
import * as skibUi from './ui/skib.js';
import * as grisUi from './ui/gris.js';
import * as yatzyUi from './ui/yatzy.js';
import * as bussenUi from './ui/bussen.js';
import * as snydKortUi from './ui/snyd-kort.js';
import * as sjavsUi from './ui/sjavs.js';

const UIS = {
  snyd: snydUi, meyer: meyerUi, 10000: tiotusindUi, hestelob: hestelobUi, 'kongens-kop': kongensKopUi,
  'mest-sandsynligt': mestUi, 'jeg-har-aldrig': aldrigUi, skib: skibUi, gris: grisUi, yatzy: yatzyUi,
  bussen: bussenUi, 'snyd-kort': snydKortUi, sjavs: sjavsUi,
};
const GLYPH = {
  snyd: () => [1, 4, 4].map((d) => die(d)).join(''),
  meyer: () => [2, 1].map((d) => die(d)).join(''),
  10000: () => [1, 5, 5].map((d) => die(d)).join(''),
  yatzy: () => [6, 6, 6].map((d) => die(d)).join(''),
  skib: () => [6, 5, 4].map((d) => die(d)).join(''),
  gris: () => `${die(1)}<span class="bubble">100</span>`,
  hestelob: () => card({ r: 1, s: 'H' }, 'mini') + card({ r: 1, s: 'S' }, 'mini'),
  'kongens-kop': () => card({ r: 13, s: 'D' }, 'mini') + card({ r: 13, s: 'C' }, 'mini'),
  bussen: () => card({ r: 7, s: 'H' }, 'mini') + card({ r: 7, s: 'S' }, 'mini'),
  'snyd-kort': () => card(null, 'mini') + card(null, 'mini'),
  sjavs: () => card({ r: 12, s: 'C' }, 'mini') + card({ r: 11, s: 'D' }, 'mini'),
  'mest-sandsynligt': () => `<span class="bubble">${t('who?')}</span>`,
  'jeg-har-aldrig': () => `<span class="bubble">${t('never')}</span>`,
};

const app = document.getElementById('app');
document.documentElement.lang = getLang();

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

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const newCode = () => Array.from({ length: 4 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
const joinUrl = (code) => `${location.origin}${location.pathname}?r=${code}`;

// ---------- session ----------
let session = null; // { role, code, view, status, ok, net }
let table = null; // host only: the full table state
const ui = { covered: store.get('snyd.covered', false), leaveArmed: false, toast: '', toastTimer: null, games: {}, sheet: null };

/** Shows a message. `msg` is an English key; params fill its {placeholders}. */
function toast(msg, params) {
  ui.toast = t(msg, params);
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

// ---------- actions ----------
function act(action) {
  if (!session) return;
  if (session.role === 'host') hostDispatch(myId, action);
  else if (!session.net?.act(action)) toast('Not connected to the table right now.');
}

function hostDispatch(pid, action) {
  try {
    table = applyTable(table, pid, action);
  } catch (e) {
    if (pid === myId) toast(e.message, e.params);
    else if (pid.startsWith('bot-')) { console.warn('Computer player move refused:', e.message, action); botStuckAt = table.version; }
    else session.net?.send(pid, { t: 'error', msg: e.message, params: e.params });
    return;
  }
  store.set(`snyd.table.${table.code}`, table);
  broadcast();
}

function broadcast() {
  for (const p of table.players) if (p.id !== myId && !p.bot) session.net?.send(p.id, { t: 'state', view: viewTable(table, p.id) });
  receive(viewTable(table, myId));
  scheduleBots();
}

// Computer players run on the host. After every change, the next bot move (if any) is played
// after a short, human-looking pause. A refused move parks the bots until the state changes.
let botTimer = null;
let botStuckAt = -1;
function scheduleBots() {
  if (session?.role !== 'host' || !table || botTimer || botStuckAt === table.version) return;
  const next = botMove(table);
  if (!next) return;
  // Small steps (holding a die, peeking under the cup) go quicker than real decisions.
  const quick = ['hold', 'look'].includes(next.action.action?.type);
  botTimer = setTimeout(() => {
    botTimer = null;
    if (session?.role !== 'host' || !table) return;
    const m = botMove(table);
    if (m) hostDispatch(m.id, m.action);
  }, quick ? 300 + Math.random() * 250 : 800 + Math.random() * 900);
}

function receive(view) {
  const prev = session.view;
  session.view = view;
  const U = UIS[view.gameId];
  if (view.game && U?.isMyTurn(view.game, myId) && !(prev?.game && prev.gameId === view.gameId && U.isMyTurn(prev.game, myId))) vibrate();
  render();
}

// ---------- hosting / joining ----------
async function startHosting(name, code = null, saved = null) {
  store.set('snyd.name', name);
  // Resuming a saved table: take back the host's seat even if this tab's id was lost.
  if (saved && saved.hostId !== myId) { myId = saved.hostId; store.set('snyd.id', myId, 'session'); }
  let attempt = 0;
  for (;;) {
    const c = code || newCode();
    table = saved || newTable({ code: c, hostId: myId });
    if (!saved) table = applyTable(table, myId, { type: 'join', name });
    session = { role: 'host', code: c, view: viewTable(table, myId), status: 'Opening the table…', ok: false, net: null };
    render();
    try {
      session.net = await hostRoom(c, {
        reclaim: !!saved,
        onHello: (pid, pname) => hostDispatch(pid, { type: 'join', name: pname }),
        onAction: (pid, action) => hostDispatch(pid, action),
        onPresence: (pid, on) => { if (table.players.some((p) => p.id === pid)) hostDispatch(pid, { type: 'connected', value: on }); },
        onStatus: setStatus,
      });
      store.set('snyd.session', { role: 'host', code: c }, 'session');
      store.set(`snyd.table.${c}`, table);
      broadcast();
      keepAwake();
      return;
    } catch (e) {
      if (e.message === 'code-taken' && attempt++ < 5 && !code) continue;
      session = null;
      toast(e.message === 'code-taken' ? 'That table code is in use. Try again.' : e.message);
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
      if (msg.t === 'error') toast(msg.msg, msg.params);
    },
  });
  keepAwake();
  render();
}

function leave() {
  if (session?.role === 'host' && table) store.del(`snyd.table.${table.code}`);
  session?.net?.close();
  session = null;
  table = null;
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
  if (session?.role === 'host' && table && table.players.length > 1) { e.preventDefault(); e.returnValue = ''; }
});
window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && ui.sheet) { ui.sheet = null; render(); } });

// ---------- screens ----------
function render() {
  if (!session) renderHome();
  else renderTable();
  if (ui.sheet) {
    app.insertAdjacentHTML('beforeend', rulesSheet(ui.sheet.gameId, ui.sheet.rules));
    wireSheet();
  }
}

const toastHtml = () => (ui.toast ? `<div class="toast" role="status">${esc(ui.toast)}</div>` : '');
const glyph = (gameId) => `<span class="glyph">${GLYPH[gameId] ? GLYPH[gameId]() : ''}</span>`;
const players = (g) => (g.minPlayers === g.maxPlayers ? t('{n} players', { n: g.minPlayers }) : t('{a}–{b} players', { a: g.minPlayers, b: g.maxPlayers }));

/** Games grouped by category, in menu order. */
const grouped = () => CATEGORIES.map(([cat, label]) => [t(label), GAMES.filter((g) => g.category === cat)]).filter(([, gs]) => gs.length);

function langPicker() {
  return `<label class="lang"><span class="sr-only">${t('Language')}</span><select id="lang" aria-label="${t('Language')}">${LANGS.map((l) => `<option value="${l.code}" ${l.code === getLang() ? 'selected' : ''}>${l.label}</option>`).join('')}</select></label>`;
}

/** The rules sheet: goal, how it goes, how it ends, and the house rules in play. */
function rulesSheet(gameId, rules) {
  const G = gameById[gameId];
  const r = { ...G.defaults, ...rules };
  const helpers = { die: (v) => die(v, 'die-inline'), card: (c) => card(c, 'mini'), n: num };
  const txt = rulesText(gameId, r, helpers);
  const aka = otherNames(gameId);
  return `
    <div class="sheet-backdrop" data-sheet="close"></div>
    <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title">
      <header class="sheet-head">
        <span class="glyph">${GLYPH[gameId] ? GLYPH[gameId]() : ''}</span>
        <div><h2 id="sheet-title">${gameName(gameId)}</h2>${aka.length ? `<p class="aka">${t('Also called')} ${aka.map((a) => `<b>${esc(a.name)}</b> <small>(${a.lang})</small>`).join(', ')}</p>` : ''}</div>
        <button class="btn btn-quiet btn-small sheet-close" data-sheet="close" aria-label="${t('Close')}">✕</button>
      </header>
      <p class="sheet-meta">${players(G)} · ${UIS[gameId].rulesSummary(r)}</p>
      ${txt ? `
        <h3>${t('Goal')}</h3><p>${txt.goal}</p>
        <h3>${t('How it goes')}</h3><ol>${txt.steps.filter(Boolean).map((s) => `<li>${s}</li>`).join('')}</ol>
        <h3>${t('The end')}</h3><p>${txt.end}</p>` : ''}
      <button class="btn btn-primary btn-block" data-sheet="close">${t('Got it')}</button>
    </div>`;
}

function wireSheet() {
  app.querySelectorAll('[data-sheet="close"]').forEach((el) => el.addEventListener('click', (e) => { e.preventDefault(); ui.sheet = null; render(); }));
}

const openRules = (gameId, rules) => { ui.sheet = { gameId, rules: rules || {} }; render(); };

function renderHome() {
  const params = new URLSearchParams(location.search);
  const code = (params.get('r') || '').toUpperCase();
  const name = store.get('snyd.name', '');
  app.innerHTML = `
    <section class="home">
      <header class="brand">
        <div class="brand-row"><div class="brand-dice">${die(1)}${die(6)}${die(3)}</div>${langPicker()}</div>
        <h1>Bodega</h1>
        <p class="tag">${t('Danish bar games for the whole table. Everyone plays on their own phone.')}</p>
      </header>
      <form id="home-form" class="card form" autocomplete="off">
        <label for="name">${t('Your name')}</label>
        <input id="name" name="name" maxlength="20" placeholder="${t('e.g. Kasper')}" value="${esc(name)}" required>
        ${code ? `
          <p class="joining">${t('Joining table')} <b class="code">${esc(code)}</b></p>
          <button class="btn btn-primary" data-do="join">${t('Join table')}</button>
          <button class="btn btn-quiet" type="button" data-do="host">${t('Start a new table instead')}</button>
        ` : `
          <button class="btn btn-primary" data-do="host">${t('Start a table')}</button>
          <div class="or"><span>${t('or join one')}</span></div>
          <label for="code">${t('Table code')}</label>
          <div class="row">
            <input id="code" name="code" maxlength="4" placeholder="ABCD" autocapitalize="characters" inputmode="text" class="code-input">
            <button class="btn" data-do="join">${t('Join')}</button>
          </div>
        `}
      </form>
      <div class="card">
        <p class="eyebrow">${t('On the menu')} · <span class="muted">${t('tap a game for its rules')}</span></p>
        ${grouped().map(([label, gs]) => `<p class="menu-cat">${label}</p><ul class="menu-list">${gs.map((g) => `<li><button class="menu-item" data-rules="${g.id}">${glyph(g.id)}<span><b>${gameName(g.id)}</b><small>${gameTagline(g.id)}</small></span><span class="info">?</span></button></li>`).join('')}</ul>`).join('')}
      </div>
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
  app.querySelectorAll('[data-rules]').forEach((b) => b.addEventListener('click', () => openRules(b.dataset.rules)));
  wireLang();
}

function wireLang() {
  const sel = app.querySelector('#lang');
  if (sel) sel.addEventListener('change', () => { setLang(sel.value); render(); });
}

function statusBar(v) {
  const playing = v && v.phase === 'playing';
  return `
    <header class="topbar">
      <span class="code-chip" aria-label="${t('Table code')}">${esc(session.code)}</span>
      <span class="status ${session.ok ? 'ok' : 'bad'}"><i></i>${esc(t(session.status || ''))}</span>
      ${playing ? `<button class="btn btn-quiet btn-small" data-act="rules">${t('Rules')}</button>` : ''}
      ${langPicker()}
      <button class="btn btn-quiet btn-small" data-act="leave">${ui.leaveArmed ? t('Tap again to leave') : t('Leave')}</button>
    </header>
    ${playing ? `<p class="game-title">${gameName(v.gameId)}</p>` : ''}`;
}

function ctxFor(v) {
  const names = Object.fromEntries(v.players.map((p) => [p.id, p.name]));
  const conn = Object.fromEntries(v.players.map((p) => [p.id, p.connected]));
  ui.games[v.gameId] = ui.games[v.gameId] || {};
  const isHost = v.hostId === myId;
  return {
    me: myId,
    isHost,
    ui: ui.games[v.gameId],
    covered: ui.covered,
    name: (id) => esc(names[id] ?? t('Someone who left')),
    connected: (id) => conn[id] !== false,
    gameOver: (line) => `
      <div class="card gameover">
        <p class="eyebrow">${t('Game over')}</p>
        <p class="final">${line}</p>
        ${isHost ? `<div class="act-row"><button class="btn btn-primary" data-act="start">${t('Play again')}</button><button class="btn" data-act="lobby">${t('Back to the menu')}</button></div>` : `<p class="muted">${t('The host picks what’s next.')}</p>`}
      </div>`,
  };
}

function renderTable() {
  // Keep typing intact when an update arrives while a text field is focused.
  const focused = document.activeElement?.id?.startsWith('rule-') ? { id: document.activeElement.id, value: document.activeElement.value, pos: document.activeElement.selectionStart } : null;
  const v = session.view;
  let body = '';
  if (!v) body = `<div class="card center"><p>${esc(t(session.status))}</p><p class="muted">${t('Table')} ${esc(session.code)}</p></div>`;
  else if (v.phase === 'lobby') body = lobby(v);
  else {
    const U = UIS[v.gameId];
    const watching = !v.seated.includes(myId);
    body = (watching ? `<div class="event">${t('You’re watching this game. You’ll be dealt in next time.')}</div>` : '')
      + U.render(v.game, ctxFor(v))
      + (v.hostId === myId && v.game.phase !== 'over' ? `<details class="hostmenu"><summary>${t('Host')}</summary><button class="btn btn-small" data-act="lobby">${t('Stop the game and go back to the menu')}</button></details>` : '');
  }
  app.innerHTML = `<section class="tablepage">${statusBar(v)}${body}${toastHtml()}</section>`;
  wire();
  if (focused) {
    const el = document.getElementById(focused.id);
    if (el) { el.value = focused.value; el.focus(); try { el.setSelectionRange(focused.pos, focused.pos); } catch { /* ignore */ } }
  }
  const qr = app.querySelector('#qr');
  if (qr) drawQr(qr, joinUrl(session.code));
}

/** Text shown in a house-rule text field: untouched Kongens kop defaults show in this phone's language. */
function ruleTextValue(gameId, k, val) {
  if (gameId === 'kongens-kop' && val === gameById[gameId].defaults[k]) return kongensKopDefault(k);
  return val;
}

function ruleControls(v, isHost) {
  const G = gameById[v.gameId];
  const r = v.rules[v.gameId];
  return Object.entries(G.ruleInfo).map(([k, info]) => {
    const val = r[k];
    const label = t(info.label);
    const help = info.help ? `<small>${t(info.help, info.helpParams)}</small>` : '';
    let ctrl;
    if (info.text) {
      const shown = ruleTextValue(v.gameId, k, val);
      ctrl = info.multiline
        ? `<textarea class="rule-text" id="rule-${k}" data-rule-text="${k}" rows="4" ${isHost ? '' : 'readonly'}>${esc(shown)}</textarea>`
        : `<input class="rule-text" id="rule-${k}" data-rule-text="${k}" value="${esc(shown)}" ${isHost ? '' : 'readonly'}>`;
      return `<div class="rule rule-stack"><div><b>${label}</b>${help}</div>${ctrl}</div>`;
    }
    if (typeof G.defaults[k] === 'boolean') {
      ctrl = `<button class="switch" role="switch" aria-checked="${val}" aria-label="${esc(label)}" data-rule="${k}" data-value="${!val}" ${isHost ? '' : 'disabled'}><span></span></button>`;
    } else {
      const opts = info.options.map((o) => (Array.isArray(o) ? [o[0], t(o[1])] : [o, typeof o === 'number' && o >= 1000 ? num(o) : String(o)]));
      const wide = opts.some(([, l]) => l.length > 8);
      ctrl = `<div class="seg ${wide ? 'seg-wide' : ''}">${opts.map(([ov, ol]) => `<button data-rule="${k}" data-value="${ov}" aria-pressed="${String(val) === String(ov)}" ${isHost ? '' : 'disabled'}>${esc(ol)}</button>`).join('')}</div>`;
    }
    return `<div class="rule ${typeof G.defaults[k] === 'boolean' ? '' : 'rule-stack'}"><div><b>${label}</b>${help}</div>${ctrl}</div>`;
  }).join('');
}

function lobby(v) {
  const isHost = v.hostId === myId;
  const G = gameById[v.gameId];
  const U = UIS[v.gameId];
  const r = v.rules[v.gameId];
  const botsPlay = hasBots(v.gameId);
  const n = v.players.filter((p) => botsPlay || !p.bot).length;
  const hasBotSeats = v.players.some((p) => p.bot);
  const tooFew = n < G.minPlayers;
  const gname = gameName(v.gameId);
  return `
    <div class="card invite">
      <div class="invite-text">
        <p class="eyebrow">${t('Table code')}</p>
        <p class="big-code">${esc(session.code)}</p>
        <p class="muted">${t('Friends scan the code, or open the site and type the table code.')}</p>
        <div class="row"><button class="btn btn-small" data-act="share">${t('Share link')}</button></div>
      </div>
      <div id="qr" class="qr" aria-label="${t('QR code with the join link')}"></div>
    </div>
    <div class="card">
      <p class="eyebrow">${t('At the table')} · ${v.players.length}</p>
      <ul class="lobby-players">
        ${v.players.map((p) => `<li><span class="dot ${p.connected ? 'on' : ''}"></span>${esc(p.name)}${p.id === v.hostId ? ` <span class="pill">${t('host')}</span>` : ''}${p.id === myId ? ` <span class="pill">${t('you')}</span>` : ''}${p.bot ? ` <span class="pill pill-bot">${t('computer')}</span>` : ''}
          ${isHost && p.id !== myId ? `<button class="btn btn-quiet btn-small" data-act="remove" data-id="${p.id}">${t('Remove')}</button>` : ''}</li>`).join('')}
      </ul>
      ${isHost ? `<button class="btn btn-small" data-act="addBot">+ ${t('Add computer player')}</button>` : ''}
      ${hasBotSeats && !botsPlay ? `<p class="muted">${t('Computer players sit out {game}.', { gameId: v.gameId })}</p>` : ''}
    </div>
    <div class="card">
      <p class="eyebrow">${isHost ? t('Pick a game') : t('The host is picking a game')}</p>
      <div class="games" role="radiogroup" aria-label="${t('Game')}">
        ${grouped().map(([label, gs]) => `<p class="menu-cat">${label}</p>` + gs.map((g) => `
          <button class="game ${g.id === v.gameId ? 'on' : ''}" role="radio" aria-checked="${g.id === v.gameId}" data-act="pick" data-id="${g.id}" ${isHost ? '' : 'disabled'}>
            ${glyph(g.id)}<span><b>${gameName(g.id)}</b><small>${gameTagline(g.id)}</small></span><span class="players-range">${players(g)}</span>
          </button>`).join('')).join('')}
      </div>
      <button class="btn btn-block" data-act="rules">${t('How to play {game}', { gameId: v.gameId })}</button>
      ${isHost
        ? `<button class="btn btn-primary btn-block" data-act="start" ${tooFew ? 'disabled' : ''}>${tooFew ? t('{game} needs {n}+ players', { gameId: v.gameId, n: G.minPlayers }) : t('Start {game}', { gameId: v.gameId })}</button>`
        : `<p class="muted">${t('Next up:')} <b>${gname}</b> · ${U.rulesSummary(r)}</p>`}
    </div>
    <div class="card">
      <p class="eyebrow">${isHost ? t('House rules for {game}', { gameId: v.gameId }) : t('House rules for {game} · set by the host', { gameId: v.gameId })}</p>
      ${ruleControls(v, isHost)}
    </div>
    <div class="lang-row">${langPicker()}</div>`;
}

// ---------- events ----------
function wire() {
  wireLang();
  app.querySelectorAll('[data-act]').forEach((el) => el.addEventListener('click', (e) => {
    e.preventDefault();
    const v = session?.view;
    switch (el.dataset.act) {
      case 'leave':
        if (ui.leaveArmed) { ui.leaveArmed = false; leave(); return; }
        ui.leaveArmed = true;
        setTimeout(() => { ui.leaveArmed = false; if (session) render(); }, 3000);
        render();
        return;
      case 'share': {
        const url = joinUrl(session.code);
        if (navigator.share) navigator.share({ title: 'Bodega', text: t('Join my table: {code}', { code: session.code }), url }).catch(() => {});
        else navigator.clipboard?.writeText(url).then(() => toast('Link copied.'), () => { ui.toast = url; render(); });
        return;
      }
      case 'rules': if (v) openRules(v.gameId, v.game?.rules || v.rules[v.gameId]); return;
      case 'pick': act({ type: 'pick', gameId: el.dataset.id }); return;
      case 'start': act({ type: 'start' }); return;
      case 'lobby': act({ type: 'lobby' }); return;
      case 'remove': act({ type: 'remove', id: el.dataset.id }); return;
      case 'addBot': act({ type: 'addBot' }); return;
      case 'cover': ui.covered = !ui.covered; store.set('snyd.covered', ui.covered); render(); return;
      default:
    }
  }));
  app.querySelectorAll('[data-g]').forEach((el) => el.addEventListener('click', (e) => {
    e.preventDefault();
    const v = session?.view;
    if (!v?.game) return;
    const action = UIS[v.gameId].handle(el, v.game, ctxFor(v));
    if (action) act({ type: 'play', action });
    else render();
  }));
  app.querySelectorAll('[data-rule-text]').forEach((el) => el.addEventListener('change', () => {
    const v = session.view;
    const k = el.dataset.ruleText;
    // Typing the translated default back in keeps the shared default (so each phone translates it).
    const def = gameById[v.gameId].defaults[k];
    const value = v.gameId === 'kongens-kop' && el.value === kongensKopDefault(k) ? def : el.value;
    act({ type: 'rules', rules: { [k]: value } });
  }));
  app.querySelectorAll('[data-rule]').forEach((el) => el.addEventListener('click', (e) => {
    e.preventDefault();
    const v = session.view;
    const G = gameById[v.gameId];
    const k = el.dataset.rule;
    let val = el.dataset.value;
    if (typeof G.defaults[k] === 'boolean') val = val === 'true';
    else if (typeof G.defaults[k] === 'number') val = Number(val);
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
if (saved?.role === 'host' && store.get(`snyd.table.${saved.code}`, null)) {
  startHosting(store.get('snyd.name', 'Host'), saved.code, store.get(`snyd.table.${saved.code}`, null));
} else if (saved?.role === 'client') {
  startJoining(store.get('snyd.name', 'Player'), saved.code);
} else {
  render();
}

if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
