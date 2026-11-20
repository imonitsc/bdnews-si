# Third-party register: BD Situation Intelligence

Every dataset, API, hosted service and direct dependency that BDSI uses, with
its licence and a verdict (CLAUDE.md §3.1). Add a row **before** adding a new
source or dependency.

Verdicts:

- **Green**: OK to embed and use in paid tiers (with any attribution listed).
- **Amber**: usable, but only as a separate service, with a vendor agreement
  for paid tiers, or still to be verified.
- **Red**: non-commercial terms. Off by default behind a `LICENSED_*` flag;
  needs a signed licence before it is switched on for any paid tier.

_This register is engineering bookkeeping, not legal advice. Confirm Amber and
Red items with a lawyer before selling the matching tier._

Last reviewed: 2026-11-20.

## 1. Upstream code

| Name | URL | Licence | How we use it | Attribution |
|---|---|---|---|---|
| World Monitor (Elie Habib) | https://github.com/koala73/worldmonitor | AGPL-3.0-only | The whole app is a fork | Keep LICENSE, source headers, About page credit and the footer "Source code (AGPL-3.0)" link |

## 2. Data sources added by BDSI

| Name | URL | Licence / terms | How we use it | Attribution | Verdict |
|---|---|---|---|---|---|
| Dhaka Stock Exchange website | https://www.dse.com.bd | No published open licence; public web pages | `api/bd-markets.js` reads DSEX/DS30/DSES and top movers for the DSE panel | "Source: Dhaka Stock Exchange" | **Amber**: OK for the free prototype; Pro tier needs a DSE data-vendor agreement (CLAUDE.md §5.1) |
| Bangladesh Bank exchange rates | https://www.bb.org.bd/en/index.php/econdata/exchangerate | Government publication, no explicit licence | Official USD/BDT and other rates for the Taka panel | "Source: Bangladesh Bank" | **Amber**: verify reuse terms |
| Trading Corporation of Bangladesh (TCB) daily market prices | https://tcb.gov.bd | Government publication, no explicit licence | Dhaka retail prices (xlsx) for the Bazaar panel | "Source: TCB" | **Amber**: verify reuse terms |
| ExchangeRate-API open access | https://open.er-api.com | Free; attribution link required | Fallback for the Taka panel when Bangladesh Bank is unreachable; shown as "not official" | Link "Rates by Exchange Rate API" | **Green** with attribution |
| NASA FIRMS active fires | https://firms.modaps.eosdis.nasa.gov | NASA open data | Fires panel and map layer (`NASA_FIRMS_API_KEY`, GitHub Actions) | "NASA FIRMS" | **Green** |
| UCDP GED / Candidate events | https://ucdp.uu.se | CC BY 4.0 | Armed Conflict panel and map layer (`UCDP_ACCESS_TOKEN`, requested 2026-11-20) | "UCDP, Uppsala University" | **Green** |
| IODA internet outage events | https://ioda.inetintel.cc.gatech.edu | Free public API; terms to confirm | Internet Disruptions panel (`scripts/lib/ioda-outages.mjs`), used when no Cloudflare Radar token is set; each row says "Source: IODA (Georgia Tech)" | "IODA, Georgia Tech" | **Amber**: confirm commercial terms before Pro |

## 3. Upstream data sources this deployment currently runs

The full list of hosts lives in `scripts/source-origin.mjs` and the generated
attribution manifest (`npm run sources:generate`). The ones with licence
consequences:

| Name | Licence / terms | Status on bdnews.si | Verdict |
|---|---|---|---|
| GDELT | Free incl. commercial; must cite GDELT | On (news, unrest) | **Green** |
| GDACS (EC JRC) | Free reuse with attribution | On (disasters) | **Green** |
| UNHCR Refugee Data Finder | CC BY 4.0 (verify per dataset) | On (Displacement panel) | **Green** (verify) |
| ReliefWeb (OCHA) | Content licences vary by source | On | **Amber**: show original source per item |
| adsb.lol | ODbL | Off (inside the gated military-flights seeder) | **Green** with attribution |
| Cloudflare Radar | Needs a Cloudflare API token | Off (no token); outages come from IODA, DDoS/anomaly tabs stay empty | n/a |

## 4. Red-listed sources (non-commercial terms)

| Source | Where it is in the code | Gate | Default |
|---|---|---|---|
| ACLED | `scripts/shared/acled-oauth.mjs`, `server/_shared/acled-auth.ts` | `LICENSED_ACLED`: the seed workflow only passes `ACLED_EMAIL`/`ACLED_PASSWORD` when the repo variable is `true`. Vercel must not hold ACLED credentials. | **Off** |
| OpenSky Network API | `scripts/seed-military-flights.mjs`, `scripts/ais-relay.cjs` (not deployed) | `LICENSED_OPENSKY` in `scripts/run-seeders.sh` | **Off** |
| adsb.fi open data | same as OpenSky | `LICENSED_ADSBFI` in `scripts/run-seeders.sh` | **Off** |
| Global Fishing Watch API | not used | add `LICENSED_GFW` if ever wired in | n/a |
| BanglaBERT (CC BY-NC-SA) | not used; use BNLP (MIT) instead | n/a | n/a |

## 5. Hosted services

| Service | Use | Terms |
|---|---|---|
| Vercel | Hosting, Edge/Node functions | Commercial ToS (team plan) |
| Upstash Redis | Cache for seeded data | Commercial ToS |
| GitHub Actions | 3-hourly seed job | Commercial ToS |
| Supabase | Sign-in (Auth) | Commercial ToS; user emails stored in Supabase |
| Resend | Sign-in emails from bdnews.si | Commercial ToS |

## 6. Map tiles and fonts

| Name | Licence | Use | Verdict |
|---|---|---|---|
| OpenFreeMap tiles (default) | Free incl. commercial; OSM data ODbL | Default basemap (no `VITE_PMTILES_URL` set) | **Green**: keep "© OpenStreetMap contributors" visible |
| Protomaps basemap assets | BSD-3 / OSM data ODbL | Used only when PMTiles are configured | **Green** |
| CARTO basemaps | Commercial use needs a CARTO licence | Optional provider in settings, not the default | **Amber**: remove the option or license before paid tiers |
| `tile.openstreetmap.org` | OSMF tile policy forbids heavy/commercial use | Not used | Never use |
| IBM Plex Mono | SIL OFL-1.1 | Site-wide terminal font (`public/fonts/ibm-plex-mono/`) | **Green** |
| Nunito, Tajawal (@fontsource) | SIL OFL-1.1 | Upstream fonts still bundled | **Green** |

## 7. Direct npm dependencies

Generated from `package.json` + `node_modules/*/package.json` on 2026-11-20.
No GPL/AGPL packages are bundled. MPL-2.0 packages (`@vercel/og`,
`@axe-core/playwright`, and `dompurify`, which is dual-licensed) are fine
unmodified. `@dodopayments/convex` declares no licence: check it before
payments go live.

| Package | Scope | Licence | Homepage |
|---|---|---|---|
| @anthropic-ai/sdk | runtime | MIT |  |
| @aws-sdk/client-s3 | runtime | Apache-2.0 | [link](https://github.com/aws/aws-sdk-js-v3/tree/main/clients/client-s3) |
| @clerk/clerk-js | runtime | MIT | [link](https://clerk.com/) |
| @deck.gl/core | runtime | MIT | [link](https://deck.gl) |
| @deck.gl/layers | runtime | MIT | [link](https://deck.gl) |
| @deck.gl/maplibre | runtime | MIT | [link](https://deck.gl) |
| @dodopayments/convex | runtime | **unknown — check** |  |
| @e965/xlsx | runtime | Apache-2.0 | [link](https://sheetjs.com/) |
| @fontsource/nunito | runtime | OFL-1.1 | [link](https://fontsource.org/fonts/nunito) |
| @fontsource/tajawal | runtime | OFL-1.1 | [link](https://fontsource.org/fonts/tajawal) |
| @noble/hashes | runtime | MIT | [link](https://paulmillr.com/noble/) |
| @photostructure/tz-lookup | runtime | CC0-1.0 |  |
| @protomaps/basemaps | runtime | BSD-3-Clause | [link](https://github.com/protomaps/basemaps) |
| @sentry/browser | runtime | MIT | [link](https://github.com/getsentry/sentry-javascript/tree/master/packages/browser) |
| @supabase/supabase-js | runtime | MIT | [link](https://github.com/supabase/supabase-js/tree/master/packages/core/supabase-js) |
| @upstash/ratelimit | runtime | MIT |  |
| @upstash/redis | runtime | MIT | [link](https://github.com/upstash/upstash-redis) |
| @vercel/analytics | runtime | MIT |  |
| @vercel/functions | runtime | Apache-2.0 | [link](https://vercel.com/docs/functions/functions-api-reference/vercel-functions-package) |
| @vercel/og | runtime | MPL-2.0 |  |
| @xenova/transformers | runtime | Apache-2.0 | [link](https://github.com/xenova/transformers.js) |
| aws4fetch | runtime | MIT |  |
| braces | runtime | MIT |  |
| canvas-confetti | runtime | ISC | [link](https://github.com/catdad/canvas-confetti) |
| convex | runtime | Apache-2.0 | [link](https://convex.dev) |
| d3 | runtime | ISC | [link](https://d3js.org) |
| deck.gl | runtime | MIT | [link](https://deck.gl) |
| dompurify | runtime | (MPL-2.0 OR Apache-2.0) | [link](https://github.com/cure53/DOMPurify) |
| fast-xml-parser | runtime | MIT |  |
| fflate | runtime | MIT | [link](https://101arrowz.github.io/fflate) |
| globe.gl | runtime | MIT | [link](https://github.com/vasturiano/globe.gl) |
| h3-js | runtime | Apache-2.0 |  |
| hls.js | runtime | Apache-2.0 | [link](https://github.com/video-dev/hls.js) |
| hyparquet | runtime | MIT | [link](https://hyperparam.app) |
| i18next | runtime | MIT | [link](https://www.i18next.com) |
| i18next-browser-languagedetector | runtime | MIT | [link](https://github.com/i18next/i18next-browser-languageDetector) |
| jmespath | runtime | Apache-2.0 | [link](https://github.com/jmespath/jmespath.js) |
| jose | runtime | MIT | [link](https://github.com/panva/jose) |
| mailchecker | runtime | MIT |  |
| maplibre-gl | runtime | BSD-3-Clause | [link](https://maplibre.org/) |
| marked | runtime | MIT | [link](https://marked.js.org) |
| onnxruntime-web | runtime | MIT |  |
| papaparse | runtime | MIT | [link](https://www.papaparse.com/) |
| pmtiles | runtime | BSD-3-Clause | [link](https://github.com/protomaps/pmtiles) |
| preact | runtime | MIT | [link](https://preactjs.com) |
| satellite.js | runtime | MIT | [link](https://github.com/shashwatak/satellite-js) |
| stream-json | runtime | BSD-3-Clause | [link](http://github.com/uhop/stream-json) |
| supercluster | runtime | ISC |  |
| telegram | runtime | MIT | [link](https://github.com/gram-js/gramjs) |
| topojson-client | runtime | ISC | [link](https://github.com/topojson/topojson-client) |
| undici | runtime | MIT | [link](https://undici.nodejs.org) |
| uqr | runtime | MIT | [link](https://github.com/unjs/uqr) |
| web-vitals | runtime | Apache-2.0 |  |
| ws | runtime | MIT | [link](https://github.com/websockets/ws) |
| yaml | runtime | ISC | [link](https://eemeli.org/yaml/) |
| zod | runtime | MIT | [link](https://zod.dev) |
| @axe-core/playwright | dev | MPL-2.0 |  |
| @biomejs/biome | dev | MIT OR Apache-2.0 | [link](https://biomejs.dev) |
| @bufbuild/buf | dev | Apache-2.0 |  |
| @edge-runtime/vm | dev | MIT | [link](https://edge-runtime.vercel.app/packages/vm) |
| @modelcontextprotocol/client | dev | Apache-2.0 | [link](https://modelcontextprotocol.io) |
| @playwright/test | dev | Apache-2.0 | [link](https://playwright.dev) |
| @sentry/vite-plugin | dev | MIT | [link](https://github.com/getsentry/sentry-javascript-bundler-plugins/tree/main/packages/vite-plugin) |
| @tauri-apps/cli | dev | Apache-2.0 OR MIT | [link](https://github.com/tauri-apps/tauri) |
| @types/canvas-confetti | dev | MIT | [link](https://github.com/DefinitelyTyped/DefinitelyTyped/tree/master/types/canvas-confetti) |
| @types/d3 | dev | MIT | [link](https://github.com/DefinitelyTyped/DefinitelyTyped/tree/master/types/d3) |
| @types/geojson | dev | MIT | [link](https://github.com/DefinitelyTyped/DefinitelyTyped/tree/master/types/geojson) |
| @types/jmespath | dev | MIT | [link](https://github.com/DefinitelyTyped/DefinitelyTyped/tree/master/types/jmespath) |
| @types/papaparse | dev | MIT | [link](https://github.com/DefinitelyTyped/DefinitelyTyped/tree/master/types/papaparse) |
| @types/supercluster | dev | MIT | [link](https://github.com/DefinitelyTyped/DefinitelyTyped/tree/master/types/supercluster) |
| @types/three | dev | MIT | [link](https://github.com/DefinitelyTyped/DefinitelyTyped/tree/master/types/three) |
| @types/topojson-client | dev | MIT | [link](https://github.com/DefinitelyTyped/DefinitelyTyped/tree/master/types/topojson-client) |
| @types/topojson-specification | dev | MIT | [link](https://github.com/DefinitelyTyped/DefinitelyTyped/tree/master/types/topojson-specification) |
| @typescript/native | dev | Apache-2.0 | [link](https://www.typescriptlang.org/) |
| ajv | dev | MIT | [link](https://ajv.js.org) |
| convex-test | dev | Apache-2.0 | [link](https://docs.convex.dev/functions/testing) |
| cross-env | dev | MIT | [link](https://github.com/kentcdodds/cross-env) |
| deepmerge | dev | MIT |  |
| esbuild | dev | MIT |  |
| exceljs | dev | MIT |  |
| fengari | dev | MIT | [link](https://github.com/fengari-lua/fengari) |
| happy-dom | dev | MIT | [link](https://github.com/capricorn86/happy-dom) |
| js-yaml | dev | MIT |  |
| markdownlint-cli2 | dev | MIT | [link](https://github.com/DavidAnson/markdownlint-cli2) |
| opencc-js | dev | MIT AND Apache-2.0 | [link](https://github.com/nk2028/opencc-js) |
| pdfjs-dist | dev | Apache-2.0 | [link](https://mozilla.github.io/pdf.js/) |
| tsx | dev | MIT | [link](https://tsx.hirok.io) |
| typescript | dev | Apache-2.0 | [link](https://www.typescriptlang.org/) |
| vite | dev | MIT | [link](https://vite.dev) |
| vite-plugin-pwa | dev | MIT | [link](https://github.com/vite-pwa/vite-plugin-pwa) |
| vitest | dev | MIT | [link](https://vitest.dev) |
| webmcp-types | dev | MIT | [link](https://github.com/webmachinelearning/webmcp-types) |
