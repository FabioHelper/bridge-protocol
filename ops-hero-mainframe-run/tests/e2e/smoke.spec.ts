import { expect, test } from '@playwright/test';

/**
 * Browser smoke test against the PRODUCTION preview build, not the dev server.
 *
 * The game exposes a minimal readonly probe on `window.__OPS_HERO__` for exactly this purpose;
 * nothing in gameplay reads it.
 */
test('boots in a browser and renders a 16:9 pixel-art canvas', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('pageerror', (error) => consoleErrors.push(error.message));

  await page.goto('/');

  const canvas = page.locator('#game-root canvas');
  await expect(canvas).toBeAttached();

  const box = await canvas.evaluate((element) => {
    const c = element as HTMLCanvasElement;
    return { width: c.width, height: c.height };
  });
  expect(box.width / box.height).toBeCloseTo(16 / 9, 2);

  await page.waitForFunction(() => typeof window.__OPS_HERO__ !== 'undefined', null, {
    timeout: 15_000,
  });

  const probe = await page.evaluate(() => window.__OPS_HERO__);
  expect(probe.errors, `textures failed to load: ${probe.errors.join(', ')}`).toEqual([]);
  expect(consoleErrors).toEqual([]);

  await page.screenshot({ path: 'test-results/smoke-boot.png' });
});
