// Collects every English text key the app shows, so translations can be checked for gaps.
// Usage: node scripts/i18n-keys.mjs [lang]   (prints keys missing from that language)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const list = (dir) => fs.readdirSync(path.join(root, dir)).filter((f) => f.endsWith('.js')).map((f) => `${dir}/${f}`);

const unescape = (s) => s.replace(/\\'/g, '\'').replace(/\\n/g, '\n');
function grab(src, re, keys) {
  for (const m of src.matchAll(re)) keys.add(unescape(m[1]));
}

// Keys used through a variable, e.g. t(LABEL[k]).
const DYNAMIC = [
  'Dice', 'Cards', 'Party',
  'Ones', 'Twos', 'Threes', 'Fours', 'Fives', 'Sixes', 'One pair', 'Two pairs', 'Three of a kind', 'Four of a kind',
  'Small straight', 'Large straight', 'Full house', 'Chance', 'Yahtzee',
  'Red or black?', 'Higher or lower?', 'Between or outside?', 'Which suit?',
  'Red', 'Black', 'Higher', 'Lower', 'Between', 'Outside', 'red', 'black', 'higher', 'lower', 'between', 'outside',
  'Spades', 'Hearts', 'Diamonds', 'Clubs',
  'Opening the table…', 'Connecting…',
];

export async function collectKeys() {
  const keys = new Set(DYNAMIC);
  for (const f of [...list('js/ui'), 'js/main.js']) grab(read(f), /\bt\('((?:[^'\\]|\\.)*)'/g, keys);
  for (const f of [...list('js/games'), 'js/table.js']) {
    const src = read(f);
    grab(src, /\bfail\('((?:[^'\\]|\\.)*)'/g, keys);
    grab(src, /\bwhy\('((?:[^'\\]|\\.)*)'/g, keys);
  }
  grab(read('js/net.js'), /onStatus\('((?:[^'\\]|\\.)*)'/g, keys);
  grab(read('js/net.js'), /new Error\('((?:[^'\\]|\\.)*)'\)/g, keys);
  keys.delete('code-taken');
  // House-rule labels, help texts and option labels, read from the game modules themselves.
  const { GAMES } = await import('../js/table.js');
  for (const g of GAMES) {
    for (const info of Object.values(g.ruleInfo)) {
      if (info.label && !/^\d+$/.test(info.label)) keys.add(info.label);
      if (info.help) keys.add(info.help);
      for (const o of info.options || []) if (Array.isArray(o)) keys.add(o[1]);
    }
  }
  return [...keys].sort();
}

export const placeholders = (s) => [...String(s).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const keys = await collectKeys();
  const lang = process.argv[2];
  if (!lang) { console.log(JSON.stringify(keys, null, 1)); console.log(keys.length, 'keys'); } else {
    const dict = (await import(`../js/i18n/${lang}.js`)).default.strings;
    const missing = keys.filter((k) => !(k in dict));
    console.log(JSON.stringify(missing, null, 1));
    console.log(`${missing.length} of ${keys.length} missing in ${lang}`);
  }
}
