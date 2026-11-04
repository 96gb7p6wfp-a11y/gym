import { expect, test } from '@playwright/test';
import { performanceFixture } from './v16-performance-fixture.ts';

const STORE = 'setline.gym.v1';
test.use({storageState:{cookies:[],origins:[]}});

test('history searches all records, renders in bounded pages and preserves original workouts', async ({ page }) => {
  const fixture = performanceFixture(1000);
  await page.addInitScript(({key,state}) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key,JSON.stringify(state));
  },{key:STORE,state:fixture.state});
  await page.goto('/');
  await page.getByRole('tab',{name:'You',exact:true}).click();
  await page.getByRole('button',{name:'History',exact:true}).click();
  const region = page.getByRole('region',{name:'Find saved workouts',exact:true});
  const before = await page.evaluate(key => localStorage.getItem(key),STORE);
  await expect(region.locator('.history-card')).toHaveCount(40);
  await expect(region.getByRole('status')).toContainText('Showing 40 of 50');
  await region.getByRole('button',{name:'Show more workouts',exact:true}).click();
  await expect(region.locator('.history-card')).toHaveCount(50);
  const search = region.getByRole('searchbox',{name:'Search workouts',exact:true});
  await search.fill('target oldest');
  await expect(region.locator('.history-card')).toHaveCount(1);
  await expect(region).toContainText('Benchmark target oldest');
  await search.fill('does not exist');
  await expect(region.getByRole('heading',{name:'No matching workouts.',exact:true})).toBeVisible();
  await region.getByRole('button',{name:'Clear workout search',exact:true}).click();
  await expect(region.locator('.history-card')).toHaveCount(40);
  expect(await page.evaluate(key => localStorage.getItem(key),STORE)).toBe(before);
});

test('history search keeps keyboard focus, readable text, touch targets and reduced motion on a small phone', async ({ page }) => {
  await page.setViewportSize({width:320,height:568});
  await page.emulateMedia({reducedMotion:'reduce'});
  const fixture = performanceFixture(1000);
  await page.addInitScript(({key,state}) => localStorage.setItem(key,JSON.stringify(state)),{key:STORE,state:fixture.state});
  await page.goto('/');
  await page.getByRole('tab',{name:'You',exact:true}).click();
  await page.getByRole('button',{name:'History',exact:true}).click();
  const region = page.getByRole('region',{name:'Find saved workouts',exact:true});
  const search = region.getByRole('searchbox',{name:'Search workouts',exact:true});
  await search.focus();
  await page.keyboard.type('target');
  await expect(search).toBeFocused();
  await expect(region.locator('.history-card')).toHaveCount(1);
  expect(await search.evaluate(element => parseFloat(getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(16);
  expect(await search.evaluate(element => element.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
  expect(await search.evaluate(element => getComputedStyle(element.parentElement!).outlineStyle)).toBe('solid');
  await page.keyboard.press('Tab');
  const clear = region.getByRole('button',{name:'Clear workout search',exact:true});
  await expect(clear).toBeFocused();
  const size = (await clear.boundingBox())!;
  expect(size.width).toBeGreaterThanOrEqual(44);
  expect(size.height).toBeGreaterThanOrEqual(44);
  await page.keyboard.press('Enter');
  await expect(region.locator('.history-card')).toHaveCount(40);
  await expect(search).toBeFocused();
  await search.evaluate(element => { (element as HTMLElement).style.fontSize='32px'; });
  await search.fill('target');
  await expect(search).toHaveValue('target');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(await region.evaluate(element => Array.from(element.querySelectorAll('button')).every(button => {
    const style=getComputedStyle(button);
    return style.animationDuration.split(',').every(duration => parseFloat(duration)<=.00001)
      && style.transitionDuration.split(',').every(duration => parseFloat(duration)<=.00001);
  }))).toBe(true);
});
