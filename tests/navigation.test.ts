import assert from 'node:assert/strict';
import test from 'node:test';

import { APP_URL, classifyNavigation } from '../src/navigation.ts';

test('the app points to the exact existing HTTPS site', () => {
  assert.equal(APP_URL, 'https://setline-eric.haoxuan2333.chatgpt.site');
});

test('same-origin HTTPS pages stay inside the app', () => {
  const urls = [
    APP_URL,
    `${APP_URL}/`,
    `${APP_URL}/workouts/today?view=sets#exercise`,
    `${APP_URL}/search?q=bench%20press`,
    'HTTPS://SETLINE-ERIC.HAOXUAN2333.CHATGPT.SITE/workouts',
    'https://setline-eric.haoxuan2333.chatgpt.site:443/workouts',
    `${APP_URL}/redirect?next=https%3A%2F%2Fexample.com`,
    'about:blank',
  ];

  for (const url of urls) {
    assert.equal(classifyNavigation(url), 'internal', url);
  }
});

test('other HTTPS origins and supported system links leave the WebView', () => {
  const urls = [
    'https://example.com/',
    'https://example.com:8443/help',
    'https://setline-eric.haoxuan2333.chatgpt.site.evil.example/',
    'https://evil-setline-eric.haoxuan2333.chatgpt.site/',
    'https://sub.setline-eric.haoxuan2333.chatgpt.site/',
    'https://setline-eric.haoxuan2333.chatgpt.site:8443/',
    'https://setline-eric.haoxuan2333.chatgpt.site./',
    'https://example.com/setline-eric.haoxuan2333.chatgpt.site',
    'https://example.com/#https://setline-eric.haoxuan2333.chatgpt.site',
    'mailto:help@example.com',
    'MAILTO:help@example.com?subject=App%20support',
    'mailto:one@example.com,two@example.com?body=First%0ASecond',
    'tel:+491234567890',
    'TEL:123-456-7890',
    'tel:+491234567890;ext=42',
  ];

  for (const url of urls) {
    assert.equal(classifyNavigation(url), 'external', url);
  }
});

test('insecure, executable, local and unknown schemes are blocked', () => {
  const urls = [
    'http://setline-eric.haoxuan2333.chatgpt.site/',
    'http://example.com/',
    'file:///etc/passwd',
    'data:text/html,%3Cscript%3Ealert(1)%3C/script%3E',
    'javascript:alert(1)',
    'JAVASCRIPT:alert(1)',
    'ftp://example.com/file',
    'intent://example.com/',
    'setline://workouts',
    'blob:https://setline-eric.haoxuan2333.chatgpt.site/id',
    'about:srcdoc',
    'about:blank#fragment',
  ];

  for (const url of urls) {
    assert.equal(classifyNavigation(url), 'blocked', url);
  }
});

test('embedded credentials are blocked even on the app origin', () => {
  const urls = [
    'https://user@setline-eric.haoxuan2333.chatgpt.site/',
    'https://user:password@setline-eric.haoxuan2333.chatgpt.site/',
    'https://:password@setline-eric.haoxuan2333.chatgpt.site/',
    'https://@setline-eric.haoxuan2333.chatgpt.site/',
    'https://user%40example.com@setline-eric.haoxuan2333.chatgpt.site/',
    'https://setline-eric.haoxuan2333.chatgpt.site@evil.example/',
    'https://user:password@example.com/',
  ];

  for (const url of urls) {
    assert.equal(classifyNavigation(url), 'blocked', url);
  }
});

test('malformed, relative and parser-repaired URLs are blocked', () => {
  const urls = [
    '',
    '/workouts',
    '//setline-eric.haoxuan2333.chatgpt.site/workouts',
    'setline-eric.haoxuan2333.chatgpt.site/workouts',
    'not a URL',
    'https:',
    'https://',
    'https:example.com',
    'https:/example.com',
    'https:///example.com',
    'https:////example.com',
    'https:\\example.com',
    'https://example.com\\@setline-eric.haoxuan2333.chatgpt.site/',
    ' https://example.com/',
    'https://example.com/ ',
    'https://exam\nple.com/',
    'https://example.com/path\tname',
    'https://example.com/\u0000',
    'https://example.com/\u007f',
    'https://example.com/\u00a0',
    'https://example.com/%',
    'https://example.com/%2',
    'https://example.com/%GG',
    'https://example.com:abc/',
    'https://example.com:70000/',
    'https://[invalid]/',
    'mailto:',
    'mailto://help@example.com',
    'mailto:help@example.com#fragment',
    'tel:',
    'tel://1234567890',
    'tel:+1234567890#fragment',
  ];

  for (const url of urls) {
    assert.equal(classifyNavigation(url), 'blocked', url);
  }
});
