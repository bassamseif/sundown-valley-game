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

test("menu renders all three loops with no console errors", async ({ page }) => {
  const errors = trackErrors(page);
  await expect(page.getByText("Choose a test loop")).toBeVisible();
  await expect(page.getByRole("button", { name: "Geometry Combining" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Water Pipe Alignment" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Structural Bridge" })).toBeVisible();
  expect(errors).toEqual([]);
});

test("geometry combining: solving a correct pair reaches solved state", async ({ page }) => {
  const errors = trackErrors(page);
  await page.getByRole("button", { name: "Geometry Combining" }).click();
  await expect(page.locator("canvas")).toBeVisible();

  // wait for the scene to mount its test hook
  await page.waitForFunction(() => (window as any).__sv?.geometry !== undefined);

  // c2 and c3 are both size 2 (a congruent match), per src/puzzles/geometryCombine.ts
  await page.evaluate(() => (window as any).__sv.geometry.tap("c2"));
  await page.evaluate(() => (window as any).__sv.geometry.tap("c3"));

  await page.waitForFunction(() => (window as any).__sv.geometry.solved === true);
  const solved = await page.evaluate(() => (window as any).__sv.geometry.solved);
  expect(solved).toBe(true);
  expect(errors).toEqual([]);
});

test("geometry combining: an incorrect pair does not solve and stays retryable", async ({ page }) => {
  await page.getByRole("button", { name: "Geometry Combining" }).click();
  await page.waitForFunction(() => (window as any).__sv?.geometry !== undefined);

  // c1 (size 1) and c2 (size 2) don't match
  await page.evaluate(() => (window as any).__sv.geometry.tap("c1"));
  await page.evaluate(() => (window as any).__sv.geometry.tap("c2"));

  const solved = await page.evaluate(() => (window as any).__sv.geometry.solved);
  expect(solved).toBe(false);

  // still retryable: a correct pair afterwards solves it
  await page.evaluate(() => (window as any).__sv.geometry.tap("c2"));
  await page.evaluate(() => (window as any).__sv.geometry.tap("c3"));
  await page.waitForFunction(() => (window as any).__sv.geometry.solved === true);
});

test("pipe alignment: rotating every cell to its required orientation solves it", async ({ page }) => {
  const errors = trackErrors(page);
  await page.getByRole("button", { name: "Water Pipe Alignment" }).click();
  await expect(page.locator("canvas")).toBeVisible();
  await page.waitForFunction(() => (window as any).__sv?.pipes !== undefined);

  // Straight cells cycle through 2 rotations, elbows through 4 — the
  // hook exposes each cell's required rotation (single source of truth
  // in src/puzzles/pipeAlign.ts) so this test doesn't hardcode the grid
  // layout itself. Each tap is its own page.evaluate + Playwright-level
  // wait (not an in-page setTimeout loop) — Chromium throttles timers
  // inside a single long-running evaluate() call, which made an
  // in-page async tap loop miss React's state flush intermittently.
  const cellCount = await page.evaluate(() => (window as any).__sv.pipes.required.length);
  for (let i = 0; i < cellCount; i++) {
    for (let guard = 0; guard < 4; guard++) {
      const [cur, req] = await page.evaluate(
        (idx) => [(window as any).__sv.pipes.orientations[idx], (window as any).__sv.pipes.required[idx]],
        i
      );
      if (cur === req) break;
      await page.evaluate((idx) => (window as any).__sv.pipes.tap(idx), i);
      await page.waitForTimeout(50);
    }
  }

  await page.waitForFunction(() => (window as any).__sv.pipes.solved === true);
  const solved = await page.evaluate(() => (window as any).__sv.pipes.solved);
  expect(solved).toBe(true);
  expect(errors).toEqual([]);
});

test("structural bridge: filling both slots with matching planks completes the bridge", async ({ page }) => {
  const errors = trackErrors(page);
  await page.getByRole("button", { name: "Structural Bridge" }).click();
  await expect(page.locator("canvas")).toBeVisible();
  await page.waitForFunction(() => (window as any).__sv?.bridge !== undefined);

  // s1 requires length 2 (p2), s2 requires length 1 (p1) per structuralBridge.ts
  await page.evaluate(() => (window as any).__sv.bridge.tapPlank("p2"));
  await page.evaluate(() => (window as any).__sv.bridge.tapSlot("s1"));
  await page.evaluate(() => (window as any).__sv.bridge.tapPlank("p1"));
  await page.evaluate(() => (window as any).__sv.bridge.tapSlot("s2"));

  await page.waitForFunction(() => (window as any).__sv.bridge.complete === true);
  const complete = await page.evaluate(() => (window as any).__sv.bridge.complete);
  expect(complete).toBe(true);
  expect(errors).toEqual([]);
});

test("structural bridge: wrong-length plank is rejected by the slot", async ({ page }) => {
  await page.getByRole("button", { name: "Structural Bridge" }).click();
  await page.waitForFunction(() => (window as any).__sv?.bridge !== undefined);

  // p3 (length 3) does not fit s2 (requires length 1)
  await page.evaluate(() => (window as any).__sv.bridge.tapPlank("p3"));
  await page.evaluate(() => (window as any).__sv.bridge.tapSlot("s2"));

  const filled = await page.evaluate(() => (window as any).__sv.bridge.filled);
  expect(filled.s2).toBeNull();
});

test("back button returns to the menu from every loop", async ({ page }) => {
  for (const name of ["Geometry Combining", "Water Pipe Alignment", "Structural Bridge"]) {
    await page.getByRole("button", { name }).click();
    await expect(page.locator("canvas")).toBeVisible();
    await page.getByRole("button", { name: "← Loops" }).click();
    await expect(page.getByText("Choose a test loop")).toBeVisible();
  }
});
