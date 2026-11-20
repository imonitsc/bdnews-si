# bdnews Situation Intelligence (bdnews SI)

Live situation intelligence for Bangladesh and South Asia, served at https://bdnews.si.

bdnews SI is a modified version of [World Monitor](https://github.com/koala73/worldmonitor)
by Elie Habib and contributors, licensed under the GNU Affero General Public License v3.0
(AGPL-3.0-only). This repository is the corresponding source for the bdnews.si deployment
and is distributed under the same licence (see `LICENSE`).

- Upstream: https://github.com/koala73/worldmonitor
- Based on upstream commit: `c19b0256830bcc53aeed953db40ffa034e33d38f` (version 2.11.8)
- "World Monitor" is the upstream project's name; bdnews SI is not affiliated with or endorsed by it.

## Changes from upstream

- Branding: name, header, footer, page metadata and loading screen (`src/config/brand.ts`, `index.html`,
  `src/app/panel-layout.ts`, `src/config/variant-meta.ts`, `src/services/pwa-install.ts`, `src/bootstrap/boot-failure.ts`).
- Visible attribution "Based on World Monitor" and a "Source code (AGPL-3.0)" link in the header and footer.
- Map opens on Bangladesh / South Asia when the URL has no camera (`src/App.ts`).
- Regional intelligence board defaults to South Asia (`src/components/regional-intelligence-board-utils.ts`).
- Dhaka Tribune, Prothom Alo and bdnews24 enabled by default (`src/config/feeds.ts`).
- worldmonitor.app edition switcher, sibling-edition pages and Pro upsell banner turned off
  (`src/app/panel-layout.ts`, `vite.config.ts`, `src/App.ts`).
- `/` on bdnews.si serves the dashboard (`vercel.json`).
- Build: `scripts/generate-public-product-facts.mjs` no longer restates upstream product facts into
  `index.html`; the sibling-edition dashboard pages are skipped in `vite.config.ts`.

## Deploying

Vercel project with the repository's `vercel.json` (build command `npm run build:full`), plus an
Upstash Redis database (`UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`) and the data seeders
running on a schedule. See `SELF_HOSTING.md` for the data seeders and optional API keys.
- Live TV: Somoy TV, Jamuna TV, Channel 24, Independent TV, Ekattor TV and ATN News are the default
  Live News channels (`src/config/live-video-sources.ts`, `src/services/live-channels.ts`).
- News: 13 more Bangladeshi outlets (English and Bangla) in `shared/news-catalog.json`, on by default,
  with tiers, provenance, country tags and attribution rows. Upstream tests that pinned Dhaka Tribune,
  Prothom Alo and bdnews24 as opt-in were adjusted.
- Bangladesh News panel (`bangladesh`, right after Live News): stories from Bangladeshi outlets and
  stories about Bangladesh, gathered from every loaded news category (`src/config/bangladesh-news.ts`,
  `src/app/data-loader.ts`, `src/app/panel-layout.ts`).

## Terminal look (2026-11-20)
- `src/styles/terminal-theme.css` (imported unlayered from `base-layer.css`): black and amber terminal palette, square panels, amber title bars. Dark theme only.
- `src/app/terminal-bar.ts`, mounted from `panel-layout.ts`: command prompt (`BD`, `TV`, `MKT`, `MAP`, … then Enter; `/` focuses it), function keys that jump to panels, scrolling market ticker from the loaded quotes, and Dhaka/London/New York clocks.

## Logo (2026-11-20)
- New "BD." wordmark (Inter Display, SIL OFL) in `brand/`; header uses `src/config/brand-logo.ts`.
- Replaced the favicons, app icons and `og-image.png` in `public/favico/` with the new mark.
