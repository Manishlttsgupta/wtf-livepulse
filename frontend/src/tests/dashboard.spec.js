import { test, expect } from '@playwright/test';

test.describe('LivePulse Operations Dashboard', () => {
  test('loads dashboard and renders gym list selector', async ({ page }) => {
    await page.goto('http://localhost:3000');
    await expect(page.locator('h1')).toContainText('WTF LIVEPULSE');
    await expect(page.locator('select').first()).toBeVisible();
  });

  test('displays occupancy and revenue metrics', async ({ page }) => {
    await page.goto('http://localhost:3000');
    await expect(page.getByText('LIVE OCCUPANCY')).toBeVisible();
    await expect(page.getByText("TODAY'S REVENUE")).toBeVisible();
  });

  test('simulator controls are interactable', async ({ page }) => {
    await page.goto('http://localhost:3000');
    const startBtn = page.getByRole('button', { name: /Start|Pause/i });
    await expect(startBtn).toBeVisible();
  });
});