// Mest sandsynligt (Most likely to): everyone votes in secret for who fits the prompt. Most votes drinks.
import { shuffle } from './cards.js';
import { MOST_LIKELY, promptDeck } from './prompts.js';

export const id = 'mest-sandsynligt';
export const name = 'Mest sandsynligt';
export const category = 'party';
export const tagline = 'Vote in secret: who’s most likely to…? Most votes drinks.';
export const minPlayers = 3;
export const maxPlayers = 12;

export const defaults = {
  builtIn: true,
  extra: '',
  selfVote: false,
};

export const ruleInfo = {
  builtIn: { label: 'Built-in prompts', help: '{n} prompts. Turn off to use only your own.', helpParams: { n: MOST_LIKELY.length } },
  selfVote: { label: 'Can vote for yourself' },
  extra: { label: 'Your own prompts', help: 'One per line. “Who is most likely to …”', text: true, multiline: true },
};

export function start(playerIds, rules, rand = Math.random) {
  const r = { ...defaults, ...rules };
  return {
    rules: r,
    players: playerIds.slice(),
    prompts: promptDeck(MOST_LIKELY, r.extra, r.builtIn, shuffle, rand),
    index: 0,
    phase: 'voting', // voting | reveal
    votes: {},
    tally: null,
    round: 1,
  };
}

export function apply(s, pid, action, rand = Math.random) {
  const fail = (msg, params) => { throw Object.assign(new Error(msg), { params }); };
  switch (action.type) {
    case 'vote': {
      if (s.phase !== 'voting') fail('Voting is closed.');
      if (!s.players.includes(action.target)) fail('Pick someone at the table.');
      if (action.target === pid && !s.rules.selfVote) fail('You can’t vote for yourself.');
      s.votes[pid] = action.target;
      if (s.players.every((p) => s.votes[p])) reveal(s);
      break;
    }
    case 'reveal': {
      if (s.phase !== 'voting') fail('Already revealed.');
      if (!Object.keys(s.votes).length) fail('Nobody has voted yet.');
      reveal(s);
      break;
    }
    case 'next': {
      if (s.phase !== 'reveal') fail('Finish the vote first.');
      s.index += 1;
      if (s.index >= s.prompts.length) { s.prompts = shuffle(s.prompts, rand); s.index = 0; }
      s.votes = {};
      s.tally = null;
      s.phase = 'voting';
      s.round += 1;
      break;
    }
    default:
      fail('Unknown action.');
  }
  return s;
}

function reveal(s) {
  const counts = {};
  for (const t of Object.values(s.votes)) counts[t] = (counts[t] || 0) + 1;
  const top = Math.max(...Object.values(counts));
  s.tally = { counts, drink: Object.keys(counts).filter((k) => counts[k] === top), top };
  s.phase = 'reveal';
}

export function removePlayer(s, pid) {
  s.players = s.players.filter((p) => p !== pid);
  delete s.votes[pid];
  for (const [k, v] of Object.entries(s.votes)) if (v === pid) delete s.votes[k];
  return s.players.length >= 2;
}

/** Votes stay secret until the reveal; players only see who has voted. */
export function view(s, pid) {
  return {
    ...s,
    mine: s.votes[pid] || null,
    prompt: s.prompts[s.index],
    prompts: undefined,
    voted: Object.keys(s.votes),
    votes: s.phase === 'reveal' ? s.votes : {},
  };
}
