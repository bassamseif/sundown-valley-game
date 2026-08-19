import { test, expect, Page } from "@playwright/test";

// Collect console errors / page errors on every test so a broken build
// (syntax error, thrown exception, failed WebGL context) fails loudly
// instead of silently rendering nothing.
function trackErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(String(err)));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  return errors;
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test("menu renders only the enabled loops with no console errors", async ({ page }) => {
  const errors = trackErrors(page);
  await expect(page.getByText("Choose a test loop")).toBeVisible();
  await expect(page.getByRole("button", { name: "Sound Forge" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Market Day" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Geometry Combining" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Water Pipe Alignment" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Structural Bridge" })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("sound forge: placing pebbles in the correct order solves the word", async ({ page }) => {
  const errors = trackErrors(page);
  await page.getByRole("button", { name: "Sound Forge" }).click();
  await expect(page.locator("canvas")).toBeVisible();
  await page.waitForFunction(() => (window as any).__sv?.forge !== undefined);

  // correctOrder is exposed precisely so this test doesn't need to know
  // the seeded shuffle — mirrors the pipe-alignment test's approach.
  const correctOrder: string[] = await page.evaluate(() => (window as any).__sv.forge.correctOrder);
  for (const pebbleId of correctOrder) {
    await page.evaluate((id) => (window as any).__sv.forge.tapPebble(id), pebbleId);
    await page.waitForTimeout(80);
  }

  await page.waitForFunction(() => (window as any).__sv.forge.solved === true);
  const solved = await page.evaluate(() => (window as any).__sv.forge.solved);
  expect(solved).toBe(true);
  expect(errors).toEqual([]);
});

test("sound forge: a wrong order does not solve and stays retryable", async ({ page }) => {
  await page.getByRole("button", { name: "Sound Forge" }).click();
  await page.waitForFunction(() => (window as any).__sv?.forge !== undefined);

  const correctOrder: string[] = await page.evaluate(() => (window as any).__sv.forge.correctOrder);
  const reversed = correctOrder.slice().reverse();
  for (const pebbleId of reversed) {
    await page.evaluate((id) => (window as any).__sv.forge.tapPebble(id), pebbleId);
    await page.waitForTimeout(80);
  }

  const solvedAfterWrong = await page.evaluate(() => (window as any).__sv.forge.solved);
  expect(solvedAfterWrong).toBe(false);

  // pull every pebble back out, then re-place in the correct order
  const slotCount = correctOrder.length;
  for (let i = 0; i < slotCount; i++) {
    await page.evaluate((idx) => (window as any).__sv.forge.tapSlot(idx), i);
    await page.waitForTimeout(80);
  }
  for (const pebbleId of correctOrder) {
    await page.evaluate((id) => (window as any).__sv.forge.tapPebble(id), pebbleId);
    await page.waitForTimeout(80);
  }

  await page.waitForFunction(() => (window as any).__sv.forge.solved === true);
  const solved = await page.evaluate(() => (window as any).__sv.forge.solved);
  expect(solved).toBe(true);
});

test("back button returns to the menu from every loop", async ({ page }) => {
  for (const name of ["Sound Forge", "Market Day"]) {
    await page.getByRole("button", { name }).click();
    await expect(page.locator("canvas")).toBeVisible();
    await page.getByRole("button", { name: "← Loops" }).click();
    await expect(page.getByText("Choose a test loop")).toBeVisible();
  }
});

test("market day: paying the exact price with the solution coins solves the order", async ({ page }) => {
  const errors = trackErrors(page);
  await page.getByRole("button", { name: "Market Day" }).click();
  await expect(page.locator("canvas")).toBeVisible();
  await page.waitForFunction(() => (window as any).__sv?.market !== undefined);

  const solution: string[] = await page.evaluate(() => (window as any).__sv.market.solution);
  for (const coinId of solution) {
    await page.evaluate((id) => (window as any).__sv.market.tapCoin(id), coinId);
    await page.waitForTimeout(80);
  }

  await page.waitForFunction(() => (window as any).__sv.market.solved === true);
  const solved = await page.evaluate(() => (window as any).__sv.market.solved);
  expect(solved).toBe(true);
  expect(errors).toEqual([]);
});

test("market day: overpaying does not solve, and tapping the bowl recovers to exact", async ({ page }) => {
  await page.getByRole("button", { name: "Market Day" }).click();
  await page.waitForFunction(() => (window as any).__sv?.market !== undefined);

  const solution: string[] = await page.evaluate(() => (window as any).__sv.market.solution);
  for (const coinId of solution) {
    await page.evaluate((id) => (window as any).__sv.market.tapCoin(id), coinId);
    await page.waitForTimeout(80);
  }
  await page.waitForFunction(() => (window as any).__sv.market.solved === true);

  // overpay with one more coin from the purse, if any remain
  const purse: string[] = await page.evaluate(() => (window as any).__sv.market.state.purse);
  if (purse.length > 0) {
    await page.evaluate((id) => (window as any).__sv.market.tapCoin(id), purse[0]);
    await page.waitForTimeout(80);
    const solvedAfterOverpay = await page.evaluate(() => (window as any).__sv.market.solved);
    expect(solvedAfterOverpay).toBe(false);
    const remainingAfterOverpay = await page.evaluate(() => (window as any).__sv.market.remaining);
    expect(remainingAfterOverpay).toBeLessThan(0);

    await page.evaluate(() => (window as any).__sv.market.tapBowl());
    await page.waitForTimeout(80);
  }

  await page.waitForFunction(() => (window as any).__sv.market.solved === true);
  const solved = await page.evaluate(() => (window as any).__sv.market.solved);
  expect(solved).toBe(true);
});
