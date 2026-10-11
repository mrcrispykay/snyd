// Mest sandsynligt screen.
import { t, promptText } from '../i18n/index.js';
import { esc } from './common.js';

export const rulesSummary = (r) => [r.builtIn ? t('built-in prompts') : null, r.extra.trim() ? t('own prompts') : null, r.selfVote ? t('self-votes allowed') : null].filter(Boolean).join(' · ') || t('own prompts');
export const isMyTurn = (g, me) => g.phase === 'voting' && !g.voted.includes(me) && g.players.includes(me);

export function render(g, ctx) {
  const prompt = `<div class="prompt card"><p class="eyebrow">${t('Round {n} · Who is most likely to', { n: g.round })}</p><p class="prompt-text">${esc(promptText('mostLikely', g.prompt))}?</p></div>`;
  if (g.phase === 'voting') {
    const seated = g.players.includes(ctx.me);
    const left = g.players.filter((p) => !g.voted.includes(p));
    const buttons = seated
      ? `<div class="vote-grid">${g.players.filter((p) => g.rules.selfVote || p !== ctx.me).map((p) => `<button class="vote ${g.mine === p ? 'on' : ''}" data-g="vote" data-id="${p}" aria-pressed="${g.mine === p}">${ctx.name(p)}</button>`).join('')}</div>`
      : '';
    return `${prompt}${buttons}
      <p class="waiting">${left.length ? t('Waiting for {names}', { names: left.map(ctx.name).join(', ') }) : t('Counting…')}</p>
      ${ctx.isHost && g.voted.length ? `<button class="btn btn-quiet btn-small" data-g="reveal">${t('Reveal now')}</button>` : ''}`;
  }
  const tl = g.tally;
  const rows = Object.entries(tl.counts).sort((a, b) => b[1] - a[1]).map(([p, n]) => `
    <li class="tally-row ${tl.drink.includes(p) ? 'top' : ''}"><span class="pname">${ctx.name(p)}</span><span class="bar" style="--w:${(n / tl.top) * 100}%"></span><b>${n}</b></li>`).join('');
  const whoDrinks = tl.drink.length === 1 && tl.drink[0] === ctx.me ? t('You drink!')
    : t('{names} drink!', { names: tl.drink.map((p) => (p === ctx.me ? t('you') : ctx.name(p))).join(' & ') });
  return `${prompt}<div class="card reveal-head fails"><p class="verdict">${whoDrinks}</p></div>
    <ul class="tally">${rows}</ul>
    <button class="btn btn-primary btn-block" data-g="next">${t('Next prompt')}</button>`;
}

export function handle(el) {
  switch (el.dataset.g) {
    case 'vote': return { type: 'vote', target: el.dataset.id };
    case 'reveal': return { type: 'reveal' };
    case 'next': return { type: 'next' };
    default: return null;
  }
}
