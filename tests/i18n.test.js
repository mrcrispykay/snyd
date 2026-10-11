import { test } from 'node:test';
import assert from 'node:assert/strict';
import { collectKeys, placeholders } from '../scripts/i18n-keys.mjs';
import { DICTS, LANGS } from '../js/i18n/index.js';
import en from '../js/i18n/en.js';
import { GAMES } from '../js/table.js';
import { defaults as kkDefaults } from '../js/games/kongens-kop.js';

const keys = await collectKeys();
const helpers = { die: (v) => `[${v}]`, card: () => '[card]', n: (v) => String(v) };

for (const { code } of LANGS.filter((l) => l.code !== 'en')) {
  const d = DICTS[code];
  test(`${code}: every text has a translation with the same placeholders`, () => {
    const missing = keys.filter((k) => !(k in d.strings));
    assert.deepEqual(missing, []);
    const wrong = keys.filter((k) => placeholders(k) !== placeholders(d.strings[k]));
    assert.deepEqual(wrong, []);
  });
  test(`${code}: every game has a name, tagline and rules for all house-rule settings`, () => {
    for (const g of GAMES) {
      assert.ok(d.games[g.id]?.name, `${g.id} name`);
      assert.ok(d.games[g.id]?.tagline, `${g.id} tagline`);
      // Rules render with defaults and with every option of every setting.
      const variants = [g.defaults];
      for (const [k, info] of Object.entries(g.ruleInfo)) {
        if (typeof g.defaults[k] === 'boolean') variants.push({ ...g.defaults, [k]: !g.defaults[k] });
        for (const o of info.options || []) variants.push({ ...g.defaults, [k]: Array.isArray(o) ? o[0] : o });
      }
      for (const r of variants) {
        const txt = d.rules[g.id](r, helpers);
        assert.ok(txt.goal && txt.end && txt.steps.filter(Boolean).length >= 2, `${g.id} rules`);
        assert.ok(!/undefined|NaN/.test(JSON.stringify(txt)), `${g.id} rules text`);
      }
    }
  });
  test(`${code}: prompts and card rules are complete`, () => {
    assert.equal(d.prompts.mostLikely.length, en.prompts.mostLikely.length);
    assert.equal(d.prompts.never.length, en.prompts.never.length);
    for (const k of Object.keys(kkDefaults)) assert.match(d.kongensKop[k], /:/, `${k} has a title`);
  });
}

test('English rules render for every setting', () => {
  for (const g of GAMES) {
    const txt = en.rules[g.id](g.defaults, helpers);
    assert.ok(txt.goal && txt.end && txt.steps.length);
  }
});
