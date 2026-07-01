import { chromium } from "playwright";

const TARGET = "http://localhost:5173";
const consoleErrors = [];
const pageErrors = [];
const failedRequests = [];
const allResults = [];

(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"],
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });
  const page = await context.newPage();

  // Capture console messages
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      consoleErrors.push({ type: "console.error", text: msg.text() });
    } else if (msg.type() === "warning") {
      consoleErrors.push({ type: "console.warn", text: msg.text() });
    }
  });

  // Capture uncaught errors
  page.on("pageerror", (err) => {
    pageErrors.push(err.message);
  });

  page.on("requestfailed", (req) => {
    failedRequests.push({ url: req.url(), status: 0 });
  });

  page.on("response", (res) => {
    if (res.status() >= 400 && res.url().includes("/api/")) {
      failedRequests.push({ url: res.url(), status: res.status() });
    }
  });

  console.log("=== PHASE 0: Navigate and dismiss splash ===");
  try {
    await page.goto(TARGET, { waitUntil: "domcontentloaded", timeout: 30000 });
  } catch (e) {
    console.log("Navigation: " + e.message);
  }

  // Wait for splash to become ready (5s timer in code)
  console.log("Waiting for splash to become ready (6s)...");
  await page.waitForTimeout(6000);
  await page.screenshot({ path: "/tmp/mineradio-01-splash-ready.png" });

  // Click splash to dismiss
  console.log("Clicking splash to dismiss...");
  try {
    await page.click("#splash", { timeout: 3000 });
  } catch (e) {
    console.log("Splash click failed, trying force: " + e.message.substring(0, 100));
    try {
      await page.evaluate(() => {
        const splash = document.getElementById("splash");
        if (splash) splash.click();
      });
    } catch (e2) {
      console.log("Force click also failed");
    }
  }

  // Wait for dismiss animation (1.18s in code + buffer)
  console.log("Waiting for splash dismiss animation (2.5s)...");
  await page.waitForTimeout(2500);
  await page.screenshot({ path: "/tmp/mineradio-02-after-splash.png" });
  console.log("Post-splash screenshot saved.");

  // Verify splash is gone
  const splashHidden = await page.evaluate(() => {
    const splash = document.getElementById("splash");
    return !splash || splash.style.display === "none" || splash.classList.contains("hide");
  });
  console.log("Splash dismissed: " + splashHidden);

  if (!splashHidden) {
    console.log("Splash still visible, trying keyboard dismiss...");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(2500);
  }

  // Additional wait for home content to load
  await page.waitForTimeout(2000);

  // === PHASE 1: Collect ALL interactive elements ===
  console.log("\n=== PHASE 1: Collecting interactive elements ===");

  const interactiveElements = await page.evaluate(() => {
    const results = [];
    const seen = new Set();

    function cssSelector(el) {
      if (el.id) return "#" + el.id;
      let path = "";
      let current = el;
      let depth = 0;
      while (current && current !== document.body && depth < 6) {
        let selector = current.tagName.toLowerCase();
        if (current.id) {
          selector = "#" + current.id;
          path = selector + path;
          break;
        }
        if (current.className && typeof current.className === "string") {
          const classes = current.className.trim().split(/\s+/).filter(c => c && !c.includes("--") && !c.includes("splash")).slice(0, 2).join(".");
          if (classes) selector += "." + classes;
        }
        const parent = current.parentElement;
        if (parent) {
          const siblings = Array.from(parent.children).filter(c => c.tagName === current.tagName);
          if (siblings.length > 1) {
            const idx = siblings.indexOf(current) + 1;
            selector += ":nth-of-type(" + idx + ")";
          }
        }
        path = selector + (path ? " > " + path : "");
        current = current.parentElement;
        depth++;
      }
      return path;
    }

    function isVisible(el) {
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      return rect.width > 0 && rect.height > 0 &&
        style.display !== "none" && style.visibility !== "hidden" &&
        parseFloat(style.opacity) > 0;
    }

    function addElement(el, type, extra) {
      const sel = cssSelector(el);
      if (seen.has(sel)) return;
      seen.add(sel);
      results.push({
        selector: sel,
        tag: el.tagName.toLowerCase(),
        text: (el.textContent || "").trim().substring(0, 60),
        type: type,
        id: el.id,
        visible: isVisible(el),
        ...extra,
      });
    }

    // Buttons
    document.querySelectorAll("button, [role='button']").forEach((el) => {
      addElement(el, "button", {});
    });

    // Inputs
    document.querySelectorAll("input, textarea, select").forEach((el) => {
      addElement(el, el.type || "input", { placeholder: el.placeholder || "" });
    });

    // Clickable elements with cursor:pointer that have no children (leaf nodes)
    document.querySelectorAll("div, span").forEach((el) => {
      const style = window.getComputedStyle(el);
      if (style.cursor === "pointer" && el.children.length === 0 && (el.textContent || "").trim()) {
        addElement(el, "clickable", {});
      }
    });

    return results;
  });

  console.log("Found " + interactiveElements.length + " unique interactive elements.");
  console.log("Visible: " + interactiveElements.filter(e => e.visible).length);
  console.log("Hidden: " + interactiveElements.filter(e => !e.visible).length);

  // === PHASE 2: Test VISIBLE elements ===
  console.log("\n=== PHASE 2: Testing visible interactive elements ===");

  let testCount = 0;
  let errorCount = 0;

  for (const el of interactiveElements) {
    if (!el.visible) continue;
    testCount++;
    const label = "<" + el.tag + "> #" + el.id + " \"" + el.text.substring(0, 30) + "\" (" + el.type + ")";
    const errorsBefore = consoleErrors.length;
    const pageErrorsBefore = pageErrors.length;

    try {
      if (el.type === "range") {
        const box = await page.locator(el.selector).first().boundingBox();
        if (box) {
          await page.mouse.click(box.x + box.width * 0.7, box.y + box.height / 2);
          console.log("  [" + testCount + "] CLICKED slider: " + label);
        }
      } else if (el.type === "file") {
        console.log("  [" + testCount + "] SKIP file input: " + label);
        testCount--;
        continue;
      } else if (el.type === "text" || el.type === "search" || el.type === "textarea") {
        await page.locator(el.selector).first().click({ timeout: 3000 });
        console.log("  [" + testCount + "] FOCUSED input: " + label);
      } else {
        await page.locator(el.selector).first().click({ force: true, timeout: 3000 });
        console.log("  [" + testCount + "] CLICKED: " + label);
      }
      await page.waitForTimeout(400);
    } catch (e) {
      console.log("  [" + testCount + "] ERROR: " + label + " - " + (e.message || "").substring(0, 120));
      allResults.push({ label, error: (e.message || "").substring(0, 200) });
      errorCount++;
    }

    // Check for new errors
    const newConsole = consoleErrors.slice(errorsBefore);
    const newPage = pageErrors.slice(pageErrorsBefore);
    if (newConsole.length > 0 || newPage.length > 0) {
      console.log("    ** RUNTIME ERRORS triggered by: " + label);
      newConsole.forEach(err => {
        console.log("      " + err.type + ": " + err.text.substring(0, 400));
        allResults.push({ label, runtimeError: err.type + ": " + err.text.substring(0, 400) });
      });
      newPage.forEach(err => {
        console.log("      PAGEERROR: " + err.substring(0, 400));
        allResults.push({ label, runtimeError: "PAGEERROR: " + err.substring(0, 400) });
      });
    }
  }

  // === PHASE 3: Keyboard shortcuts ===
  console.log("\n=== PHASE 3: Testing keyboard shortcuts ===");
  const keys = [" ", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Escape", "Enter", "Tab",
    "1", "2", "3", "4", "5", "6", "7", "8", "9", "0",
    "f", "l", "v", "m"];

  for (const key of keys) {
    const errorsBefore = consoleErrors.length;
    const pageErrorsBefore = pageErrors.length;

    await page.keyboard.press(key);
    await page.waitForTimeout(200);

    const newConsole = consoleErrors.slice(errorsBefore);
    const newPage = pageErrors.slice(pageErrorsBefore);
    if (newConsole.length > 0 || newPage.length > 0) {
      console.log("  Key '" + key + "' triggered errors:");
      newConsole.forEach(err => {
        console.log("    " + err.type + ": " + err.text.substring(0, 400));
        allResults.push({ label: "key:" + key, runtimeError: err.type + ": " + err.text.substring(0, 400) });
      });
      newPage.forEach(err => {
        console.log("    PAGEERROR: " + err.substring(0, 400));
        allResults.push({ label: "key:" + key, runtimeError: "PAGEERROR: " + err.substring(0, 400) });
      });
    }
  }

  // === PHASE 4: Now open hidden panels and test them ===
  console.log("\n=== PHASE 4: Opening panels and testing hidden elements ===");

  // Try opening panels by clicking their toggle buttons
  const panelToggles = [
    { toggle: "#fx-fab", panel: "FxPanel", desc: "FX panel" },
    { toggle: "#playlist-pin-btn", panel: "PlaylistPanel", desc: "Playlist panel" },
    { toggle: "#bottom-handle", panel: "BottomBar expanded", desc: "Bottom bar" },
    { toggle: "#search-input", panel: "SearchArea", desc: "Search area" },
    { toggle: "#mini-queue-btn", panel: "Mini queue", desc: "Mini queue" },
    { toggle: "#home-btn", panel: "Home", desc: "Home" },
  ];

  for (const pt of panelToggles) {
    try {
      const isVisible = await page.evaluate((sel) => {
        const el = document.querySelector(sel);
        if (!el) return false;
        const rect = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);
        return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
      }, pt.toggle);

      if (isVisible) {
        console.log("  Opening " + pt.desc + "...");
        await page.click(pt.toggle, { force: true, timeout: 2000 });
        await page.waitForTimeout(800);
      } else {
        console.log("  Toggle not visible for " + pt.desc);
      }
    } catch (e) {
      console.log("  Could not open " + pt.desc + ": " + (e.message || "").substring(0, 100));
    }
  }

  await page.screenshot({ path: "/tmp/mineradio-03-panels-open.png" });

  // Re-scan for newly visible elements
  const newVisibleElements = await page.evaluate(() => {
    const results = [];
    const seen = new Set();

    function cssSelector(el) {
      if (el.id) return "#" + el.id;
      let path = "";
      let current = el;
      let depth = 0;
      while (current && current !== document.body && depth < 6) {
        let selector = current.tagName.toLowerCase();
        if (current.id) {
          selector = "#" + current.id;
          path = selector + path;
          break;
        }
        if (current.className && typeof current.className === "string") {
          const classes = current.className.trim().split(/\s+/).filter(c => c && !c.includes("--") && !c.includes("splash")).slice(0, 2).join(".");
          if (classes) selector += "." + classes;
        }
        const parent = current.parentElement;
        if (parent) {
          const siblings = Array.from(parent.children).filter(c => c.tagName === current.tagName);
          if (siblings.length > 1) {
            const idx = siblings.indexOf(current) + 1;
            selector += ":nth-of-type(" + idx + ")";
          }
        }
        path = selector + (path ? " > " + path : "");
        current = current.parentElement;
        depth++;
      }
      return path;
    }

    document.querySelectorAll("button, input[type='range'], [role='button']").forEach((el) => {
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      const visible = rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden" && parseFloat(style.opacity) > 0;
      if (visible) {
        const sel = cssSelector(el);
        if (!seen.has(sel)) {
          seen.add(sel);
          results.push({
            selector: sel,
            tag: el.tagName.toLowerCase(),
            text: (el.textContent || "").trim().substring(0, 60),
            id: el.id,
          });
        }
      }
    });

    return results;
  });

  console.log("Newly visible elements after opening panels: " + newVisibleElements.length);

  for (const el of newVisibleElements) {
    testCount++;
    const label = "<" + el.tag + "> #" + el.id + " \"" + el.text.substring(0, 30) + "\"";
    const errorsBefore = consoleErrors.length;
    const pageErrorsBefore = pageErrors.length;

    try {
      await page.locator(el.selector).first().click({ force: true, timeout: 2000 });
      console.log("  [" + testCount + "] CLICKED: " + label);
      await page.waitForTimeout(400);
    } catch (e) {
      console.log("  [" + testCount + "] ERROR: " + label + " - " + (e.message || "").substring(0, 120));
      continue;
    }

    const newConsole = consoleErrors.slice(errorsBefore);
    const newPage = pageErrors.slice(pageErrorsBefore);
    if (newConsole.length > 0 || newPage.length > 0) {
      console.log("    ** RUNTIME ERRORS triggered by: " + label);
      newConsole.forEach(err => {
        console.log("      " + err.type + ": " + err.text.substring(0, 400));
        allResults.push({ label, runtimeError: err.type + ": " + err.text.substring(0, 400) });
      });
      newPage.forEach(err => {
        console.log("      PAGEERROR: " + err.substring(0, 400));
        allResults.push({ label, runtimeError: "PAGEERROR: " + err.substring(0, 400) });
      });
    }
  }

  // Final screenshot
  await page.screenshot({ path: "/tmp/mineradio-99-final.png", fullPage: true });

  // === FINAL REPORT ===
  console.log("\n" + "=".repeat(70));
  console.log("                     FINAL REPORT");
  console.log("=".repeat(70));
  console.log("Total interactive elements tested: " + testCount);
  console.log("Click/interaction errors: " + errorCount);
  console.log("Total console errors: " + consoleErrors.length);
  console.log("Total uncaught page errors: " + pageErrors.length);
  console.log("Failed API requests: " + failedRequests.length);

  // Deduplicated runtime errors
  const runtimeErrors = allResults.filter(r => r.runtimeError);
  const uniqueRuntimeErrors = [...new Set(runtimeErrors.map(r => r.runtimeError))];

  if (uniqueRuntimeErrors.length > 0) {
    console.log("\n--- UNIQUE RUNTIME ERRORS (from console.error / pageerror) ---");
    uniqueRuntimeErrors.forEach((err, i) => {
      console.log("  [" + (i + 1) + "] " + err);
    });
    console.log("\n  These errors were triggered by:");
    runtimeErrors.forEach(r => {
      console.log("    -> " + r.label);
    });
  } else {
    console.log("\n--- No runtime errors detected! ---");
  }

  if (failedRequests.length > 0) {
    console.log("\n--- Failed API Requests ---");
    [...new Set(failedRequests.map(r => r.status + " " + r.url))].forEach((r, i) => {
      console.log("  [" + (i + 1) + "] " + r);
    });
  }

  if (consoleErrors.length > 0) {
    console.log("\n--- All Console Messages (errors + warnings) ---");
    consoleErrors.forEach((err, i) => {
      console.log("  [" + (i + 1) + "] " + err.type + ": " + err.text.substring(0, 400));
    });
  }

  await browser.close();
  console.log("\nDone.");
})();
