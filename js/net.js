// Phone-to-phone networking with PeerJS (WebRTC). The host's browser runs the game;
// everyone else sends actions to it and receives their own view of the state back.
/* global Peer */

const PREFIX = 'snyd-dk-v1-';
const PING_MS = 4000;
const STALE_MS = 13000;

export const peerIdFor = (code) => PREFIX + code.toUpperCase();

/**
 * Opens a room as host. Handlers:
 *   onAction(playerId, action)      a remote player did something
 *   onPresence(playerId, connected) a remote player connected or dropped
 *   onStatus(text, ok)              connection status for the host's own screen
 * Returns { send(playerId, msg), close() } once the room is open.
 */
export function hostRoom(code, { onAction, onHello, onPresence, onStatus, reclaim = false }) {
  return new Promise((resolve, reject) => {
    const conns = new Map(); // playerId -> { conn, lastSeen }
    let peer = null;
    let closed = false;
    let attempts = 0;
    let settled = false;
    let timer = null;

    const send = (pid, msg) => {
      const c = conns.get(pid);
      if (c && c.conn.open) { try { c.conn.send(msg); } catch { /* dropped */ } }
    };

    const watch = () => {
      timer = setInterval(() => {
        const now = Date.now();
        for (const [pid, c] of conns) {
          if (now - c.lastSeen > STALE_MS) { conns.delete(pid); try { c.conn.close(); } catch { /* ignore */ } onPresence(pid, false); }
        }
      }, 3000);
    };

    const open = () => {
      peer = new Peer(peerIdFor(code), { debug: 1 });
      peer.on('open', () => {
        attempts = 0;
        onStatus('Table open', true);
        if (!settled) { settled = true; watch(); resolve({ send, close, playerIds: () => [...conns.keys()] }); }
      });
      peer.on('connection', (conn) => {
        let pid = null;
        conn.on('data', (msg) => {
          if (!msg || typeof msg !== 'object') return;
          if (msg.t === 'hello') {
            pid = String(msg.id);
            const old = conns.get(pid);
            if (old && old.conn !== conn) { try { old.conn.close(); } catch { /* ignore */ } }
            conns.set(pid, { conn, lastSeen: Date.now() });
            onHello(pid, msg.name);
            return;
          }
          if (!pid) return;
          const c = conns.get(pid);
          if (c) c.lastSeen = Date.now();
          if (msg.t === 'ping') send(pid, { t: 'pong' });
          else if (msg.t === 'act') onAction(pid, msg.action);
        });
        conn.on('close', () => {
          if (pid && conns.get(pid)?.conn === conn) { conns.delete(pid); onPresence(pid, false); }
        });
        conn.on('error', () => {});
      });
      peer.on('disconnected', () => {
        // Lost the signalling server; existing player connections keep working.
        onStatus('Reconnecting to lobby server…', false);
        if (!closed) setTimeout(() => { if (!closed && peer && !peer.destroyed) peer.reconnect(); }, 1500);
      });
      peer.on('error', (err) => {
        if (err.type === 'unavailable-id') {
          if (!reclaim && !settled) { closed = true; peer.destroy(); reject(new Error('code-taken')); return; }
          // Our old session still holds the id (e.g. after a reload); it is released within a minute.
          attempts++;
          onStatus('Getting the table back… this can take up to a minute', false);
          peer.destroy();
          if (!closed && attempts < 40) setTimeout(open, 3000);
          else if (!settled) reject(new Error('Could not reopen the table.'));
          return;
        }
        if (err.type === 'network' || err.type === 'server-error' || err.type === 'socket-error' || err.type === 'socket-closed') {
          onStatus('No connection to the lobby server. Retrying…', false);
          if (!settled) {
            peer.destroy();
            if (!closed && attempts++ < 20) setTimeout(open, 3000); else reject(new Error('No internet connection?'));
          }
          return;
        }
        if (err.type === 'browser-incompatible') { reject(new Error('This browser can’t do WebRTC.')); return; }
        console.warn('peer error', err.type, err);
      });
    };

    const close = () => {
      closed = true;
      clearInterval(timer);
      for (const c of conns.values()) { try { c.conn.close(); } catch { /* ignore */ } }
      conns.clear();
      try { peer?.destroy(); } catch { /* ignore */ }
    };

    open();
  });
}

/**
 * Joins a room. Handlers: onMessage(msg), onStatus(text, ok).
 * Keeps reconnecting until close() is called. Returns { act(action), close() }.
 */
export function joinRoom(code, { id, name, onMessage, onStatus }) {
  let peer = null;
  let conn = null;
  let closed = false;
  let pingTimer = null;
  let lastPong = Date.now();
  let retryTimer = null;

  const scheduleRetry = (ms = 2000) => {
    if (closed) return;
    clearTimeout(retryTimer);
    retryTimer = setTimeout(connect, ms);
  };

  const connect = () => {
    if (closed) return;
    if (!peer || peer.destroyed) {
      peer = new Peer({ debug: 1 });
      peer.on('open', () => connect());
      peer.on('disconnected', () => { if (!closed && !peer.destroyed) setTimeout(() => peer.reconnect(), 1500); });
      peer.on('error', (err) => {
        if (err.type === 'peer-unavailable') { onStatus('Can’t find the table. Is the host’s phone awake?', false); scheduleRetry(3000); return; }
        if (['network', 'server-error', 'socket-error', 'socket-closed'].includes(err.type)) {
          onStatus('No connection. Retrying…', false);
          try { peer.destroy(); } catch { /* ignore */ }
          scheduleRetry(3000);
          return;
        }
        console.warn('peer error', err.type, err);
      });
      return;
    }
    if (!peer.open) return; // waits for 'open'
    if (conn && conn.open) return;
    onStatus('Connecting to the table…', false);
    conn = peer.connect(peerIdFor(code), { reliable: true });
    const c = conn;
    c.on('open', () => {
      lastPong = Date.now();
      c.send({ t: 'hello', id, name });
      onStatus('Connected', true);
    });
    c.on('data', (msg) => {
      lastPong = Date.now();
      if (msg && msg.t !== 'pong') onMessage(msg);
    });
    c.on('close', () => { if (c === conn) { onStatus('Lost the table. Reconnecting…', false); scheduleRetry(1500); } });
    c.on('error', () => { if (c === conn) scheduleRetry(2000); });
    // If the connection never opens, try again.
    setTimeout(() => { if (c === conn && !c.open && !closed) { try { c.close(); } catch { /* ignore */ } scheduleRetry(0); } }, 9000);
  };

  pingTimer = setInterval(() => {
    if (conn && conn.open) {
      try { conn.send({ t: 'ping' }); } catch { /* ignore */ }
      if (Date.now() - lastPong > STALE_MS) { onStatus('Lost the table. Reconnecting…', false); try { conn.close(); } catch { /* ignore */ } conn = null; scheduleRetry(0); }
    }
  }, PING_MS);

  const onVisible = () => { if (document.visibilityState === 'visible' && !(conn && conn.open)) scheduleRetry(0); };
  document.addEventListener('visibilitychange', onVisible);

  connect();
  return {
    act(action) {
      if (conn && conn.open) { conn.send({ t: 'act', action }); return true; }
      return false;
    },
    close() {
      closed = true;
      clearInterval(pingTimer);
      clearTimeout(retryTimer);
      document.removeEventListener('visibilitychange', onVisible);
      try { conn?.close(); } catch { /* ignore */ }
      try { peer?.destroy(); } catch { /* ignore */ }
    },
  };
}
