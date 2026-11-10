import { expect, type Page } from '@playwright/test';

/** Older saved observations remain compatible after their questionnaire leaves
 * the main screen. This provisions only an isolated Playwright fixture; new
 * pre-workout answers must be exercised through the Ready to Train UI. */
export async function seedLegacyReadiness(page: Page, date: string, status: 'Green' | 'Yellow' | 'Red') {
  const today = await page.evaluate(({ date, status }) => {
    const state = JSON.parse(localStorage.getItem('setline.gym.v1')!);
    if (!state.profile.masterProgram) throw new Error('Legacy readiness fixture requires a saved master program.');
    state.profile.masterProgram.readiness = [
      ...(state.profile.masterProgram.readiness ?? []).filter((row: { date: string }) => row.date !== date),
      { date, status: status.toLowerCase() },
    ];
    state.profileVersion = (state.profileVersion ?? 0) + 1;
    localStorage.setItem('setline.gym.v1', JSON.stringify(state));
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  }, { date, status });
  await page.reload();
  await page.getByRole('tab', { name: 'Train', exact: true }).click();
  const monday = (value: string) => {
    const day = new Date(`${value}T12:00:00Z`);
    day.setUTCDate(day.getUTCDate() - (day.getUTCDay() + 6) % 7);
    return day.getTime();
  };
  const weeks = Math.round((monday(date) - monday(today)) / 604_800_000);
  for (let index = 0; index < Math.abs(weeks); index++) {
    await page.getByRole('button', { name: weeks < 0 ? 'Previous week' : 'Next week', exact: true }).click();
  }
  const weekday = new Date(`${date}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' });
  await page.getByRole('button', { name: new RegExp(`^${weekday} `) }).click();
  await expect.poll(() => page.evaluate(({ date }) => JSON.parse(localStorage.getItem('setline.gym.v1')!)
    .profile.masterProgram.readiness.find((row: { date: string }) => row.date === date)?.status, { date })).toBe(status.toLowerCase());
}
