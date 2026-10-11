// Gris (Pig / 100): roll one die as often as you dare. A 1 wipes out the turn. First to the target wins.

export const id = 'gris';
export const name = 'Gris';
export const category = 'dice';
export const tagline = 'One die, one rule: a 1 loses the lot. First to 100.';
export const minPlayers = 1;
export const maxPlayers = 10;

export const defaults = {
  target: 100,
  twoDice: false, // roll two dice: a single 1 loses the turn, double 1 resets your score
};

export const ruleInfo = {
  target: { label: 'Play to', options: [50, 100] },
  twoDice: { label: 'Two dice', help: 'Roll two dice. One 1 loses the turn; two 1s wipe your whole score.' },
};

const rollDie = (rand) => 1 + Math.floor(rand() * 6);

export function start(playerIds, rules, rand = Math.random) {
  return {
    rules: { ...defaults, ...rules },
    order: playerIds.slice(),
    scores: Object.fromEntries(playerIds.map((p) => [p, 0])),
    turn: playerIds[Math.floor(rand() * playerIds.length)],
    turnPoints: 0,
    last: null,
    event: null,
    phase: 'turn',
    result: null,
  };
}

function pass(s) {
  s.turnPoints = 0;
  const i = s.order.indexOf(s.turn);
  s.turn = s.order[(i + 1) % s.order.length];
}

export function apply(s, pid, action, rand = Math.random) {
  const fail = (msg, params) => { throw Object.assign(new Error(msg), { params }); };
  if (s.phase !== 'turn') fail('The game is over.');
  if (s.turn !== pid) fail('It’s not your turn.');
  switch (action.type) {
    case 'roll': {
      const dice = s.rules.twoDice ? [rollDie(rand), rollDie(rand)] : [rollDie(rand)];
      s.last = { by: pid, dice };
      const ones = dice.filter((d) => d === 1).length;
      if (ones === 2) { s.event = { type: 'wipe', by: pid, lost: s.scores[pid] + s.turnPoints }; s.scores[pid] = 0; pass(s); break; }
      if (ones === 1) { s.event = { type: 'bust', by: pid, lost: s.turnPoints }; pass(s); break; }
      s.event = null;
      s.turnPoints += dice.reduce((a, b) => a + b, 0);
      if (s.scores[pid] + s.turnPoints >= s.rules.target) {
        s.scores[pid] += s.turnPoints;
        s.phase = 'over';
        s.result = { winner: pid };
      }
      break;
    }
    case 'hold': {
      if (!s.turnPoints) fail('Roll at least once.');
      s.scores[pid] += s.turnPoints;
      s.event = { type: 'hold', by: pid, points: s.turnPoints };
      s.last = null;
      pass(s);
      break;
    }
    default:
      fail('Unknown action.');
  }
  return s;
}

export function removePlayer(s, pid) {
  const i = s.order.indexOf(pid);
  s.order = s.order.filter((p) => p !== pid);
  if (!s.order.length) return false;
  if (s.turn === pid) { s.turn = s.order[i % s.order.length]; s.turnPoints = 0; }
  return true;
}

export const view = (s) => s;
