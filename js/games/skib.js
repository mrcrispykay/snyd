// Skib, kaptajn og mandskab (Ship, Captain and Crew): three rolls to get a 6, a 5 and a 4 in that order.
// The other two dice are the cargo. Highest cargo wins the round, lowest drinks.

export const id = 'skib';
export const name = 'Skib, kaptajn og mandskab';
export const category = 'dice';
export const tagline = 'Find the ship (6), captain (5) and crew (4), then load the cargo.';
export const minPlayers = 2;
export const maxPlayers = 12;

export const defaults = {
  rolls: 3,
  rounds: 3,
};

export const ruleInfo = {
  rolls: { label: 'Rolls per turn', options: [3, 4] },
  rounds: { label: 'Rounds', options: [1, 3, 5, 10] },
};

const rollDie = (rand) => 1 + Math.floor(rand() * 6);
const NEED = [6, 5, 4];

export function start(playerIds, rules, rand = Math.random) {
  const s = {
    rules: { ...defaults, ...rules },
    order: playerIds.slice(),
    wins: Object.fromEntries(playerIds.map((p) => [p, 0])),
    losses: Object.fromEntries(playerIds.map((p) => [p, 0])),
    round: 0,
    phase: 'turn', // turn | roundover | over
    result: null,
  };
  newRound(s, playerIds[Math.floor(rand() * playerIds.length)]);
  return s;
}

function newRound(s, starter) {
  s.round += 1;
  s.phase = 'turn';
  s.results = {};
  s.starter = starter;
  s.turn = starter;
  resetTurn(s);
}

function resetTurn(s) {
  s.rollsLeft = s.rules.rolls;
  s.found = 0; // how many of ship, captain, crew are set aside
  s.dice = []; // dice still in play
  s.held = []; // the 6, 5, 4 set aside so far
}

/** Sets aside 6, then 5, then 4 from `dice` in order, as far as they go. */
export function takeCrew(dice, found) {
  const left = dice.slice();
  const held = [];
  while (found < 3) {
    const i = left.indexOf(NEED[found]);
    if (i < 0) break;
    held.push(left.splice(i, 1)[0]);
    found += 1;
  }
  return { left, held, found };
}

function endTurn(s) {
  s.results[s.turn] = s.found === 3 ? s.dice.reduce((a, b) => a + b, 0) : 0;
  const i = s.order.indexOf(s.turn);
  const next = s.order[(i + 1) % s.order.length];
  if (next === s.starter) {
    const vals = s.order.map((p) => s.results[p]);
    const top = Math.max(...vals);
    const low = Math.min(...vals);
    s.roundResult = {
      winners: s.order.filter((p) => s.results[p] === top && top > 0),
      losers: s.order.filter((p) => s.results[p] === low),
    };
    s.roundResult.winners.forEach((p) => { s.wins[p] += 1; });
    s.roundResult.losers.forEach((p) => { s.losses[p] += 1; });
    s.phase = s.round >= s.rules.rounds ? 'over' : 'roundover';
    if (s.phase === 'over') {
      const most = Math.max(...s.order.map((p) => s.losses[p]));
      s.result = { losers: s.order.filter((p) => s.losses[p] === most) };
    }
    s.turn = null;
    return;
  }
  s.turn = next;
  resetTurn(s);
}

export function apply(s, pid, action, rand = Math.random) {
  const fail = (msg) => { throw new Error(msg); };
  switch (action.type) {
    case 'roll': {
      if (s.phase !== 'turn' || s.turn !== pid) fail('It’s not your turn.');
      if (s.rollsLeft <= 0) fail('No rolls left.');
      const n = 5 - s.held.length;
      const rolled = Array.from({ length: n }, () => rollDie(rand));
      const t = takeCrew(rolled, s.found);
      s.held.push(...t.held);
      s.found = t.found;
      s.dice = t.left;
      s.rollsLeft -= 1;
      s.lastRoll = rolled;
      if (s.rollsLeft === 0) endTurn(s);
      break;
    }
    case 'stop': {
      if (s.phase !== 'turn' || s.turn !== pid) fail('It’s not your turn.');
      if (s.found < 3) fail('You need the ship, captain and crew before you can keep your cargo.');
      endTurn(s);
      break;
    }
    case 'next': {
      if (s.phase !== 'roundover') fail('The round isn’t over.');
      const lowest = s.roundResult.losers[0];
      newRound(s, lowest);
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
  if (s.order.length < 2) return false;
  if (s.turn === pid) { s.turn = s.order[i % s.order.length]; resetTurn(s); }
  if (s.starter === pid) s.starter = s.order[i % s.order.length];
  return true;
}

export const view = (s) => s;
