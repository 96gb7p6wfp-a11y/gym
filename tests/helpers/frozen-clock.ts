import type { Page } from '@playwright/test';

/**
 * React 19 defers a resolved Suspense retry for up to 300ms after showing its
 * fallback. A deliberately paused Playwright clock freezes that commit too.
 * Advance only while the real UI action/assertion is pending; retain its full
 * assertions and keep the clock paused again before elapsed-time testing.
 */
export async function settleWithFrozenClock<T>(page: Page, action: () => Promise<T>): Promise<T> {
  let settled = false;
  const pending = action().then(value => {
    settled = true;
    return { ok: true as const, value };
  }, error => {
    settled = true;
    return { ok: false as const, error };
  });
  while (!settled) {
    // This waits in the test runner, not in the page's paused timer queue.
    await Promise.race([pending, new Promise(resolve => setTimeout(resolve, 50))]);
    if (!settled) await page.clock.runFor(350);
  }
  const result = await pending;
  if (!result.ok) throw result.error;
  return result.value;
}
