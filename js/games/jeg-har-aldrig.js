// Jeg har aldrig (Never have I ever): answer in secret, then everyone who has done it drinks.
import { shuffle } from './cards.js';
import { NEVER, promptDeck } from './prompts.js';

export const id = 'jeg-har-aldrig';
export const name = 'Jeg har aldrig';
export const category = 'party';
export const tagline = 'Never have I ever… Answer in secret, then the truth comes out.';
export const minPlayers = 2;
export const maxPlayers = 12;

export const defaults = {
  builtIn: true,
  extra: '',
};

export const ruleInfo = {
  builtIn: { label: 'Built-in prompts', help: `${NEVER.length} prompts. Turn off to use only your own.` },
  extra: { label: 'Your own prompts', help: 'One per line. “Never have I ever …”', text: true, multiline: true },
};

export function start(playerIds, rules, rand = Math.random) {
  const r = { ...defaults, ...rules };
  return {
    rules: r,
    players: playerIds.slice(),
    prompts: promptDeck(NEVER, r.extra, r.builtIn, shuffle, rand),
    index: 0,
    phase: 'answering', // answering | reveal
    answers: {},
    round: 1,
  };
}

export function apply(s, pid, action, rand = Math.random) {
  const fail = (msg) => { throw new Error(msg); };
  switch (action.type) {
    case 'answer': {
      if (s.phase !== 'answering') fail('Answers are in.');
      s.answers[pid] = !!action.has;
      if (s.players.every((p) => p in s.answers)) s.phase = 'reveal';
      break;
    }
    case 'reveal': {
      if (s.phase !== 'answering') fail('Already revealed.');
      if (!Object.keys(s.answers).length) fail('Nobody has answered yet.');
      s.phase = 'reveal';
      break;
    }
    case 'next': {
      if (s.phase !== 'reveal') fail('Wait for the answers.');
      s.index += 1;
      if (s.index >= s.prompts.length) { s.prompts = shuffle(s.prompts, rand); s.index = 0; }
      s.answers = {};
      s.phase = 'answering';
      s.round += 1;
      break;
    }
    default:
      fail('Unknown action.');
  }
  return s;
}

export function removePlayer(s, pid) {
  s.players = s.players.filter((p) => p !== pid);
  delete s.answers[pid];
  return s.players.length >= 2;
}

export function view(s, pid) {
  return {
    ...s,
    prompt: s.prompts[s.index],
    prompts: undefined,
    answered: Object.keys(s.answers),
    mine: pid in s.answers ? s.answers[pid] : null,
    answers: s.phase === 'reveal' ? s.answers : {},
  };
}
