// @ts-nocheck
import { test } from "@playwright/test";

test("search and select songs", async ({ page }) => {
  const errors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      errors.push(msg.text());
      console.error("Browser error:", msg.text());
    }
  });

  // Navigate to the app
  await page.goto("http://localhost:3001");
  console.log("Navigated to app");

  // Wait for splash or main UI
  await page.waitForTimeout(1500);
  await page.screenshot({ path: "playwright-1-splash.png" });
  console.log("Screenshot 1: splash/main");

  // Check for splash screen
  const splashVisible = await page.$("body.splash-active").catch(() => null);
  if (splashVisible) {
    console.log("Splash found, clicking to dismiss");
    await page.click("body");
    await page.waitForTimeout(800);
  }

  await page.screenshot({ path: "playwright-2-after-splash.png" });
  console.log("Screenshot 2: after splash");

  // Focus and type in search input
  const searchInput = page.locator("#search-input");
  const inputCount = await searchInput.count();
  console.log("Search inputs found:", inputCount);

  if (inputCount > 0) {
    // Scroll to input if needed
    await searchInput.scrollIntoViewIfNeeded().catch(() => {});

    // Focus and clear, then type
    await searchInput.focus();
    await page.waitForTimeout(200);

    // Select all text and clear
    await page.keyboard.down("Control");
    await page.keyboard.press("a");
    await page.keyboard.up("Control");
    await page.waitForTimeout(100);

    await searchInput.type("晴天", { delay: 50 });
    console.log("Typed '晴天'");
    await page.screenshot({ path: "playwright-3-typed.png" });

    // Press Enter to search
    await searchInput.press("Enter");
    console.log("Pressed Enter");

    // Wait for search results
    await page.waitForTimeout(3000);
    await page.screenshot({ path: "playwright-4-results.png" });
    console.log("Screenshot 4: search results");

    // Find result items - try multiple selectors
    const selectors = [
      ".search-song-item",
      ".search-result-item",
      "[class*='search-song']",
      "[class*='search-result']",
      ".song-list .list-item",
      ".search-list .song-item",
    ];

    let results = null;
    for (const sel of selectors) {
      results = page.locator(sel);
      const count = await results.count();
      if (count > 0) {
        console.log(`Found ${count} results with selector: ${sel}`);
        break;
      }
    }

    if (!results || (await results.count()) === 0) {
      // Try broader selectors
      const allItems = page.locator("[class*='song'], [class*='result'], [class*='search']");
      const allCount = await allItems.count();
      console.log(`Broader search found ${allCount} elements`);

      // Try to find clickable elements with song-like text
      const anyClickable = page.locator("div:has-text('晴天'), div:has-text('周杰伦'), div:has-text('周杰伦')");
      const clickableCount = await anyClickable.count();
      console.log(`Clickable elements found: ${clickableCount}`);
    }

    if (results) {
      const count = await results.count();
      console.log("Total results:", count);

      // Select 3rd, 4th, 5th
      for (let i = 2; i < 5 && i < count; i++) {
        console.log(`\n--- Selecting result ${i + 1} ---`);
        try {
          await results.nth(i).scrollIntoViewIfNeeded().catch(() => {});
          await page.waitForTimeout(300);

          await results.nth(i).click();
          console.log(`Clicked result ${i + 1}`);
          await page.waitForTimeout(1500);

          await page.screenshot({ path: `playwright-5-result-${i + 1}.png` });

          const title = await page.locator("#thumb-title, [class*='title']").first().textContent().catch(() => "N/A");
          console.log(`Title: ${title?.substring(0, 80)}`);
        } catch (err) {
          console.error(`Error on result ${i + 1}:`, err.message);
        }
      }
    }

    await page.screenshot({ path: "playwright-final.png" });
    console.log("Screenshot: final");
  }

  console.log(`\nConsole errors: ${errors.length}`);
  if (errors.length > 0) {
    console.log("Errors:", errors.slice(0, 5).join("\n"));
  }
});
