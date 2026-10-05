const CHROMIUM_EXTENSION_ORIGIN = /^chrome-extension:\/\/[a-p]{32}$/;

export function parseCorsOriginList(value?: string | null): string[] {
  return String(value ?? '')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean);
}

export function isCorsOriginAllowed(
  origin: string | undefined,
  allowedOrigins: ReadonlySet<string>,
  allowDevelopmentExtensionOrigins: boolean,
): boolean {
  if (!origin) return true;
  if (allowedOrigins.has(origin)) return true;

  return allowDevelopmentExtensionOrigins
    && CHROMIUM_EXTENSION_ORIGIN.test(origin);
}
