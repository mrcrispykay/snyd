// Snyd (Løgn, Tænkeboks): bid on how many dice of a face are on the whole table, or call "Snyd!".
// Pure game module: the table engine calls start/apply/view; tests run it in Node.

export const id = 'snyd';
export const name = 'Snyd';
export const category = 'dice';
export const tagline = 'Bluff about the dice on the whole table.';
export const minPlayers = 2;
export const maxPlayers = 10;

export const defaults = {
  dicePerPlayer: 4,
  onesWild: true, // ones count as any face (and can't be bid on their own)
  trappe: true, // a run 1-2-3… using all of a player's dice counts as (dice + 1) of the bid face
  tilStede: false, // ones (and trappes) only count if the bid face shows on at least one real die
  diceLoss: 'others', // 'others': everyone but the round loser drops a die, last with dice loses
  // 'loser': only the round loser drops a die, last with dice wins
  minOpeningCount: 1,
};

export const ruleInfo = {
  dicePerPlayer: { label: 'Dice per player', options: [3, 4, 5, 6] },
  onesWild: { label: 'Ones are wild', help: 'A 1 counts as whatever face is bid. Ones can’t be bid on their own.' },
  trappe: { label: 'Trappe', help: '1-2, 1-2-3 … using all your dice counts as your number of dice + 1 of any face.' },
  tilStede: { label: 'Til stede', help: 'Ones and trappes only count if the bid face shows on at least one die on the table.' },
  diceLoss: {
    label: 'Who drops a die',
    options: [
      ['others', 'Everyone but the loser · last with dice loses'],
      ['loser', 'Only the loser · last with dice wins'],
    ],
  },
  minOpeningCount: { label: 'Lowest opening bid', options: [1, 2, 3] },
};

const rollDie = (rand) => 1 + Math.floor(rand() * 6);
export const activePlayers = (s) => s.players.filter((p) => !p.out);

/** Is `dice` a trappe: exactly 1, 2, …, n in some order? */
export function isTrappe(dice) {
  if (!dice.length) return false;
  const sorted = [...dice].sort((a, b) => a - b);
  return sorted.every((d, i) => d === i + 1);
}

/**
 * How many of `face` one player's dice are worth, and which dice count.
 * `facePresent` is whether the face shows on any real die on the table (for til stede).
 */
export function handValue(dice, face, rules, facePresent = true) {
  const jokersAllowed = !rules.tilStede || facePresent;
  if (rules.trappe && face !== 1 && isTrappe(dice) && jokersAllowed) {
    return { value: dice.length + 1, counting: dice.map(() => true), trappe: true };
  }
  const counting = dice.map((d) => d === face || (rules.onesWild && face !== 1 && d === 1 && jokersAllowed));
  return { value: counting.filter(Boolean).length, counting, trappe: false };
}

/** Total of `face` across all hands: [{ id, dice }]. */
export function countTable(hands, face, rules) {
  const facePresent = hands.some((h) => h.dice.includes(face));
  const per = hands.map((h) => ({ id: h.id, dice: h.dice, ...handValue(h.dice, face, rules, facePresent) }));
  return { total: per.reduce((a, h) => a + h.value, 0), per };
}

export function biddableFaces(rules) {
  return rules.onesWild ? [2, 3, 4, 5, 6] : [1, 2, 3, 4, 5, 6];
}

/** More dice of any face, or the same number of dice with a higher face. */
export function isHigher(bid, prev) {
  if (!prev) return true;
  return bid.count > prev.count || (bid.count === prev.count && bid.face > prev.face);
}

export function validBid(state, bid) {
  if (!Number.isInteger(bid.count) || !Number.isInteger(bid.face)) return 'Pick a number and a face.';
  if (!biddableFaces(state.rules).includes(bid.face)) return 'Ones are wild and can’t be bid.';
  if (bid.count < 1) return 'Bid at least one die.';
  if (!state.bid && bid.count < state.rules.minOpeningCount) return `Open with at least ${state.rules.minOpeningCount}.`;
  if (!isHigher(bid, state.bid)) return 'Bid more dice, or the same number with a higher face.';
  return null;
}

/** Lowest legal bid, used to preset the picker. */
export function lowestBid(state) {
  const faces = biddableFaces(state.rules);
  if (!state.bid) return { count: state.rules.minOpeningCount, face: faces[0] };
  const higherFace = faces.find((f) => f > state.bid.face);
  return higherFace ? { count: state.bid.count, face: higherFace } : { count: state.bid.count + 1, face: faces[0] };
}

function nextActiveAfter(state, pid) {
  const n = state.players.length;
  const start = state.players.findIndex((p) => p.id === pid);
  for (let k = 1; k <= n; k++) {
    const p = state.players[(start + k) % n];
    if (!p.out) return p.id;
  }
  return null;
}

function startRound(state, starterId, rand) {
  state.round += 1;
  for (const p of state.players) p.dice = p.out ? [] : Array.from({ length: p.count }, () => rollDie(rand));
  state.bid = null;
  state.history = [];
  state.reveal = null;
  state.phase = 'bidding';
  const starter = state.players.find((p) => p.id === starterId && !p.out) ? starterId : nextActiveAfter(state, starterId);
  state.starter = starter;
  state.turn = starter;
}

export function start(playerIds, rules, rand = Math.random) {
  const s = {
    rules: { ...defaults, ...rules },
    players: playerIds.map((pid) => ({ id: pid, count: 0, dice: [], out: false })),
    phase: 'bidding',
    round: 0,
    turn: null,
    starter: null,
    bid: null,
    history: [],
    reveal: null,
    result: null,
  };
  for (const p of s.players) p.count = s.rules.dicePerPlayer;
  startRound(s, playerIds[Math.floor(rand() * playerIds.length)], rand);
  return s;
}

/** Applies a game action to `s` in place. Throws an Error with a readable message if not allowed. */
export function apply(s, playerId, action, rand = Math.random) {
  const fail = (msg) => { throw new Error(msg); };
  switch (action.type) {
    case 'bid': {
      if (s.phase !== 'bidding') fail('Not bidding right now.');
      if (s.turn !== playerId) fail('It’s not your turn.');
      const bid = { count: Number(action.count), face: Number(action.face) };
      const err = validBid(s, bid);
      if (err) fail(err);
      s.bid = { ...bid, by: playerId };
      s.history.push({ ...s.bid });
      s.turn = nextActiveAfter(s, playerId);
      break;
    }
    case 'snyd': {
      if (s.phase !== 'bidding') fail('Not bidding right now.');
      if (s.turn !== playerId) fail('It’s not your turn.');
      if (!s.bid) fail('There’s no bid to call yet.');
      const hands = activePlayers(s).map((p) => ({ id: p.id, dice: p.dice }));
      const { total, per } = countTable(hands, s.bid.face, s.rules);
      const holds = total >= s.bid.count;
      const loser = holds ? playerId : s.bid.by;
      for (const p of activePlayers(s)) {
        const drops = s.rules.diceLoss === 'loser' ? p.id === loser : p.id !== loser;
        if (drops) { p.count -= 1; if (p.count <= 0) { p.count = 0; p.out = true; } }
      }
      s.reveal = { bid: s.bid, caller: playerId, total, holds, loser, hands: per };
      s.phase = 'reveal';
      s.turn = null;
      const left = activePlayers(s);
      if (left.length <= 1) {
        s.phase = 'over';
        s.result = s.rules.diceLoss === 'loser' ? { winner: left[0]?.id ?? null } : { loser: left[0]?.id ?? null };
      }
      break;
    }
    case 'next': {
      if (s.phase !== 'reveal') fail('The round isn’t finished.');
      startRound(s, s.reveal.loser, rand);
      break;
    }
    default:
      fail('Unknown action.');
  }
  return s;
}

/** A player leaves mid-game: the round restarts without them. Returns false if the game can't go on. */
export function removePlayer(s, pid, rand = Math.random) {
  const p = s.players.find((x) => x.id === pid);
  if (!p) return true;
  const wasTurn = s.turn;
  p.out = true; p.count = 0; p.dice = []; p.left = true;
  if (activePlayers(s).length <= 1) return false;
  startRound(s, wasTurn === pid || !wasTurn ? nextActiveAfter(s, pid) : wasTurn, rand);
  return true;
}

/** What one player may see: their own dice, and everyone's only at the reveal. */
export function view(s, playerId) {
  const showAll = s.phase === 'reveal' || s.phase === 'over';
  return {
    ...s,
    players: s.players.map((p) => ({ ...p, dice: p.id === playerId || showAll ? p.dice : p.dice.map(() => 0) })),
  };
}
