// Translations. Keys are the English text; each language file maps English to its own text.
// Every phone picks its own language, so one table can mix languages.
import en from './en.js';
import da from './da.js';
import de from './de.js';
import sv from './sv.js';
import nb from './nb.js';

export const LANGS = [
  { code: 'da', label: 'Dansk', locale: 'da-DK' },
  { code: 'en', label: 'English', locale: 'en-GB' },
  { code: 'de', label: 'Deutsch', locale: 'de-DE' },
  { code: 'sv', label: 'Svenska', locale: 'sv-SE' },
  { code: 'nb', label: 'Norsk', locale: 'nb-NO' },
];
export const DICTS = { en, da, de, sv, nb };
const KEY = 'bodega.lang';

function detect() {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved && DICTS[saved]) return saved;
  } catch { /* storage blocked */ }
  const prefs = typeof navigator !== 'undefined' ? navigator.languages || [navigator.language] : [];
  for (const l of prefs) {
    const c = String(l || '').toLowerCase().slice(0, 2);
    if (c === 'no' || c === 'nn' || c === 'nb') return 'nb';
    if (DICTS[c]) return c;
  }
  return 'en';
}

let lang = typeof window !== 'undefined' ? detect() : 'en';

export const getLang = () => lang;
export const locale = () => LANGS.find((l) => l.code === lang)?.locale || 'en-GB';

export function setLang(code) {
  if (!DICTS[code]) return;
  lang = code;
  try { localStorage.setItem(KEY, code); } catch { /* storage blocked */ }
  if (typeof document !== 'undefined') document.documentElement.lang = code;
}

const fill = (s, p) => (p ? s.replace(/\{(\w+)\}/g, (_, k) => (p[k] ?? `{${k}}`)) : s);

/** Translate an English string, filling {placeholders} from `params`. A `gameId` param becomes {game}. */
export function t(key, params) {
  const p = params && params.gameId ? { ...params, game: gameName(params.gameId) } : params;
  const s = DICTS[lang]?.strings?.[key] ?? key;
  return fill(s, p);
}

/** Numbers in the local style (1.000 / 1,000). */
export const num = (v) => Number(v).toLocaleString(locale());

const pickData = (field, id) => DICTS[lang]?.[field]?.[id] ?? en[field]?.[id];

export const gameName = (id) => pickData('games', id)?.name ?? id;
export const gameTagline = (id) => pickData('games', id)?.tagline ?? '';

/** The game's names in the other languages, for "Also called …". */
export function otherNames(id) {
  const mine = gameName(id);
  const seen = new Set([mine]);
  const out = [];
  for (const l of LANGS) {
    const n = (DICTS[l.code]?.games?.[id] ?? en.games[id])?.name;
    if (n && !seen.has(n)) { seen.add(n); out.push({ name: n, lang: l.label }); }
  }
  return out;
}

/** Rules text for a game in the current language: { goal, steps[], end }. */
export function rulesText(id, rules, helpers) {
  const fn = pickData('rules', id);
  return fn ? fn(rules, helpers) : null;
}

/** A built-in party prompt (by index), or a custom one (string), in the current language. */
export function promptText(kind, p) {
  if (typeof p === 'string') return p;
  return DICTS[lang]?.prompts?.[kind]?.[p] ?? en.prompts[kind][p] ?? '';
}

/** The default text for a Kongens kop card in the current language. */
export const kongensKopDefault = (k) => DICTS[lang]?.kongensKop?.[k] ?? en.kongensKop[k];
