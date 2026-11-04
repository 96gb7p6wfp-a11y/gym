export interface SupportDiagnostics {
  appVersion: string;
  browser: string;
  viewport: string;
  connection: 'online' | 'offline';
  presentation: 'installed' | 'browser';
  serviceWorker: 'supported' | 'unavailable';
  localStorage: 'accessible' | 'unavailable';
}

export interface DiagnosticEnvironment {
  appVersion: string;
  userAgent: string;
  width: number;
  height: number;
  online: boolean;
  standalone: boolean;
  serviceWorker: boolean;
  localStorageAccessible: boolean;
}

function browserFamily(userAgent: string): string {
  const known = [
    ['Edge', /(?:Edg|EdgiOS)\/(\d+)/], ['Chrome', /(?:Chrome|CriOS)\/(\d+)/],
    ['Firefox', /(?:Firefox|FxiOS)\/(\d+)/], ['Safari', /Version\/(\d+).*Safari/],
  ] as const;
  for (const [name, pattern] of known) {
    const match = userAgent.match(pattern);
    if (match) return `${name} ${match[1]}`;
  }
  return 'Other browser';
}

/** Explicit allowlist: never serialize the navigator, URLs, storage or errors. */
export function supportDiagnostics(environment: DiagnosticEnvironment): SupportDiagnostics {
  const dimension = (value: number) => Number.isFinite(value) && value > 0 ? Math.round(Math.min(value, 20_000)) : 0;
  return {
    appVersion: /^Setline V\d+(?:\.\d+)?$/.test(environment.appVersion) ? environment.appVersion : 'Setline',
    browser: browserFamily(environment.userAgent),
    viewport: `${dimension(environment.width)} × ${dimension(environment.height)}`,
    connection: environment.online ? 'online' : 'offline',
    presentation: environment.standalone ? 'installed' : 'browser',
    serviceWorker: environment.serviceWorker ? 'supported' : 'unavailable',
    localStorage: environment.localStorageAccessible ? 'accessible' : 'unavailable',
  };
}

export function createSupportReport(description: string, diagnostics?: SupportDiagnostics): string {
  // Rebuild the allowlist even for callers supplying objects with extra fields.
  const safeDiagnostics = diagnostics ? {
    appVersion: diagnostics.appVersion, browser: diagnostics.browser, viewport: diagnostics.viewport,
    connection: diagnostics.connection, presentation: diagnostics.presentation,
    serviceWorker: diagnostics.serviceWorker, localStorage: diagnostics.localStorage,
  } : undefined;
  return JSON.stringify({ app: 'Setline', reportVersion: 1, description: description.trim().slice(0, 10_000),
    ...(safeDiagnostics ? { diagnostics: safeDiagnostics } : {}) }, null, 2);
}
