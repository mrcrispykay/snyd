// Helpers shared by the computer players.

/** n choose k */
function choose(n, k) {
  if (k < 0 || k > n) return 0;
  let r = 1;
  for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i;
  return r;
}

/** P(X >= k) for X ~ Binomial(n, p). */
export function atLeast(k, n, p) {
  if (k <= 0) return 1;
  if (k > n) return 0;
  let s = 0;
  for (let i = k; i <= n; i++) s += choose(n, i) * p ** i * (1 - p) ** (n - i);
  return s;
}

/**
 * A stable pseudo-random number in [0, 1) for a given key. Bots use it for decisions that are
 * re-checked several times while the state stays the same (e.g. "do I call this play?"),
 * so the answer doesn't change each time it's asked.
 */
export function chance(key) {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 16777619); }
  return ((h >>> 0) % 100000) / 100000;
}

export const pick = (arr, rand) => arr[Math.floor(rand() * arr.length)];
