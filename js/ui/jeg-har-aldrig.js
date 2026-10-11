// Jeg har aldrig screen.
import { t, promptText } from '../i18n/index.js';
import { esc } from './common.js';

export const rulesSummary = (r) => [r.builtIn ? t('built-in prompts') : null, r.extra.trim() ? t('own prompts') : null].filter(Boolean).join(' · ') || t('own prompts');
export const isMyTurn = (g, me) => g.phase === 'answering' && !g.answered.includes(me) && g.players.includes(me);

export function render(g, ctx) {
  const prompt = `<div class="prompt card"><p class="eyebrow">${t('Round {n} · Never have I ever', { n: g.round })}</p><p class="prompt-text">${esc(promptText('never', g.prompt))}.</p></div>`;
  if (g.phase === 'answering') {
    const seated = g.players.includes(ctx.me);
    const left = g.players.filter((p) => !g.answered.includes(p));
    return `${prompt}
      ${seated ? `<div class="act-row">
        <button class="btn btn-snyd ${g.mine === true ? 'chosen' : ''}" data-g="has" aria-pressed="${g.mine === true}">${t('I have')}</button>
        <button class="btn ${g.mine === false ? 'chosen' : ''}" data-g="never" aria-pressed="${g.mine === false}">${t('Never')}</button>
      </div>` : ''}
      <p class="waiting">${left.length ? t('Waiting for {names}', { names: left.map(ctx.name).join(', ') }) : t('Revealing…')}</p>
      ${ctx.isHost && g.answered.length ? `<button class="btn btn-quiet btn-small" data-g="reveal">${t('Reveal now')}</button>` : ''}`;
  }
  const have = g.players.filter((p) => g.answers[p] === true);
  const never = g.players.filter((p) => g.answers[p] === false);
  const nobody = `<li class="muted">${t('nobody')}</li>`;
  return `${prompt}
    <div class="card reveal-head ${have.length ? 'fails' : 'holds'}">
      <p class="verdict">${have.length ? t('{n} drink', { n: have.length }) : t('Nobody has!')}</p>
    </div>
    <div class="two-col">
      <div><p class="eyebrow">${t('Have')}</p><ul class="names">${have.map((p) => `<li>${ctx.name(p)}</li>`).join('') || nobody}</ul></div>
      <div><p class="eyebrow">${t('Never')}</p><ul class="names">${never.map((p) => `<li>${ctx.name(p)}</li>`).join('') || nobody}</ul></div>
    </div>
    <button class="btn btn-primary btn-block" data-g="next">${t('Next prompt')}</button>`;
}

export function handle(el) {
  switch (el.dataset.g) {
    case 'has': return { type: 'answer', has: true };
    case 'never': return { type: 'answer', has: false };
    case 'reveal': return { type: 'reveal' };
    case 'next': return { type: 'next' };
    default: return null;
  }
}
