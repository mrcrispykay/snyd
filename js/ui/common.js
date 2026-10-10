// Shared rendering helpers for the game screens.

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const PIPS = {
  1: [[50, 50]],
  2: [[29, 29], [71, 71]],
  3: [[27, 27], [50, 50], [73, 73]],
  4: [[29, 29], [71, 29], [29, 71], [71, 71]],
  5: [[27, 27], [73, 27], [50, 50], [27, 73], [73, 73]],
  6: [[29, 25], [71, 25], [29, 50], [71, 50], [29, 75], [71, 75]],
};

/** An SVG die. 0 or null draws a hidden die. */
export function die(v, cls = '') {
  if (!v) return `<span class="die die-hidden ${cls}" aria-label="hidden die"></span>`;
  const pips = PIPS[v].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="${v === 1 ? 13 : 9.5}"/>`).join('');
  return `<svg class="die ${v === 1 ? 'die-one' : ''} ${cls}" viewBox="0 0 100 100" role="img" aria-label="${v}"><rect x="3" y="3" width="94" height="94" rx="20"/>${pips}</svg>`;
}

export const dice = (list, cls = '') => list.map((d) => die(d, cls)).join('');

export function vibrate(ms = 70) {
  try { navigator.vibrate?.(ms); } catch { /* not supported */ }
}
