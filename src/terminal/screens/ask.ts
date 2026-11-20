// BDSI terminal: ASK — AI analyst (Claude via /api/bd-ask). Answers cite numbered
// BDSI sources; what the sources cannot confirm is listed, never guessed.

import type { Screen } from '../shell';
import { h, dhakaTime, stateBox } from '../dom';
import { authClient } from '@/services/bdsi-auth';

export interface AskSource { n: number; kind: 'data' | 'news'; title: string; source: string; url: string; time: number | null }
export interface AskAnswer {
  question: string; scope: string; answer: string;
  points: Array<{ text: string; sources: number[] }>;
  unknown: string[]; followups: string[]; sources: AskSource[];
  model: string; generatedAt: string; structured: boolean;
}

const SCOPES: Array<[string, string]> = [['all', 'ALL'], ['markets', 'MARKETS'], ['economy', 'ECONOMY'], ['security', 'SECURITY'], ['energy', 'ENERGY']];
const RECENT_KEY = 'bdsi-ask-recent';
const BRIEFS: Array<{ label: string; q: string; scope: string }> = [
  { label: 'Morning brief', q: 'Give me a short morning brief on Bangladesh today: markets, the taka, prices and the main news.', scope: 'all' },
  { label: 'Market wrap', q: 'Summarise the latest Dhaka Stock Exchange session: indices, breadth and the biggest movers, and any news that explains them.', scope: 'markets' },
  { label: 'Security brief', q: 'What are the main security and unrest stories in Bangladesh in the latest news?', scope: 'security' },
  { label: 'Prices watch', q: 'Which essential goods in Dhaka changed price most over the past week and year?', scope: 'economy' },
];

function readRecent(): string[] {
  try { const v = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); return Array.isArray(v) ? v.filter((x) => typeof x === 'string').slice(0, 10) : []; } catch { return []; }
}
function saveRecent(q: string): void {
  try { localStorage.setItem(RECENT_KEY, JSON.stringify([q, ...readRecent().filter((x) => x !== q)].slice(0, 10))); } catch { /* storage unavailable */ }
}

const ERRORS: Record<string, string> = {
  sign_in_required: 'Your session has expired. Sign in again.',
  rate_limited: 'You have reached the hourly limit for the AI analyst. Try again later.',
  ai_not_configured: 'The AI analyst is not switched on yet (the server has no Anthropic API key).',
  no_sources: 'No BDSI data could be loaded right now, so the analyst cannot answer.',
  question_too_long: 'Please shorten the question (600 characters at most).',
};

export async function ask(question: string, scope: string, history: Array<{ q: string; a: string }> = []): Promise<AskAnswer> {
  const { data } = await authClient().auth.getSession();
  const token = data.session?.access_token;
  const r = await fetch('/api/bd-ask', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(history.length ? { question, scope, history } : { question, scope }),
    signal: AbortSignal.timeout(70_000),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(ERRORS[j.error] ?? `The AI analyst could not answer (${j.error ?? r.status}).`);
  return j as AskAnswer;
}

/** Render text with [n] markers turned into links to the source list. */
export function cited(text: string, sources: AskSource[]): Node[] {
  const out: Node[] = [];
  let last = 0;
  for (const m of text.matchAll(/\[(\d{1,2})\]/g)) {
    const n = Number(m[1]);
    out.push(document.createTextNode(text.slice(last, m.index)));
    const s = sources.find((x) => x.n === n);
    out.push(s ? h('a', { href: `#ask-src-${n}`, class: 'tp-cite', title: `${s.source}: ${s.title}` }, `[${n}]`) : document.createTextNode(m[0]));
    last = (m.index ?? 0) + m[0].length;
  }
  out.push(document.createTextNode(text.slice(last)));
  return out;
}

export const askScreen: Screen = {
  code: 'ASK',
  title: 'AI analyst',
  mount(el, _args, ctx) {
    let scope = 'all';
    let busy = false;
    const left = h('aside', { class: 'tp-ask-left' });
    const center = h('div', { class: 'tp-ask-center', 'aria-live': 'polite' });
    const right = h('aside', { class: 'tp-ask-right' }, h('div', { class: 'tp-stat-k' }, 'SOURCES USED'), h('p', { class: 'tp-muted' }, 'Sources appear here with each answer.'));
    const input = h('textarea', { class: 'tp-ask-input', rows: '2', maxlength: '600', placeholder: 'Ask the BDSI analyst about Bangladesh markets, economy, security or energy…', 'aria-label': 'Question for the AI analyst' }) as HTMLTextAreaElement;
    const scopeRow = h('div', { class: 'tp-chips', role: 'group', 'aria-label': 'Scope' });
    const renderScopes = () => scopeRow.replaceChildren(h('span', { class: 'tp-muted' }, 'Scope:'), ...SCOPES.map(([id, label]) =>
      h('button', { type: 'button', class: `tp-chip${scope === id ? ' on' : ''}`, 'aria-pressed': scope === id ? 'true' : 'false', onclick: () => { scope = id; renderScopes(); } }, label)));
    renderScopes();
    const submit = h('button', { type: 'submit', class: 'tp-go' }, 'ASK');
    const form = h('form', { class: 'tp-ask-form' }, scopeRow, h('div', { class: 'tp-ask-row' }, input, submit));

    const renderLeft = () => left.replaceChildren(
      h('button', { type: 'button', class: 'tp-chip on', onclick: () => { input.value = ''; input.focus(); } }, '+ NEW QUESTION'),
      h('div', { class: 'tp-stat-k' }, 'RECENT'),
      ...(readRecent().length ? readRecent().map((q) => h('button', { type: 'button', class: 'tp-linkbtn tp-ask-recent', onclick: () => run(q) }, q)) : [h('p', { class: 'tp-muted' }, 'No questions yet.')]),
      h('div', { class: 'tp-stat-k' }, 'BRIEFS'),
      ...BRIEFS.map((b) => h('button', { type: 'button', class: 'tp-linkbtn tp-ask-recent', onclick: () => { scope = b.scope; renderScopes(); run(b.q); } }, b.label)));

    const renderAnswer = (a: AskAnswer) => {
      center.replaceChildren(...([
        h('h2', { class: 'tp-ask-q' }, a.question),
        h('div', { class: 'tp-ask-by' }, 'BDSI ANALYST', h('span', { class: 'tp-muted' }, ` · ${a.model} · ${dhakaTime(Date.parse(a.generatedAt))} DHK · scope ${a.scope.toUpperCase()}`)),
        h('p', { class: 'tp-ask-answer' }, ...cited(a.answer, a.sources)),
        a.points.length ? h('ul', { class: 'tp-ask-points' }, ...a.points.map((p) => h('li', {}, ...cited(p.text, a.sources),
          ...p.sources.filter((n) => !p.text.includes(`[${n}]`)).map((n) => h('a', { href: `#ask-src-${n}`, class: 'tp-cite' }, ` [${n}]`))))) : null,
        a.unknown.length ? h('div', { class: 'tp-ask-unknown' }, h('div', { class: 'tp-stat-k' }, 'NOT CONFIRMED BY THE SOURCES'), h('ul', {}, ...a.unknown.map((u) => h('li', {}, u)))) : null,
        a.followups.length ? h('div', { class: 'tp-chips' }, h('span', { class: 'tp-muted' }, 'Follow up:'), ...a.followups.map((f) => h('button', { type: 'button', class: 'tp-chip', onclick: () => run(f) }, f))) : null,
        h('div', { class: 'tp-chips' },
          h('button', { type: 'button', class: 'tp-chip', onclick: () => {
            const txt = `${a.question}\n\n${a.answer}\n${a.points.map((p) => `• ${p.text}`).join('\n')}\n\nSources:\n${a.sources.map((s) => `[${s.n}] ${s.title} — ${s.source} ${s.url}`).join('\n')}`;
            void navigator.clipboard?.writeText(txt).then(() => ctx.status('Answer copied with sources', 'info'), () => ctx.status('Copy failed', 'err'));
          } }, 'COPY WITH SOURCES')),
        h('p', { class: 'tp-source' }, 'AI-generated from the sources listed. It can be wrong: check the sources before relying on it. Not investment advice.'),
      ].filter(Boolean) as Node[]));
      right.replaceChildren(h('div', { class: 'tp-stat-k' }, 'SOURCES USED'),
        h('ol', { class: 'tp-ask-sources' }, ...a.sources.map((s) => h('li', { id: `ask-src-${s.n}` },
          h('a', { href: s.url, target: '_blank', rel: 'noopener noreferrer' }, s.title),
          h('div', { class: 'tp-muted' }, `${s.source}${s.time ? ` · ${dhakaTime(s.time)} DHK` : ''}`)))));
    };

    const run = (q: string) => {
      const question = q.trim();
      if (!question || busy) return;
      busy = true;
      submit.setAttribute('disabled', '');
      input.value = question;
      saveRecent(question);
      renderLeft();
      center.replaceChildren(h('h2', { class: 'tp-ask-q' }, question), stateBox('loading', 'The analyst is reading BDSI data and the latest Bangladesh news…'));
      ask(question, scope)
        .then(renderAnswer)
        .catch((e: Error) => { center.replaceChildren(h('h2', { class: 'tp-ask-q' }, question), stateBox('error', e.message)); })
        .finally(() => { busy = false; submit.removeAttribute('disabled'); });
    };
    form.addEventListener('submit', (e) => { e.preventDefault(); run(input.value); });
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); run(input.value); } });

    center.append(h('h2', { class: 'tp-ask-q' }, 'Ask about Bangladesh'),
      h('p', { class: 'tp-dim' }, 'Every answer cites its sources. Numbers come from BDSI data (DSE, Bangladesh Bank, TCB) and the latest Bangladesh headlines — never invented. Try a brief on the left, or type below.'));
    renderLeft();
    el.append(h('section', { class: 'tp-screen' },
      h('header', { class: 'tp-screen-head' }, h('span', { class: 'tp-logo-sm' }, 'ASK'), h('h1', {}, 'BDSI AI ANALYST'),
        h('span', { class: 'tp-muted' }, 'Every answer cites its sources · numbers come from BDSI data, never invented')),
      h('div', { class: 'tp-ask' }, left, h('div', { class: 'tp-ask-main' }, center, form), right)));
    if (ctx.query) run(ctx.query);
    else input.focus();
  },
};
