const TRACKING_QUERY_PARAMS = new Set([
  'fbclid',
  'gclid',
  'dclid',
  'msclkid',
  'mc_cid',
  'mc_eid',
  'ref',
  'ref_src',
  'spm',
  'yclid',
]);

export function normalizeToolUrl(value: string): string | null {
  try {
    const url = new URL(value.trim());
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;

    url.hash = '';
    for (const key of [...url.searchParams.keys()]) {
      const normalized = key.toLowerCase();
      if (normalized.startsWith('utm_') || TRACKING_QUERY_PARAMS.has(normalized)) {
        url.searchParams.delete(key);
      }
    }
    url.searchParams.sort();

    if (url.pathname.length > 1) {
      url.pathname = url.pathname.replace(/\/+$/, '') || '/';
    }

    return url.toString();
  } catch {
    return null;
  }
}
