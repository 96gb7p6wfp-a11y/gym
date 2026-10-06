export const APP_URL = 'https://setline-eric.haoxuan2333.chatgpt.site';

export type NavigationKind = 'internal' | 'external' | 'blocked';

const appOrigin = new URL(APP_URL).origin;

/** Keep the app's pages in its WebView and hand supported links to iOS. */
export function classifyNavigation(url: string): NavigationKind {
  if (
    typeof url !== 'string' ||
    url.length === 0 ||
    /[\s\u0000-\u001f\u007f\\]/u.test(url) ||
    /%(?![\da-f]{2})/iu.test(url)
  ) {
    return 'blocked';
  }

  if (url === 'about:blank') {
    return 'internal';
  }

  let parsed: URL;
  try {
    // A base URL would make relative or scheme-less input appear trustworthy.
    parsed = new URL(url);
  } catch {
    return 'blocked';
  }

  if (parsed.username !== '' || parsed.password !== '') {
    return 'blocked';
  }

  if (parsed.protocol === 'https:') {
    // URL parsers repair missing slashes and tolerate empty userinfo. Require
    // an unambiguous authority before comparing the canonical origins.
    const authority = /^https:\/\/([^/?#]+)/iu.exec(url)?.[1];
    if (!authority || authority.includes('@')) {
      return 'blocked';
    }

    return parsed.origin === appOrigin ? 'internal' : 'external';
  }

  if (parsed.protocol === 'mailto:' || parsed.protocol === 'tel:') {
    const target = url.slice(url.indexOf(':') + 1);
    if (
      target.length === 0 ||
      target.startsWith('//') ||
      parsed.pathname.length === 0 ||
      parsed.hash !== ''
    ) {
      return 'blocked';
    }

    return 'external';
  }

  return 'blocked';
}
