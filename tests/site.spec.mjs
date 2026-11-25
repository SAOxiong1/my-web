/**
 * Playwright 端到端冒烟测试（可选，需要真实浏览器）：
 *   npm i -D @playwright/test && npx playwright install chromium
 *   npm run serve &   # 在 8000 端口起静态服务
 *   npm run test:e2e
 */
import { test, expect } from "@playwright/test";

const BASE = "http://localhost:8000/";

test("主链路：筛选 → 转动 → 揭晓海报 → 菜谱卡片 → 收藏持久化", async ({ page }) => {
  await page.goto(BASE);
  await expect(page).toHaveTitle("食光 · 今天吃什么");
  await expect(page.locator(".wheel-slot")).toHaveCount(8);

  await page.locator("#region-filters .chip[data-value='川菜']").click();
  await expect(page.locator("#choice-count")).toContainText("道家常菜");

  await page.locator("#randomize").click();
  await expect(page.locator("#spin-reveal")).not.toBeHidden({ timeout: 10000 });
  await page.keyboard.press("Escape");

  const dishName = await page.locator("#dish-name").textContent();
  expect(dishName.trim().length).toBeGreaterThan(0);

  await page.locator("[data-action='favorite']").click();
  await expect(page.locator("[data-action='favorite']")).toHaveAttribute("aria-pressed", "true");

  await page.reload();
  await expect(page.locator("#saved-list .ghost-button")).toHaveCount(1);
});

test("人数换算与勾选进度", async ({ page }) => {
  await page.goto(BASE);
  await page.evaluate(() => window.__shiguang__.openDish("kung-pao-chicken"));
  await expect(page.locator("#portion-select")).toBeVisible();
  await page.selectOption("#portion-select", "4");
  await expect(page.locator("#recipe-result")).toContainText("鸡胸肉 500 g");
  await page.locator(".ingredient-list .check").first().click();
  await expect(page.locator("#ingredient-progress")).toContainText("1/");
});
