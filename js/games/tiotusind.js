// 10.000 (Grådig / Greedy): roll five dice, keep scoring dice, roll on or bank. A roll that scores nothing
// loses the turn's points. First to the target triggers one last turn for everyone else.

export const id = '10000';
export const name = '10.000';
export const category = 'dice';
export const tagline = 'Push your luck with five dice. Stop in time or lose it all.';
export const minPlayers = 1;
export const maxPlayers = 10;

export const defaults = {
  target: 10000,
  openingMin: 400, // points needed in a single turn to get on the board
  straights: true, // 1-2-3-4-5 or 2-3-4-5-6 in one roll: 2000
  fullHouse: true, // three of a kind + a pair in one roll: 2500
  hotDice: true, // when all five dice have scored, roll all five again
};

export const ruleInfo = {
  target: { label: 'Play to', options: [3000, 5000, 10000] },
  openingMin: { label: 'Points to get on the board', options: [0, 350, 400, 500, 1000] },
  straights: { label: 'Straights score 2000', help: '1-2-3-4-5 or 2-3-4-5-6 in one roll.' },
  fullHouse: { label: 'Full house scores 2500', help: 'Three of a kind and a pair in one roll.' },
  hotDice: { label: 'Hot dice', help: 'When all five dice have scored, you may roll all five again.' },
};

export const SCORE_TABLE = [
  ['Single 1', 100], ['Single 5', 50], ['Three 1s', 1000], ['Three 2s', 200], ['Three 3s', 300],
  ['Three 4s', 400], ['Three 5s', 500], ['Three 6s', 600], ['Four of a kind', 1500], ['Five of a kind', 2000],
];

const counts = (dice) => { const c = [0, 0, 0, 0, 0, 0, 0]; for (const d of dice) c[d]++; return c; };
const isStraight = (dice) => {
  if (dice.length !== 5) return false;
  const s = [...dice].sort((a, b) => a - b).join('');
  return s === '12345' || s === '23456';
};
const isFullHouse = (dice) => {
  if (dice.length !== 5) return false;
  const c = counts(dice).filter(Boolean).sort();
  return c.length === 2 && c[0] === 2 && c[1] === 3;
};

/**
 * Points for a set of dice taken from one roll, or null if any die in it doesn't score.
 */
export function scoreDice(dice, rules = defaults) {
  if (!dice.length) return null;
  if (rules.straights && isStraight(dice)) return 2000;
  if (rules.fullHouse && isFullHouse(dice)) return 2500;
  const c = counts(dice);
  let pts = 0;
  for (let f = 1; f <= 6; f++) {
    let n = c[f];
    if (n === 5) { pts += 2000; n = 0; }
    if (n === 4) { pts += 1500; n = 0; }
    if (n === 3) { pts += f === 1 ? 1000 : f * 100; n = 0; }
    if (n > 0) {
      if (f === 1) pts += 100 * n;
      else if (f === 5) pts += 50 * n;
      else return null;
    }
  }
  return pts;
}

/** Does any part of this roll score? */
export function rollScores(dice, rules = defaults) {
  const c = counts(dice);
  return c[1] > 0 || c[5] > 0 || c.some((n) => n >= 3) || (rules.straights && isStraight(dice)) || (rules.fullHouse && isFullHouse(dice));
}

/** The highest-scoring keep from a roll (used for hints and tests). */
export function bestKeep(dice, rules = defaults) {
  let best = { idx: [], pts: 0 };
  const n = dice.length;
  for (let mask = 1; mask < 1 << n; mask++) {
    const idx = [...Array(n).keys()].filter((i) => mask & (1 << i));
    const pts = scoreDice(idx.map((i) => dice[i]), rules);
    if (pts !== null && pts > best.pts) best = { idx, pts };
  }
  return best;
}

const rollDie = (rand) => 1 + Math.floor(rand() * 6);

export function start(playerIds, rules, rand = Math.random) {
  const s = {
    rules: { ...defaults, ...rules },
    players: playerIds.map((pid) => ({ id: pid, score: 0 })),
    order: playerIds.slice(),
    phase: 'turn',
    turn: playerIds[Math.floor(rand() * playerIds.length)],
    roll: [],
    kept: [],
    turnPoints: 0,
    diceLeft: 5,
    event: null,
    finalRound: null,
    result: null,
  };
  return s;
}

function nextTurn(s) {
  s.roll = [];
  s.kept = [];
  s.turnPoints = 0;
  s.diceLeft = 5;
  if (s.finalRound) {
    if (!s.finalRound.remaining.length) {
      const top = Math.max(...s.players.map((p) => p.score));
      s.phase = 'over';
      s.turn = null;
      s.result = { winners: s.players.filter((p) => p.score === top).map((p) => p.id), top };
      return;
    }
    s.turn = s.finalRound.remaining[0];
    return;
  }
  const i = s.order.indexOf(s.turn);
  s.turn = s.order[(i + 1) % s.order.length];
}

function takeKeep(s, keep) {
  const idx = [...new Set((keep || []).map(Number))].filter((i) => i >= 0 && i < s.roll.length);
  if (!idx.length) throw new Error('Set aside at least one scoring die.');
  const dice = idx.map((i) => s.roll[i]);
  const pts = scoreDice(dice, s.rules);
  if (pts === null) throw new Error('Only scoring dice can be set aside.');
  return { idx, dice, pts };
}

export function apply(s, pid, action, rand = Math.random) {
  const fail = (msg) => { throw new Error(msg); };
  if (s.phase !== 'turn') fail('The game is over.');
  if (s.turn !== pid) fail('It’s not your turn.');
  const me = s.players.find((p) => p.id === pid);
  switch (action.type) {
    case 'roll': {
      if (s.roll.length) {
        const k = takeKeep(s, action.keep);
        s.turnPoints += k.pts;
        s.kept.push({ dice: k.dice, pts: k.pts });
        s.diceLeft -= k.idx.length;
        if (s.diceLeft === 0) {
          if (!s.rules.hotDice) fail('All your dice have scored. Bank your points.');
          s.diceLeft = 5;
          s.kept.push({ hot: true });
        }
      }
      s.roll = Array.from({ length: s.diceLeft }, () => rollDie(rand));
      s.event = null;
      if (!rollScores(s.roll, s.rules)) {
        s.event = { type: 'bust', by: pid, roll: s.roll, lost: s.turnPoints };
        if (s.finalRound) s.finalRound.remaining = s.finalRound.remaining.filter((x) => x !== pid);
        nextTurn(s);
      }
      break;
    }
    case 'bank': {
      if (!s.roll.length) fail('Roll first.');
      const k = takeKeep(s, action.keep);
      const total = s.turnPoints + k.pts;
      if (me.score === 0 && total < s.rules.openingMin) fail(`You need ${s.rules.openingMin} in one turn to get on the board.`);
      me.score += total;
      s.event = { type: 'bank', by: pid, points: total };
      if (s.finalRound) {
        s.finalRound.remaining = s.finalRound.remaining.filter((x) => x !== pid);
      } else if (me.score >= s.rules.target) {
        const i = s.order.indexOf(pid);
        const rest = [...s.order.slice(i + 1), ...s.order.slice(0, i)];
        s.finalRound = { by: pid, remaining: rest };
        s.event.reached = true;
      }
      nextTurn(s);
      break;
    }
    default:
      fail('Unknown action.');
  }
  return s;
}

export function removePlayer(s, pid) {
  s.order = s.order.filter((x) => x !== pid);
  s.players = s.players.filter((p) => p.id !== pid);
  if (!s.order.length) return false;
  if (s.finalRound) s.finalRound.remaining = s.finalRound.remaining.filter((x) => x !== pid);
  if (s.turn === pid) { s.turn = s.order[0]; s.roll = []; s.kept = []; s.turnPoints = 0; s.diceLeft = 5; }
  if (s.finalRound && !s.finalRound.remaining.length && s.phase === 'turn') { s.turn = s.order[0]; nextTurn(s); }
  return true;
}

export const view = (s) => s;
