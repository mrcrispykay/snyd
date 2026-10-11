// Yatzy (Scandinavian rules): 15 categories, three rolls a turn, bonus 50 for 63+ in the upper section.
// "Everyone at once" lets every player work through their own sheet at the same time.

export const id = 'yatzy';
export const name = 'Yatzy';
export const category = 'dice';
export const tagline = 'The score sheet classic. Play at the same time or take turns.';
export const minPlayers = 1;
export const maxPlayers = 10;

export const defaults = {
  mode: 'together', // 'together': everyone plays their own sheet at once. 'turns': one player at a time.
};

export const ruleInfo = {
  mode: { label: 'How to play', options: [['together', 'Everyone at once'], ['turns', 'Take turns']] },
};

export const CATEGORIES = [
  ['ones', 'Ones'], ['twos', 'Twos'], ['threes', 'Threes'], ['fours', 'Fours'], ['fives', 'Fives'], ['sixes', 'Sixes'],
  ['pair', 'One pair'], ['twoPairs', 'Two pairs'], ['three', 'Three of a kind'], ['four', 'Four of a kind'],
  ['small', 'Small straight'], ['large', 'Large straight'], ['house', 'Full house'], ['chance', 'Chance'], ['yatzy', 'Yatzy'],
];
const UPPER = ['ones', 'twos', 'threes', 'fours', 'fives', 'sixes'];

const counts = (dice) => { const c = [0, 0, 0, 0, 0, 0, 0]; for (const d of dice) c[d]++; return c; };
const sum = (dice) => dice.reduce((a, b) => a + b, 0);

/** Points `dice` would score in `cat`. */
export function score(cat, dice) {
  const c = counts(dice);
  const up = UPPER.indexOf(cat);
  if (up >= 0) return c[up + 1] * (up + 1);
  const faces = [6, 5, 4, 3, 2, 1];
  switch (cat) {
    case 'pair': { const f = faces.find((x) => c[x] >= 2); return f ? f * 2 : 0; }
    case 'twoPairs': {
      const ps = faces.filter((x) => c[x] >= 2);
      return ps.length >= 2 ? ps[0] * 2 + ps[1] * 2 : 0;
    }
    case 'three': { const f = faces.find((x) => c[x] >= 3); return f ? f * 3 : 0; }
    case 'four': { const f = faces.find((x) => c[x] >= 4); return f ? f * 4 : 0; }
    case 'small': return [1, 2, 3, 4, 5].every((x) => c[x] === 1) ? 15 : 0;
    case 'large': return [2, 3, 4, 5, 6].every((x) => c[x] === 1) ? 20 : 0;
    case 'house': return c.includes(3) && c.includes(2) ? sum(dice) : 0;
    case 'chance': return sum(dice);
    case 'yatzy': return c.includes(5) ? 50 : 0;
    default: return 0;
  }
}

export function totals(sheet) {
  const upper = UPPER.reduce((a, k) => a + (sheet[k] ?? 0), 0);
  const bonus = upper >= 63 ? 50 : 0;
  const all = CATEGORIES.reduce((a, [k]) => a + (sheet[k] ?? 0), 0) + bonus;
  return { upper, bonus, total: all };
}

const rollDie = (rand) => 1 + Math.floor(rand() * 6);
const freshTurn = () => ({ dice: [0, 0, 0, 0, 0], held: [false, false, false, false, false], rollsLeft: 3 });

export function start(playerIds, rules, rand = Math.random) {
  const r = { ...defaults, ...rules };
  return {
    rules: r,
    order: playerIds.slice(),
    sheets: Object.fromEntries(playerIds.map((p) => [p, {}])),
    turns: Object.fromEntries(playerIds.map((p) => [p, freshTurn()])),
    turn: r.mode === 'turns' ? playerIds[Math.floor(rand() * playerIds.length)] : null,
    phase: 'play',
    result: null,
  };
}

const finished = (s, p) => CATEGORIES.every(([k]) => k in s.sheets[p]);

function checkOver(s) {
  if (!s.order.every((p) => finished(s, p))) return;
  const t = Object.fromEntries(s.order.map((p) => [p, totals(s.sheets[p]).total]));
  const top = Math.max(...Object.values(t));
  s.phase = 'over';
  s.result = { winners: s.order.filter((p) => t[p] === top), top };
}

export function apply(s, pid, action, rand = Math.random) {
  const fail = (msg, params) => { throw Object.assign(new Error(msg), { params }); };
  if (s.phase !== 'play') fail('The game is over.');
  if (!s.order.includes(pid)) fail('You’re not in this game.');
  if (s.rules.mode === 'turns' && s.turn !== pid) fail('It’s not your turn.');
  if (finished(s, pid)) fail('Your sheet is full.');
  const t = s.turns[pid];
  switch (action.type) {
    case 'roll': {
      if (t.rollsLeft <= 0) fail('No rolls left. Pick a box.');
      t.dice = t.dice.map((d, i) => (t.held[i] && t.rollsLeft < 3 ? d : rollDie(rand)));
      t.rollsLeft -= 1;
      if (t.rollsLeft === 2) t.held = [false, false, false, false, false];
      break;
    }
    case 'hold': {
      if (t.rollsLeft === 3) fail('Roll first.');
      const i = Number(action.index);
      if (!(i >= 0 && i < 5)) fail('Pick a die.');
      t.held[i] = !t.held[i];
      break;
    }
    case 'score': {
      if (t.rollsLeft === 3) fail('Roll first.');
      const cat = action.cat;
      if (!CATEGORIES.some(([k]) => k === cat)) fail('Unknown box.');
      if (cat in s.sheets[pid]) fail('That box is already filled.');
      s.sheets[pid][cat] = score(cat, t.dice);
      s.last = { by: pid, cat, points: s.sheets[pid][cat], dice: t.dice.slice() };
      s.turns[pid] = freshTurn();
      if (s.rules.mode === 'turns') {
        const i = s.order.indexOf(pid);
        s.turn = s.order[(i + 1) % s.order.length];
      }
      checkOver(s);
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
  delete s.sheets[pid];
  delete s.turns[pid];
  if (!s.order.length) return false;
  if (s.turn === pid) s.turn = s.order[i % s.order.length];
  checkOver(s);
  return true;
}

export const view = (s) => s;
