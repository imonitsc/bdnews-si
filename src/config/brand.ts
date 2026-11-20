// BD Situation Intelligence: brand and regional defaults for this deployment.
// This deployment is a modified version of World Monitor (https://github.com/koala73/worldmonitor),
// licensed AGPL-3.0-only. Keep the attribution and source links below visible on the site.

export const BRAND = {
  name: 'BD Situation Intelligence',
  shortName: 'BD SI',
  logoText: 'BD SI',
  tagline: 'Live news, markets & risk for Bangladesh',
  siteUrl: 'https://bdnews.si',
  sourceRepoUrl: 'https://github.com/imonitsc/bdnews-si',
  upstreamName: 'World Monitor',
  upstreamRepoUrl: 'https://github.com/koala73/worldmonitor',
  /** Links to worldmonitor.app's other editions (Tech, Finance, ...). Off for this deployment. */
  showVariantSwitcher: false,
  /** Remove World Monitor Pro (premium: 'locked') panels; their sign-in and billing are not available here. */
  hideUpstreamPremiumPanels: true,
  /** Panel cap for signed-in users (upstream's free tier allows 40). */
  freeMaxPanels: 120,
} as const;

/** Starting map view: Bangladesh, with the rest of South Asia in frame. */
export const DEFAULT_FOCUS = {
  countryCode: 'BD',
  lat: 23.7,
  lon: 90.4,
  zoom: 5,
  regionId: 'south-asia',
} as const;
