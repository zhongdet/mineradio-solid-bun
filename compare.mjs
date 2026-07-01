import { chromium } from "playwright";

const ORIGINAL = "http://localhost:3000";
const MIGRATED = "http://localhost:5173";

async function compare(page, url, label) {
  const errors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push({ type: "console.error", text: msg.text().substring(0, 300) });
  });
  page.on("pageerror", (err) => errors.push({ type: "pageerror", text: err.message.substring(0, 300) }));

  await page.goto(url, { waitUntil: "networkidle", timeout: 20000 }).catch(() => {});
  // Wait for splash ready + click to dismiss
  await page.waitForTimeout(7000);
  await page.evaluate(() => { document.getElementById("splash")?.click(); }).catch(() => {});
  await page.waitForTimeout(3000);

  const state = await page.evaluate(() => {
    // Bottom bar visible state
    const bar = document.getElementById("bottom-bar");
    const bottomVisible = bar
      ? bar.classList.contains("visible") && !bar.classList.contains("soft-hidden")
      : false;

    // Bottom handle
    const handle = document.getElementById("bottom-handle");
    const handleVisible = handle && getComputedStyle(handle).display !== "none" && getComputedStyle(handle).opacity > "0";

    // Search area
    const sa = document.getElementById("search-area");
    const searchPeek = sa?.classList.contains("peek");

    // Home visible
    const home = document.getElementById("empty-home");
    const homeVisible = home && getComputedStyle(home).display !== "none";

    // Login button text
    const userBtn = document.getElementById("user-btn");
    const userBtnText = userBtn?.textContent?.trim() || "";

    // Controls visibility
    const controlCluster = document.querySelector(".control-cluster") || document.getElementById("controls");
    const controlsVisible = controlCluster ? getComputedStyle(controlCluster).display !== "none" : "N/A";

    // Modals
    const modalMasks = document.querySelectorAll(".modal-mask, [class*=modal-mask]");
    const visibleModal = Array.from(modalMasks).find(
      (m) => getComputedStyle(m).display !== "none",
    );

    // Trial banner
    const trial = document.getElementById("trial-banner");
    const trialVisible = trial && getComputedStyle(trial).display !== "none";

    // Playlist panel
    const pl = document.getElementById("playlist-panel");
    const plVisible = pl && getComputedStyle(pl).display !== "none" && pl.classList.contains("peek");

    return {
      bottomBar: { visible: bottomVisible, class: bar?.className || "" },
      bottomHandle: { visible: handleVisible, class: handle?.className || "" },
      searchPeek,
      homeVisible,
      userBtnText,
      controlsVisible,
      visibleModalCount: visibleModal ? 1 : 0,
      trialVisible,
      playlistPanelVisible: plVisible,
      playBtn: document.getElementById("play-btn")?.outerHTML?.substring(0, 200) || "MISSING",
    };
  });

  await page.screenshot({ path: `/tmp/${label}.png`, fullPage: true });

  return { state, errors };
}

(async () => {
  console.log("=== ORIGINAL MINERADIO (port 3000) ===");
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--disable-gpu"] });
  const ctx1 = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page1 = await ctx1.newPage();
  const orig = await compare(page1, ORIGINAL, "original");
  console.log("State:", JSON.stringify(orig.state, null, 2));
  orig.errors.forEach((e) => console.log("ERR:", e.text));

  console.log("\n=== MIGRATED APP (port 5173) ===");
  const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page2 = await ctx2.newPage();
  const mig = await compare(page2, MIGRATED, "migrated");
  console.log("State:", JSON.stringify(mig.state, null, 2));
  mig.errors.forEach((e) => console.log("ERR:", e.text));

  // Detailed check: click login, check modal content
  console.log("\n=== LOGIN MODAL COMPARISON ===");

  for (const [url, page, label] of [
    [ORIGINAL, page1, "orig"],
    [MIGRATED, page2, "mig"],
  ]) {
    await page.goto(url, { waitUntil: "networkidle", timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(7000);
    await page.evaluate(() => { document.getElementById("splash")?.click(); }).catch(() => {});
    await page.waitForTimeout(3000);

    // Click login button
    const box = await page.locator("#user-btn").boundingBox();
    if (box) {
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      await page.waitForTimeout(800);
    }

    const loginState = await page.evaluate(() => {
      const mask = document.querySelector(".modal-mask, [class*=modal-mask]");
      const modal = document.querySelector(".modal, [class*=modal]");
      return {
        maskExists: !!mask,
        maskDisplay: mask ? getComputedStyle(mask).display : "N/A",
        modalExists: !!modal,
        modalDisplay: modal ? getComputedStyle(modal).display : "N/A",
        modalHTML: modal?.outerHTML?.substring(0, 1500) || "",
        modalClasses: modal?.className || "",
        hasLoginTabs: !!document.querySelector("[class*=login-platform-tabs]"),
        hasQR: !!document.getElementById("qr-shell"),
      };
    });
    console.log(`${label} login:`, JSON.stringify(loginState, null, 2));
  }

  // Detailed check: search
  console.log("\n=== SEARCH COMPARISON ===");
  for (const [url, page, label] of [
    [ORIGINAL, page1, "orig"],
    [MIGRATED, page2, "mig"],
  ]) {
    await page.goto(url, { waitUntil: "networkidle", timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(7000);
    await page.evaluate(() => { document.getElementById("splash")?.click(); }).catch(() => {});
    await page.waitForTimeout(3000);

    const inp = page.locator("#search-input");
    if (await inp.isVisible()) {
      await inp.click();
      await inp.fill("周杰伦");
      await page.waitForTimeout(500);
      await page.keyboard.press("Enter");
      await page.waitForTimeout(5000);

      const searchState = await page.evaluate(() => {
        const res = document.getElementById("search-results");
        const items = document.querySelectorAll(".search-result-item");
        const historyItems = document.querySelectorAll(".search-history-item, [class*=history]");
        return {
          resultsCount: items.length,
          showClass: res?.classList.contains("show") || res?.classList.contains("has-results"),
          historyCount: historyItems.length,
          firstResult: items[0]?.textContent?.trim().substring(0, 100) || "",
          resultsHTML: res?.innerHTML?.substring(0, 1000) || "",
          resultsClass: res?.className || "",
        };
      });
      console.log(`${label} search:`, JSON.stringify(searchState, null, 2));
    }
  }

  await browser.close();
})();
