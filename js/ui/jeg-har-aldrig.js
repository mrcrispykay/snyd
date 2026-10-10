// Jeg har aldrig screen.
import { esc } from './common.js';

export function howTo() {
  return `
    <li>A prompt appears: “Never have I ever …”</li>
    <li>Everyone answers in secret: <b>I have</b> or <b>Never</b>.</li>
    <li>When everyone has answered, the answers are shown. Everyone who has done it drinks.</li>`;
}

export const rulesSummary = (r) => [r.builtIn ? 'built-in prompts' : null, r.extra.trim() ? 'own prompts' : null].filter(Boolean).join(' · ') || 'own prompts';
export const isMyTurn = (g, me) => g.phase === 'answering' && !g.answered.includes(me) && g.players.includes(me);

export function render(g, ctx) {
  const prompt = `<div class="prompt card"><p class="eyebrow">Round ${g.round} · Never have I ever</p><p class="prompt-text">${esc(g.prompt)}.</p></div>`;
  if (g.phase === 'answering') {
    const seated = g.players.includes(ctx.me);
    const left = g.players.filter((p) => !g.answered.includes(p));
    return `${prompt}
      ${seated ? `<div class="act-row">
        <button class="btn btn-snyd ${g.mine === true ? 'chosen' : ''}" data-g="has" aria-pressed="${g.mine === true}">I have</button>
        <button class="btn ${g.mine === false ? 'chosen' : ''}" data-g="never" aria-pressed="${g.mine === false}">Never</button>
      </div>` : ''}
      <p class="waiting">${left.length ? `Waiting for ${left.map(ctx.name).join(', ')}` : 'Revealing…'}</p>
      ${ctx.isHost && g.answered.length ? '<button class="btn btn-quiet btn-small" data-g="reveal">Reveal now</button>' : ''}`;
  }
  const have = g.players.filter((p) => g.answers[p] === true);
  const never = g.players.filter((p) => g.answers[p] === false);
  return `${prompt}
    <div class="card reveal-head ${have.length ? 'fails' : 'holds'}">
      <p class="verdict">${have.length ? `${have.length} drink${have.length === 1 ? 's' : ''}` : 'Nobody has!'}</p>
    </div>
    <div class="two-col">
      <div><p class="eyebrow">Have</p><ul class="names">${have.map((p) => `<li>${ctx.name(p)}</li>`).join('') || '<li class="muted">nobody</li>'}</ul></div>
      <div><p class="eyebrow">Never</p><ul class="names">${never.map((p) => `<li>${ctx.name(p)}</li>`).join('') || '<li class="muted">nobody</li>'}</ul></div>
    </div>
    <button class="btn btn-primary btn-block" data-g="next">Next prompt</button>`;
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
