// BDSI terminal: a screen that is designed but not built yet says so plainly.
import type { Screen } from '../shell';
import { h } from '../dom';

export function plannedScreen(code: string, title: string, what: string): Screen {
  return {
    code,
    title,
    mount(el, _args, ctx) {
      el.append(h('section', { class: 'tp-screen' },
        h('header', { class: 'tp-screen-head' }, h('span', { class: 'tp-logo-sm' }, code), h('h1', {}, title)),
        h('div', { class: 'tp-state tp-state-planned' }, `${what} This screen is being built; it will appear here when its data source is connected.`),
        h('p', {}, h('a', { href: '#/', onclick: (e: Event) => { e.preventDefault(); ctx.go(''); } }, '< Launchpad'))));
    },
  };
}
