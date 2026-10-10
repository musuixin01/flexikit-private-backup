export type CompanionBrowser = 'chrome' | 'edge' | 'other'

export function detectCompanionBrowser(ua: string): CompanionBrowser {
  if (/Edg\//i.test(ua)) return 'edge'
  if (/Chrome\//i.test(ua) && !/OPR\/|Opera\//i.test(ua)) return 'chrome'
  return 'other'
}

export function validatedStoreListing(candidate: string, browser: 'chrome' | 'edge'): string | null {
  if (!candidate) return null
  try {
    const url = new URL(candidate)
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) return null
    const chromeListing = url.hostname === 'chromewebstore.google.com'
      && /^\/detail\/(?:[a-z0-9-]+\/)?[a-p]{32}\/?$/i.test(url.pathname)
    const edgeListing = url.hostname === 'microsoftedge.microsoft.com'
      && /^\/addons\/detail\/(?:[a-z0-9-]+\/)?[a-p]{32}\/?$/i.test(url.pathname)
    return browser === 'chrome' ? (chromeListing ? url.toString() : null)
      : (edgeListing ? url.toString() : null)
  } catch {
    return null
  }
}

export function cleanPairingCode(value: string): string {
  return value.replace(/[^a-zA-Z2-9]/g, '').toUpperCase().slice(0, 10)
}
