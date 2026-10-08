import { expect, test, type CDPSession, type Locator, type Page } from '@playwright/test';

// Browser touch input exercises native scrolling and Radix's touch handlers.
// Setting scrollTop or using a mouse wheel would miss the reported iPhone bug.
async function swipe(page: Page, session: CDPSession, viewport: Locator, direction: 'down' | 'up') {
  const bounds = (await viewport.boundingBox())!;
  const distance = Math.min(180, bounds.height - 40);
  const x = bounds.x + bounds.width / 2;
  const y = direction === 'down' ? bounds.y + bounds.height - 20 : bounds.y + 20;
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  for (let step = 1; step <= 12; step++) {
    await page.waitForTimeout(20);
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchMove', touchPoints: [{ x, y: y + (direction === 'down' ? -1 : 1) * distance * step / 12 }],
    });
  }
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(250);
}

for (const screen of [
  { width: 390, height: 844, top: 59, bottom: 34, left: 0, right: 0 },
  { width: 320, height: 568, top: 47, bottom: 34, left: 0, right: 0 },
  { width: 844, height: 390, top: 0, bottom: 21, left: 59, right: 59 },
]) {
  test(`swipes the long movement list in both directions and selects a distant option at ${screen.width}px`, async ({ page }) => {
    const size = { width: screen.width, height: screen.height };
    await page.setViewportSize(size);
    await page.goto('/');
    await page.evaluate(({ top, bottom, left, right }) => {
      for (const [side, value] of Object.entries({ top, bottom, left, right })) {
        document.documentElement.style.setProperty(`--app-safe-area-${side}`, `${value}px`);
      }
    }, screen);
    await page.getByRole('tab', { name: 'Progress', exact: true }).tap();
    await page.getByRole('button', { name: 'Strength', exact: true }).tap();
    const trigger = page.getByRole('combobox', { name: 'Movement', exact: true });
    await trigger.tap();
    const list = page.getByRole('listbox');
    // Use the Radix marker so this regression also runs against the old build.
    const viewport = list.locator('[data-radix-select-viewport]');
    await expect(list).toBeVisible();
    await expect.poll(() => list.evaluate(e => e.getAnimations().filter(a => a.playState === 'running').length)).toBe(0);
    await page.keyboard.press('Home');
    const before = await viewport.evaluate(e => e.scrollTop);
    const backgroundY = await page.evaluate(() => window.scrollY);
    const last = list.getByRole('option').last();
    const lastName = (await last.textContent())!.trim();
    const session = await page.context().newCDPSession(page);

    await swipe(page, session, viewport, 'down');
    const afterDown = await viewport.evaluate(e => e.scrollTop);
    expect(afterDown, 'A finger swipe must move the list, without resetting it to the selected item').toBeGreaterThan(before + 60);
    await swipe(page, session, viewport, 'up');
    expect(await viewport.evaluate(e => e.scrollTop)).toBeLessThan(afterDown - 40);
    await expect(list).toBeVisible();
    expect(await page.evaluate(() => window.scrollY)).toBe(backgroundY);

    // The short landscape popup needs more swipes to traverse the same list.
    for (let attempt = 0; attempt < 40; attempt++) {
      const reachedEnd = await viewport.evaluate(e => e.scrollTop + e.clientHeight >= e.scrollHeight - 2);
      if (reachedEnd) break;
      await swipe(page, session, viewport, 'down');
    }
    expect(await viewport.evaluate(e => e.scrollTop + e.clientHeight)).toBeGreaterThanOrEqual(
      await viewport.evaluate(e => e.scrollHeight - 2),
    );
    const popup = (await list.boundingBox())!;
    expect(popup.x).toBeGreaterThanOrEqual(screen.left + 15);
    expect(popup.x + popup.width).toBeLessThanOrEqual(size.width - screen.right - 15);
    expect(popup.y).toBeGreaterThanOrEqual(screen.top + 15);
    expect(popup.y + popup.height).toBeLessThanOrEqual(size.height - screen.bottom - 15);
    await last.tap();
    await expect(list).not.toBeVisible();
    await expect(trigger).toContainText(lastName);
    await expect(page.getByRole('heading', { name: lastName, exact: true })).toBeVisible();

    // Closing the menu releases its body scroll lock.
    await expect.poll(() => page.evaluate(() => document.body.hasAttribute('data-scroll-locked'))).toBe(false);
    await page.getByRole('tab', { name: 'Train', exact: true }).click();
    const restoredY = await page.evaluate(() => window.scrollY);
    const x = size.width / 2, y = size.height / 2;
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    for (let step = 1; step <= 10; step++) {
      await page.waitForTimeout(20);
      await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y - step * 15 }] });
    }
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(restoredY + 40);
  });
}
