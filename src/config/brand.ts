// bdnews Situation Intelligence: brand and regional defaults for this deployment.
// This deployment is a modified version of World Monitor (https://github.com/koala73/worldmonitor),
// licensed AGPL-3.0-only. Keep the attribution and source links below visible on the site.

export const BRAND = {
  name: 'bdnews Situation Intelligence',
  shortName: 'bdnews SI',
  logoText: 'BDNEWS SI',
  tagline: 'Live news, markets & risk for Bangladesh',
  siteUrl: 'https://bdnews.si',
  sourceRepoUrl: 'https://github.com/imonitsc/bdnews-si',
  upstreamName: 'World Monitor',
  upstreamRepoUrl: 'https://github.com/koala73/worldmonitor',
  /** Links to worldmonitor.app's other editions (Tech, Finance, ...). Off for this deployment. */
  showVariantSwitcher: false,
} as const;

/** Starting map view: Bangladesh, with the rest of South Asia in frame. */
export const DEFAULT_FOCUS = {
  countryCode: 'BD',
  lat: 23.7,
  lon: 90.4,
  zoom: 5,
  regionId: 'south-asia',
} as const;
