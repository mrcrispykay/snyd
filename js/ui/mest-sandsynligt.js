// Mest sandsynligt screen.
import { esc } from './common.js';

export function howTo(r) {
  return `
    <li>A prompt appears: “Who is most likely to …?”</li>
    <li>Everyone votes in secret on their own phone${r.selfVote ? '' : ' (not for yourself)'}.</li>
    <li>When everyone has voted, the votes are shown. Whoever got the most votes drinks.</li>`;
}

export const rulesSummary = (r) => [r.builtIn ? 'built-in prompts' : null, r.extra.trim() ? 'own prompts' : null, r.selfVote ? 'self-votes allowed' : null].filter(Boolean).join(' · ') || 'own prompts';
export const isMyTurn = (g, me) => g.phase === 'voting' && !g.voted.includes(me) && g.players.includes(me);

export function render(g, ctx) {
  const prompt = `<div class="prompt card"><p class="eyebrow">Round ${g.round} · Who is most likely to</p><p class="prompt-text">${esc(g.prompt)}?</p></div>`;
  if (g.phase === 'voting') {
    const seated = g.players.includes(ctx.me);
    const left = g.players.filter((p) => !g.voted.includes(p));
    const buttons = seated
      ? `<div class="vote-grid">${g.players.filter((p) => g.rules.selfVote || p !== ctx.me).map((p) => `<button class="vote ${g.mine === p ? 'on' : ''}" data-g="vote" data-id="${p}" aria-pressed="${g.mine === p}">${ctx.name(p)}</button>`).join('')}</div>`
      : '';
    return `${prompt}${buttons}
      <p class="waiting">${left.length ? `Waiting for ${left.map(ctx.name).join(', ')}` : 'Counting…'}</p>
      ${ctx.isHost && g.voted.length ? '<button class="btn btn-quiet btn-small" data-g="reveal">Reveal now</button>' : ''}`;
  }
  const t = g.tally;
  const rows = Object.entries(t.counts).sort((a, b) => b[1] - a[1]).map(([p, n]) => `
    <li class="tally-row ${t.drink.includes(p) ? 'top' : ''}"><span class="pname">${ctx.name(p)}</span><span class="bar" style="--w:${(n / t.top) * 100}%"></span><b>${n}</b></li>`).join('');
  const who = t.drink.map((p) => (p === ctx.me ? 'You' : ctx.name(p))).join(' and ');
  return `${prompt}<div class="card reveal-head fails"><p class="verdict">${who} drink${t.drink.length === 1 && t.drink[0] !== ctx.me ? 's' : ''}!</p></div>
    <ul class="tally">${rows}</ul>
    <button class="btn btn-primary btn-block" data-g="next">Next prompt</button>`;
}

export function handle(el) {
  switch (el.dataset.g) {
    case 'vote': return { type: 'vote', target: el.dataset.id };
    case 'reveal': return { type: 'reveal' };
    case 'next': return { type: 'next' };
    default: return null;
  }
}
