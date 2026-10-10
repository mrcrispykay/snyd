// Meyer (Mia): roll two dice under the cup, announce a roll (true or not), pass the cup.
// The next player believes it and must announce at least as high, or lifts the cup.

export const id = 'meyer';
export const name = 'Meyer';
export const tagline = 'Two dice, one cup, and a lie that has to keep getting bigger.';
export const minPlayers = 2;
export const maxPlayers = 12;

export const defaults = {
  lives: 6,
  equalAllowed: true, // "det eller derover": the same roll counts as beating it
  meyerDouble: true, // a lift on a Meyer costs 2 lives
  blindPass: true, // roll again and pass without looking, claiming the same roll
  skaal: true, // 3-2 is "Fælles skål": everyone drinks and the round starts over
  ending: 'firstOut', // 'firstOut': first player to lose all lives loses. 'lastStanding': last one alive wins.
};

export const ruleInfo = {
  lives: { label: 'Lives', options: [3, 6, 9] },
  equalAllowed: { label: 'Det eller derover', help: 'Announcing the same roll as the last player is allowed.' },
  meyerDouble: { label: 'Meyer costs double', help: 'Losing a lift on a Meyer costs 2 lives.' },
  blindPass: { label: 'Pass blind', help: 'Roll and pass the cup without looking, claiming the same roll as before.' },
  skaal: { label: '3-2 is skål', help: 'Rolling 3-2 means everyone drinks, and the round starts over.' },
  ending: {
    label: 'Game ends',
    options: [
      ['firstOut', 'First one out of lives loses'],
      ['lastStanding', 'Last one with lives wins'],
    ],
  },
};

/** Every roll from lowest to highest. */
export const ORDER = ['32', '41', '42', '43', '51', '52', '53', '54', '61', '62', '63', '64', '65', '11', '22', '33', '44', '55', '66', '31', '21'];
export const rank = (key) => ORDER.indexOf(key);

export function rollKey([a, b]) {
  const hi = Math.max(a, b);
  const lo = Math.min(a, b);
  if (hi === 2 && lo === 1) return '21';
  if (hi === 3 && lo === 1) return '31';
  return `${hi}${lo}`;
}

export function rollName(key) {
  if (key === '21') return 'Meyer';
  if (key === '31') return 'Lille-Meyer';
  if (key[0] === key[1]) return `Par ${key[0]}`;
  return key;
}

/** Keys a player may announce after `claim`. */
export function allowedClaims(state) {
  const c = state.claim;
  if (!c) return ORDER.slice();
  const r = rank(c.key);
  return ORDER.filter((k) => (state.rules.equalAllowed ? rank(k) >= r : rank(k) > r));
}

const rollDie = (rand) => 1 + Math.floor(rand() * 6);
const alive = (s) => s.players.filter((p) => !p.out);

function nextAliveAfter(s, pid) {
  const n = s.players.length;
  const i = s.players.findIndex((p) => p.id === pid);
  for (let k = 1; k <= n; k++) {
    const p = s.players[(i + k) % n];
    if (!p.out) return p.id;
  }
  return null;
}

function newRound(s, starter) {
  s.round += 1;
  s.phase = 'turn';
  s.claim = null;
  s.claimDice = null;
  s.history = [];
  s.cup = null;
  s.reveal = null;
  s.turn = s.players.find((p) => p.id === starter && !p.out) ? starter : nextAliveAfter(s, starter);
}

export function start(playerIds, rules, rand = Math.random) {
  const s = {
    rules: { ...defaults, ...rules },
    players: playerIds.map((pid) => ({ id: pid, lives: 0, out: false })),
    round: 0,
    result: null,
  };
  for (const p of s.players) p.lives = s.rules.lives;
  newRound(s, playerIds[Math.floor(rand() * playerIds.length)]);
  return s;
}

function loseLives(s, pid, n) {
  const p = s.players.find((x) => x.id === pid);
  p.lives = Math.max(0, p.lives - n);
  if (p.lives === 0) {
    if (s.rules.ending === 'firstOut') {
      s.phase = 'over';
      s.result = { loser: pid };
      return;
    }
    p.out = true;
    if (alive(s).length <= 1) {
      s.phase = 'over';
      s.result = { winner: alive(s)[0]?.id ?? null };
    }
  }
}

export function apply(s, pid, action, rand = Math.random) {
  const fail = (msg) => { throw new Error(msg); };
  const myTurn = s.phase === 'turn' && s.turn === pid;
  switch (action.type) {
    case 'roll': {
      if (!myTurn) fail('It’s not your turn.');
      if (s.cup) fail('You’ve already rolled.');
      s.cup = { dice: [rollDie(rand), rollDie(rand)], looked: false };
      break;
    }
    case 'look': {
      if (!myTurn || !s.cup) fail('Roll first.');
      s.cup.looked = true;
      break;
    }
    case 'announce': {
      if (!myTurn || !s.cup) fail('Roll first.');
      const key = String(action.key);
      if (!ORDER.includes(key)) fail('Unknown roll.');
      if (!allowedClaims(s).includes(key)) fail(`You have to announce ${s.rules.equalAllowed ? 'at least' : 'more than'} ${rollName(s.claim.key)}.`);
      s.claim = { key, by: pid, blind: false };
      s.claimDice = s.cup.dice;
      s.history.push({ ...s.claim });
      s.cup = null;
      s.turn = nextAliveAfter(s, pid);
      break;
    }
    case 'blind': {
      if (!s.rules.blindPass) fail('Passing blind is off.');
      if (!myTurn || !s.cup) fail('Roll first.');
      if (s.cup.looked) fail('You’ve looked, so you have to announce.');
      if (!s.claim) fail('There’s nothing to pass on yet.');
      s.claim = { key: s.claim.key, by: pid, blind: true };
      s.claimDice = s.cup.dice;
      s.history.push({ ...s.claim });
      s.cup = null;
      s.turn = nextAliveAfter(s, pid);
      break;
    }
    case 'skaal': {
      if (!s.rules.skaal) fail('Skål is off.');
      if (!myTurn || !s.cup) fail('Roll first.');
      if (rollKey(s.cup.dice) !== '32') fail('Only 3-2 is skål.');
      s.reveal = { type: 'skaal', by: pid, dice: s.cup.dice };
      s.phase = 'reveal';
      s.cup = null;
      s.turn = null;
      break;
    }
    case 'lift': {
      if (!myTurn) fail('It’s not your turn.');
      if (s.cup) fail('You’ve already rolled, so you can’t lift.');
      if (!s.claim) fail('There’s nothing to lift yet.');
      const actual = rollKey(s.claimDice);
      const truthful = rank(actual) >= rank(s.claim.key);
      const loser = truthful ? pid : s.claim.by;
      const lost = s.rules.meyerDouble && s.claim.key === '21' ? 2 : 1;
      s.reveal = { type: 'lift', lifter: pid, claim: s.claim, dice: s.claimDice, actual, truthful, loser, lost };
      s.phase = 'reveal';
      s.turn = null;
      loseLives(s, loser, lost);
      break;
    }
    case 'next': {
      if (s.phase !== 'reveal') fail('The round isn’t finished.');
      const starter = s.reveal.type === 'skaal' ? nextAliveAfter(s, s.reveal.by) : s.reveal.loser;
      newRound(s, starter);
      break;
    }
    default:
      fail('Unknown action.');
  }
  return s;
}

export function removePlayer(s, pid) {
  const p = s.players.find((x) => x.id === pid);
  if (!p) return true;
  p.out = true; p.left = true;
  if (alive(s).length <= 1) return false;
  if (s.turn === pid || s.claim?.by === pid || s.phase !== 'turn') newRound(s, nextAliveAfter(s, pid));
  return true;
}

/** Nobody sees the dice under the cup, except the roller once they've looked, until a lift. */
export function view(s, pid) {
  return {
    ...s,
    claimDice: null,
    cup: s.cup ? { looked: s.cup.looked, dice: s.turn === pid && s.cup.looked ? s.cup.dice : null } : null,
  };
}
