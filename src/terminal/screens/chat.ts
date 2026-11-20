// BDSI terminal: CHAT — a running conversation with the BDSI Analyst (Claude).
// Each answer is grounded in fresh BDSI sources with citations; the last few
// turns are sent along so follow-up questions make sense. The conversation is
// kept only in this browser (localStorage). Shared team rooms are not built:
// they need a server-side message store, access control and an audit trail.

import type { Screen } from '../shell';
import { h, dhakaTime, stateBox } from '../dom';
import { ask, cited, type AskAnswer } from './ask';

const KEY = 'bdsi-chat-v1';
const MAX_TURNS = 30;
interface Turn { q: string; scope: string; at: number; answer?: AskAnswer; error?: string }

function load(): Turn[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(v) ? v.filter((t) => t && typeof t.q === 'string').slice(-MAX_TURNS) : [];
  } catch { return []; }
}
function save(turns: Turn[]): void {
  try { localStorage.setItem(KEY, JSON.stringify(turns.slice(-MAX_TURNS))); } catch { /* storage unavailable: chat lasts for this visit only */ }
}

/** The text sent back as context: answer plus points, without source lists. */
export function historyFor(turns: Turn[]): Array<{ q: string; a: string }> {
  return turns.filter((t) => t.answer).slice(-4).map((t) => ({
    q: t.q,
    a: [t.answer!.answer, ...t.answer!.points.map((p) => `- ${p.text}`)].join('\n'),
  }));
}

export const chatScreen: Screen = {
  code: 'CHAT',
  title: 'Analyst chat',
  mount(el, _args, ctx) {
    let turns = load();
    let busy = false;
    const log = h('div', { class: 'tp-chat-log', role: 'log', 'aria-live': 'polite' });
    const input = h('textarea', { class: 'tp-ask-input', rows: '2', placeholder: 'Ask about Bangladesh markets, the economy, security or energy. Enter to send, Shift+Enter for a new line.', 'aria-label': 'Message to the BDSI Analyst' }) as HTMLTextAreaElement;
    const scopeSel = h('select', { class: 'tp-select', 'aria-label': 'Topic focus' },
      ...[['all', 'ALL'], ['markets', 'MARKETS'], ['economy', 'ECONOMY'], ['security', 'SECURITY'], ['energy', 'ENERGY']].map(([v, l]) => h('option', { value: v }, l))) as HTMLSelectElement;
    const sendBtn = h('button', { class: 'tp-go', type: 'button' }, 'SEND');
    const clearBtn = h('button', { class: 'tp-go tp-btn-ghost', type: 'button' }, 'CLEAR');

    const renderTurn = (t: Turn): HTMLElement => {
      const you = h('div', { class: 'tp-chat-you' }, h('span', { class: 'tp-muted' }, `YOU · ${dhakaTime(t.at)} · ${t.scope.toUpperCase()}`), h('p', {}, t.q));
      let body: HTMLElement;
      if (t.error) body = stateBox('error', t.error);
      else if (!t.answer) body = stateBox('loading', 'Analyst is reading the latest BDSI sources…');
      else {
        const a = t.answer;
        body = h('div', {},
          h('p', { class: 'tp-w' }, ...cited(a.answer, a.sources)),
          a.points.length ? h('ul', {}, ...a.points.map((p) => h('li', {}, ...cited(p.text, a.sources), ...p.sources.filter((n) => !p.text.includes(`[${n}]`)).map((n) => document.createTextNode(` [${n}]`))))) : '',
          a.unknown.length ? h('p', { class: 'tp-muted' }, `Not confirmed by the sources: ${a.unknown.join(' · ')}`) : '',
          h('details', {}, h('summary', { class: 'tp-muted' }, `${a.sources.length} sources · ${a.model} · ${dhakaTime(Date.parse(a.generatedAt))}`),
            h('ol', { class: 'tp-src' }, ...a.sources.map((s) => h('li', {}, s.url ? h('a', { href: s.url, target: '_blank', rel: 'noopener noreferrer' }, s.title) : s.title, h('span', { class: 'tp-muted' }, ` · ${s.source}`))))),
          a.followups.length ? h('div', { class: 'tp-chips' }, ...a.followups.map((f) => {
            const b = h('button', { class: 'tp-chip', type: 'button' }, f);
            b.addEventListener('click', () => { input.value = f; void send(); });
            return b;
          })) : '');
      }
      return h('div', { class: 'tp-chat-turn' }, you, h('div', { class: 'tp-chat-ai' }, h('span', { class: 'tp-muted' }, 'BDSI ANALYST'), body));
    };

    const render = (): void => {
      log.replaceChildren(...(turns.length ? turns.map(renderTurn) : [stateBox('empty', 'No messages yet. Answers come only from BDSI data and news, with numbered citations; anything the sources cannot confirm is said plainly.')]));
      log.scrollTop = log.scrollHeight;
    };

    const send = async (): Promise<void> => {
      const q = input.value.trim();
      if (!q || busy) return;
      if (q.length > 500) { ctx.status('Message too long (500 characters max).', 'err'); return; }
      busy = true; sendBtn.setAttribute('disabled', '');
      const history = historyFor(turns);
      const turn: Turn = { q, scope: scopeSel.value, at: Date.now() };
      turns = [...turns, turn].slice(-MAX_TURNS);
      input.value = '';
      render();
      try { turn.answer = await ask(q, turn.scope, history); }
      catch (e) { turn.error = e instanceof Error ? e.message : 'The analyst could not answer.'; }
      busy = false; sendBtn.removeAttribute('disabled');
      save(turns.filter((t) => t.answer || t.error));
      render();
      input.focus();
    };

    sendBtn.addEventListener('click', () => { void send(); });
    clearBtn.addEventListener('click', () => { turns = []; save(turns); render(); ctx.status('Chat cleared from this browser.', 'info'); });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); }
      e.stopPropagation();
    });

    el.append(h('section', { class: 'tp-screen' },
      h('header', { class: 'tp-screen-head' }, h('span', { class: 'tp-logo-sm' }, 'CHAT'), h('h1', {}, 'ANALYST CHAT — FOLLOW-UP QUESTIONS WITH CITATIONS')),
      h('div', { class: 'tp-chat' }, log,
        h('div', { class: 'tp-chat-bar' }, input, h('div', { class: 'tp-chat-ctl' }, scopeSel, sendBtn, clearBtn)),
        h('p', { class: 'tp-muted' }, 'Kept only in this browser. Up to 20 questions per hour. Not investment advice. Shared team rooms are not available yet.'))));
    render();
    if (ctx.query) { input.value = ctx.query; void send(); } else input.focus();
    return () => { busy = false; };
  },
};
