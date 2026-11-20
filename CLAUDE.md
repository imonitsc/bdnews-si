# CLAUDE.md — BD Situation Intelligence (bdnews.si)

Instructions for Claude when working in this repository. Read this file fully before making changes.

---

## 1. What this project is

**BD Situation Intelligence** (https://www.bdnews.si) is a Bloomberg-Terminal-style intelligence product focused on **Bangladesh**: markets, macro data, news, security risk, disasters, and maritime/air awareness.

- Repo: `github.com/imonitsc/bdnews-si`, licensed **AGPL-3.0**.
- It is a fork of **World Monitor** (`koala73/worldmonitor`, AGPL-3.0-only, by Elie Habib).
- Current UI: black/amber terminal theme, F-key bar (F1 BD News … F8 World), `BDNEWS> <GO>` command line, MapLibre map with layers, right-hand panels (Live TV, DSE, Taka rates, Bazaar prices), country brief side panel, ⌘K command deck.

### The goal
Turn this from "a global dashboard with Bangladesh panels" into **a Bangladesh-first data terminal** that can be sold as:

| Plan | Audience |
|---|---|
| Free | Public, students — delayed data, headlines, basic map |
| Pro | Retail investors, journalists — real-time DSE/CSE, `TICKER <GO>`, alerts, AI brief |
| Business | Brokers, banks, exporters, NGOs — macro/trade/ports/energy, exports, API |
| Enterprise / Embassy | Multinationals, embassies, insurers, UN — full security/risk module, SLA |
| Government / Defence | Ministries, armed forces, police, disaster management — on-prem, audit, custom layers |

Everything you build should move the product toward these plans.

---

## 2. Before you change anything

1. **Explore first.** Inspect the repo structure, `package.json`, build scripts, and how panels, layers, commands and data fetchers are registered. Do not assume file paths from this document — find the real ones.
2. **Find how upstream World Monitor does it.** Most features (panels, layers, country briefs, command deck) already have a pattern. Follow the existing pattern instead of inventing a new one.
3. **Run the app and tests locally** before and after your change (`npm run typecheck`, `npm run build`, and any test script present).
4. **Keep changes small and focused.** One feature or fix per change. Explain what you changed and why.

---

## 3. Hard rules (never break these)

### 3.1 Licensing
- This codebase is **AGPL-3.0**. Any modified version we run as a service must have its source available to users. Do **not** add code that hides or obfuscates source, and keep the footer "Source code (AGPL-3.0)" link working.
- **Before adding any dependency or dataset, check its licence** and record it in `docs/THIRD_PARTY.md` (create if missing) with: name, URL, licence, how we use it, attribution required.
- Licence verdicts:
  - **Green (OK to embed):** MIT, Apache-2.0, BSD, ISC, CC0, ODbL (with attribution), GDELT, Copernicus, NASA open data.
  - **Amber (separate service only):** GPL/AGPL tools (e.g. MISP, IntelOwl, readsb, tar1090, AIS-catcher, theHarvester). Run them as separate containers/services that talk over an API; do not copy their code into our core.
  - **Red (do not ship in paid tiers without a signed licence):** BanglaBERT (CC BY-NC-SA), Global Fishing Watch API (non-commercial), OpenSky API (non-commercial), ACLED (corporate/public-sector licence required), adsb.fi (non-commercial). You may build a feature flag for these but keep them **off** by default and gated behind `LICENSED_*` env flags.
- Use **OpenBB V5+ only** (Apache-2.0); never V4 or earlier (AGPL).
- **TradingView Lightweight Charts** is Apache-2.0 but requires attribution — keep `attributionLogo` enabled or add the TradingView notice and link.
- Never use `tile.openstreetmap.org` for production tiles. Use our own tile server or a licensed provider. Always show "© OpenStreetMap contributors".

### 3.2 Branding
- Remove remaining **"World Monitor" / "WM"** branding from user-facing UI (e.g. country brief header "WORLD MONITOR · COUNTRY BRIEF", command deck "WM // INTELLIGENCE COMMAND DECK") and replace with **"BD Situation Intelligence"** / **"BDSI"**.
- Keep upstream copyright notices in source files and the LICENSE file intact.

### 3.3 Privacy and safety
- **Do not build features that profile private individuals** (username enumeration across social sites, phone/email lookups of people, home address finding, face matching). The product covers events, places, infrastructure, companies, and public officials acting in public roles.
- Never put personal data in URLs or query strings.
- No secrets in code. All API keys go in environment variables, documented in `.env.example` with placeholder values.
- Scraped data must respect `robots.txt` and rate limits; add a user agent that identifies BDSI.

### 3.4 Data honesty
- **Every panel must show its source and a "last updated" timestamp.**
- Stale data must be visibly flagged (e.g. amber "STALE" badge) — never silently shown as current.
- If a source fails, **hide the panel or show a clear "source unavailable" state** instead of an empty "No data" box or an endless "Loading…".
- Never fabricate, interpolate or "fill in" numbers. Label estimates as estimates.

---

## 4. Known problems to fix first (Phase 0 — credibility)

Found on the live site on 20 Nov 2026. Treat these as the top of the backlog:

1. **Command line does nothing useful.** `GP <GO>` returns `UNKNOWN COMMAND`. Build a command parser (see §6).
2. **F-keys only scroll the right panel.** Each F-key should open a full-screen view.
3. **Bangladesh News panel stuck on "Loading…".** Fix the feed; add timeout + error state.
4. **AI Insights "Unavailable"**, and its focal point was the **UAE**, not Bangladesh. Default focus must be Bangladesh.
5. **Threat Timeline "cached – degraded".** Fix the source or mark it clearly.
6. **Bangladesh country brief:** Instability Index **unavailable for Bangladesh**, Resilience scorecard unavailable, 4 sections unavailable. Make Bangladesh's brief complete.
7. **Security brief:** naval vessels, live AIS and fleet roster unavailable.
8. **Empty panels:** Live News, Armed Conflict, Internet Disruptions, Fires ("No data"); Bazaar Prices blank; UKMTO stale.
9. **Map clutter:** about 40 global layers (Canada Roads, Canada Alerts, Spaceports, Orbital Surveillance, etc.). Create a **Bangladesh layer preset** as the default and move global layers under an "Advanced / Global" group.
10. **Mission workspaces are generic** (Tech/AI Watcher, Good News Explorer). Replace with: *Investor*, *Exporter / RMG*, *Security & Risk*, *Policy & Macro*, *Disaster Response*.
11. **Premium flow bug:** a logged-in user still sees "Sign in to unlock premium resilience scores". Fix entitlement checks.
12. **Webcams:** F1 shows Tokyo/Seoul webcams. Replace with Bangladesh-relevant feeds or remove.

---

## 5. Product modules to build

### 5.1 Markets (Pro tier core)
- `TICKER <GO>` page for every DSE and CSE instrument: LTP, change, intraday chart, historical OHLC chart, volume, P/E, NAV, EPS, dividends, shareholding (sponsor/institution/foreign/public), price-sensitive disclosures, related news.
- Market overview: DSEX / DS30 / DSES, turnover, advancers/decliners, sector heatmap (banks, pharma, textiles, telecom, fuel & power, etc.), block trades, circuit-breaker hits.
- Watchlists, price/volume/news alerts, screener (P/E, yield, sector, market cap).
- Fixed income: T-bill/T-bond auctions, yield curve, call money, repo, sukuk.
- Bank sector: NPL ratios, capital adequacy, Bangladesh Bank actions.
- FX: Bangladesh Bank rate vs kerb/remittance rates; reserves trend (gross and BPM6).
- **Data:** prototype with `rochi88/bdshare` (MIT), `shhossain/bdfinance` (MIT), `ofsazib/dse-mcp` (MIT). These scrape dsebd.org; production paid tiers need a **DSE/CSE data-vendor agreement** — keep the data layer swappable behind one interface (`MarketDataProvider`).
- **Charts:** TradingView Lightweight Charts (Apache-2.0, attribution required).

### 5.2 Macro & trade
- Commands: `CPI`, `GDP`, `REMIT`, `EXP`, `IMP`, `RES`, `BB` (Bangladesh Bank), `BUDGET`, `ADP`, `IMF`.
- Sources: Bangladesh Bank, BBS, EPB, Ministry of Finance. Store full history; chart it.
- `RMG <GO>`: garment exports by market, factory unrest, wage-board updates, brand/buyer news.
- `PORT <GO>`: Chattogram and Mongla vessel queue, container dwell time, off-dock status.
- `POWER <GO>`: daily demand vs generation, load-shedding (PGCB), gas supply (Petrobangla), LNG cargoes, fuel prices.
- Bazaar prices: rice, onion, edible oil, sugar, eggs, etc. (TCB / DAM). Fix the empty panel.

### 5.3 Security & risk (Enterprise / Government)
- **Bangladesh Instability Index** by division and district, updated daily, with a published methodology page.
- Hartals, blockades, rallies, clashes — geotagged from Bangla + English news (GDELT now; ACLED when licensed).
- Myanmar border / Rakhine watch: border incidents, refugee inflows, Naf river.
- Rohingya camps (Cox's Bazar, Bhasan Char): population, incidents, funding, disease (UNHCR/IOM).
- India border incidents and land-port status (Benapole, Burimari, etc.).
- Internet shutdowns/throttling (BTRC notices + measurement data).
- Bangla disinformation monitor: trending narratives, flagged rumours, fact-check links. Archive evidence with Bellingcat Auto Archiver (MIT).

### 5.4 Maritime & air awareness (Government / Defence)
- Bay of Bengal map: EEZ overlay, fishing-ban periods, piracy/robbery reports.
- AIS: own receivers via **AIS-catcher** (GPL-3.0, separate service) at Chattogram, Mongla, Cox's Bazar + a licensed satellite AIS provider.
- Dark-vessel detection: **Sentinel-1 radar** (Copernicus, free commercial use) matched against AIS. Global Fishing Watch only with a custom licence.
- Aircraft: own receivers via **readsb + tar1090** (GPL, separate service). OpenSky only with a commercial plan.

### 5.5 Disaster & climate
- Cyclone tracks and signals (BMD), flood forecasts (FFWC), river levels, landslide risk (hill districts).
- Fires/hotspots: **NASA FIRMS** (open data).
- Flood extent: Sentinel-1.
- Heatwave, Dhaka AQI.
- Impact overlay: population, schools, hospitals, shelters inside alert zones (OpenStreetMap, ODbL).

### 5.6 News pipeline
- Crawl ~50 Bangla and English outlets with **trafilatura** (Apache-2.0, use v1.8+).
- Tag entities with **BNLP** (`sagorbrur/bnlp`, MIT). Do **not** use BanglaBERT in paid tiers (CC BY-NC-SA).
- Link stories to tickers, districts, ministries, companies (e.g. a Grameenphone story appears on `GP <GO>`).
- Watch government sites (Bangladesh Bank circulars, BTRC, BMD, FFWC, ministries) with **changedetection.io** (Apache-2.0) → alerts + AI summaries.
- Supplement with **GDELT** (free incl. commercial; must cite GDELT).

### 5.7 AI analyst
- Daily Bangladesh morning brief (Bangla + English), deliverable by email/WhatsApp.
- "Ask the terminal": plain-language answers **with citations to sources** for every claim.
- Auto reports per district/sector, exportable as PDF/DOCX.
- The AI must never invent numbers; if data is missing it says so.

### 5.8 Government edition
- Deployment: dedicated cloud, **on-prem / air-gapped**, Bangladesh data residency.
- Access: SSO (SAML/OIDC), role-based permissions, per-unit workspaces, mandatory MFA.
- Full **audit log** (search, view, export) and **watermarked exports**.
- Custom private layers that never leave the customer deployment.
- Geofenced alerts (email, SMS, webhook).
- Optional separate services: OpenCTI Community Edition (Apache-2.0) for cyber, Aleph/OpenAleph (MIT) for company/people-in-public-role records, MISP (AGPL, separate) for threat sharing, IntelOwl (AGPL, separate) for IOC enrichment.

---

## 6. Command line specification

The `BDNEWS>` command line is the heart of the terminal.

- Syntax: `<MNEMONIC> [ARGS] <GO>`; Enter = `<GO>`. Case-insensitive.
- **Autocomplete** as the user types: tickers, company names (Bangla + English), districts, functions.
- `HELP <GO>` lists all functions; `HELP <FUNC> <GO>` explains one.
- Unknown input → suggest the closest matches instead of just "UNKNOWN COMMAND".
- Command registry must be a single typed table (mnemonic, description, args, handler, required plan tier) so new commands are one entry.

Initial commands:

| Command | Opens |
|---|---|
| `<TICKER> <GO>` (e.g. `GP`, `SQURPHARMA`) | Stock page |
| `DSE`, `CSE` | Market overview |
| `SCRN` | Stock screener |
| `WL` | Watchlists |
| `ALRT` | Alerts manager |
| `BB` | Bangladesh Bank dashboard |
| `CPI`, `GDP`, `REMIT`, `EXP`, `IMP`, `RES` | Macro series |
| `FX` | Taka rates |
| `YC` | Yield curve |
| `RMG` | Garment sector |
| `PORT` | Ports & logistics |
| `POWER` | Energy & load-shedding |
| `BAZAR` | Commodity prices |
| `RISK [district]` | Instability / risk view |
| `BORDER` | Border watch |
| `SEA` | Bay of Bengal maritime |
| `WX`, `FLOOD`, `CYCLONE` | Disaster views |
| `NEWS [topic]` | News search |
| `BRIEF` | AI morning brief |
| `ASK <question>` | AI analyst |
| `HELP` | Help |

Keyboard: F-keys open full screens; `Esc` closes; `Ctrl/⌘+K` opens command deck; arrow keys move between panels. Everything must be usable without a mouse.

---

## 7. Engineering standards

- **TypeScript strict.** No `any` without a comment explaining why.
- **Each data source = one adapter module** with: typed output, timeout, retry with backoff, caching TTL, `lastUpdated`, `source`, `licence`, and a health status (`ok | stale | down`).
- Adapters are swappable behind interfaces (e.g. `MarketDataProvider`, `NewsProvider`, `AISProvider`) so a scraper can later be replaced by a licensed feed without UI changes.
- **Feature flags / entitlements:** every premium feature checks the user's plan through one entitlement service. No plan checks scattered in components.
- **i18n:** all user-facing strings go through the i18n layer; support **English and Bangla**. Bangla numerals and Taka formatting (৳, lakh/crore) must be correct.
- **Timezone:** display Dhaka time (Asia/Dhaka, UTC+6) by default; store UTC.
- **Performance:** first meaningful paint < 3 s on a 4G connection; panels load independently (one failing source must never block others).
- **Accessibility:** keyboard navigation, focus states, sufficient contrast on the amber/black theme.
- **Tests:** unit tests for every adapter (with recorded fixtures, no live network in CI), parser tests for the command line, and a smoke test that the app builds and the main view renders.
- **Feed health page** (`/status`): lists every source with status, last success, and error count.

---

## 8. Definition of done (for every change)

- [ ] Builds and type-checks; tests pass; new code has tests.
- [ ] No new "No data" / endless "Loading…" states — failures are handled visibly.
- [ ] Source + last-updated shown for any new data.
- [ ] New dependency or dataset recorded in `docs/THIRD_PARTY.md` with licence verdict.
- [ ] No secrets committed; `.env.example` updated if new env vars.
- [ ] Strings localised (EN + BN).
- [ ] Entitlement check applied if the feature is premium.
- [ ] Short summary of what changed, why, and how to verify.

---

## 9. Roadmap order

1. **Phase 0 — Credibility (0–6 weeks):** §4 fixes, branding cleanup, Bangladesh default view, licence register.
2. **Phase 1 — Terminal core (6 weeks–4 months):** command parser (§6), F-key screens, stock pages, screener, alerts, macro module, Pro plan + payments (bKash, Nagad, cards).
3. **Phase 2 — Risk & intelligence (4–9 months):** district risk, protest tracking, border/Rohingya watch, maritime layer, disinformation monitor, AI analyst; Business + Enterprise plans.
4. **Phase 3 — Government grade (9–18 months):** on-prem edition, SSO, audit, watermarking, ISO 27001 process, pen tests, SLA, pilot with one ministry/agency.

When unsure what to work on, pick the highest unfinished item in this order.

---

## 10. When to stop and ask

Ask the maintainer before:
- Adding any **Red** licence source or any paid API.
- Changing the licence, removing upstream notices, or touching payment/entitlement logic in production.
- Deleting data, migrations that drop columns/tables, or anything irreversible.
- Building anything that collects data about private individuals.
- Large refactors of upstream World Monitor code (prefer additive changes to keep merging upstream easy).

*This file is guidance, not legal advice. Confirm licensing questions with a lawyer.*
