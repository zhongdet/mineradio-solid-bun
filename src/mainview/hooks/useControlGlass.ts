import { createEffect, onCleanup, onMount } from "solid-js";
import { useFx } from "../stores/fxStore";

function supportsControlGlassSvgFilter(): boolean {
  try {
    const ua = navigator.userAgent || "";
    if ((/Safari/.test(ua) && !/Chrome/.test(ua)) || /Firefox/.test(ua)) return false;
    const div = document.createElement("div");
    div.style.backdropFilter = "url(#mineradio-control-glass-filter)";
    return div.style.backdropFilter !== "";
  } catch {
    return false;
  }
}

function clampRange(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function normalizeControlGlassChromaticOffset(value: number): number {
  let n = Number(value);
  if (!isFinite(n)) n = 90;
  return clampRange(n, 0, 140);
}

/**
 * Returns 1 if element center is right of viewport center (gradient right-to-left),
 * -1 if left of viewport center (gradient left-to-right).
 */
function getGlassDirection(el: HTMLElement): number {
  const rect = el.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const viewportCenter = window.innerWidth / 2;
  return centerX >= viewportCenter ? 1 : -1;
}

function generateControlGlassDisplacementMap(
  width: number,
  height: number,
  radius: number,
  dir: number
): string {
  width = Math.max(240, Math.round(width || 400));
  height = Math.max(48, Math.round(height || 92));
  radius = Math.max(12, Math.round(radius || 50));
  const borderWidth = 0.07;
  const edge = Math.min(width, height) * (borderWidth * 0.5);
  const innerW = Math.max(1, width - edge * 2);
  const innerH = Math.max(1, height - edge * 2);
  // dir=1: right-to-left (x1=100% x2=0%), dir=-1: left-to-right (x1=0% x2=100%)
  const rx1 = dir >= 0 ? "100%" : "0%";
  const rx2 = dir >= 0 ? "0%" : "100%";
  const svg =
    '<svg viewBox="0 0 ' + width + " " + height + '" xmlns="http://www.w3.org/2000/svg">' +
    "<defs>" +
    '<linearGradient id="glass-red" x1="' + rx1 + '" y1="0%" x2="' + rx2 + '" y2="0%"><stop offset="0%" stop-color="#0000"/><stop offset="100%" stop-color="red"/></linearGradient>' +
    '<linearGradient id="glass-blue" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#0000"/><stop offset="100%" stop-color="blue"/></linearGradient>' +
    "</defs>" +
    '<rect x="0" y="0" width="' + width + '" height="' + height + '" fill="black"/>' +
    '<rect x="0" y="0" width="' + width + '" height="' + height + '" rx="' + radius + '" fill="url(#glass-red)"/>' +
    '<rect x="0" y="0" width="' + width + '" height="' + height + '" rx="' + radius + '" fill="url(#glass-blue)" style="mix-blend-mode:difference"/>' +
    '<rect x="' +
    edge.toFixed(2) +
    '" y="' +
    edge.toFixed(2) +
    '" width="' +
    innerW.toFixed(2) +
    '" height="' +
    innerH.toFixed(2) +
    '" rx="' +
    radius +
    '" fill="hsl(0 0% 50% / 1)" style="filter:blur(11px)"/>' +
    "</svg>";
  return "data:image/svg+xml," + encodeURIComponent(svg);
}

function updateGlassDisplacementMapForElement(
  el: HTMLElement | null,
  img: SVGImageElement | null,
  stateKey: string,
  cache: Record<string, string>
): void {
  if (!el || !img) return;
  const rect = el.getBoundingClientRect();
  if (rect.width < 2 || rect.height < 2) return;
  const radius = parseFloat(getComputedStyle(el).borderRadius) || 24;
  const dir = getGlassDirection(el);
  const key =
    Math.round(rect.width) + "x" + Math.round(rect.height) + ":" + Math.round(radius) + ":" + dir;
  if (key === cache[stateKey]) return;
  cache[stateKey] = key;
  const href = generateControlGlassDisplacementMap(rect.width, rect.height, radius, dir);
  img.setAttribute("href", href);
  try {
    img.setAttributeNS("http://www.w3.org/1999/xlink", "href", href);
  } catch {}
}

function updateSearchPillGlassDisplacementMap(
  img: SVGImageElement | null,
  cache: Record<string, string>
): void {
  if (!img) return;
  const nodes = Array.from(
    document.querySelectorAll<HTMLElement>(".search-mode-tabs button,.search-history-chip")
  );
  if (!nodes.length) return;
  let maxW = 0,
    maxH = 0,
    maxRadius = 14;
  nodes.forEach((el) => {
    if (!el || el.offsetParent === null) return;
    const rect = el.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) return;
    maxW = Math.max(maxW, rect.width);
    maxH = Math.max(maxH, rect.height);
    maxRadius = Math.max(
      maxRadius,
      parseFloat(getComputedStyle(el).borderRadius) || Math.round(rect.height / 2) || 14
    );
  });
  if (maxW < 2 || maxH < 2) return;
  const width = Math.max(96, Math.round(maxW));
  const height = Math.max(32, Math.round(maxH));
  const radius = Math.max(12, Math.min(Math.round(maxRadius), Math.round(height / 2) + 10));
  // Use first visible node's position for direction
  const firstVisible = nodes.find((el) => el && el.offsetParent !== null);
  const dir = firstVisible ? getGlassDirection(firstVisible) : 1;
  const key = width + "x" + height + ":" + radius + ":" + dir;
  if (key === cache.searchPillKey) return;
  cache.searchPillKey = key;
  const href = generateControlGlassDisplacementMap(width, height, radius, dir);
  img.setAttribute("href", href);
  try {
    img.setAttributeNS("http://www.w3.org/1999/xlink", "href", href);
  } catch {}
}

export function useControlGlass() {
  const fx = useFx();
  const glassCache: Record<string, string> = { key: "", searchBoxKey: "", searchPillKey: "" };

  function applyControlGlassChromaticOffset() {
    const offset = normalizeControlGlassChromaticOffset(fx.state.controlGlassChromaticOffset);

    // bottom-bar filter
    const bar = document.getElementById("bottom-bar");
    const barFilter = document.getElementById("mineradio-control-glass-filter");
    if (barFilter) {
      const barDir = bar ? getGlassDirection(bar) : 1;
      const barDx = String(barDir * -Math.round(offset));
      barFilter.querySelectorAll<SVGFEOffsetElement>("feOffset").forEach((node) => {
        node.setAttribute("dx", barDx);
        node.setAttribute("dy", "0");
      });
    }

    // search-box filter
    const searchBox = document.getElementById("search-box");
    const searchBoxFilter = document.getElementById("mineradio-search-box-glass-filter");
    if (searchBoxFilter) {
      const sDir = searchBox ? getGlassDirection(searchBox) : 1;
      const sDx = String(sDir * -Math.round(offset));
      searchBoxFilter.querySelectorAll<SVGFEOffsetElement>("feOffset").forEach((node) => {
        node.setAttribute("dx", sDx);
        node.setAttribute("dy", "0");
      });
    }

    // search-pill filter
    const searchTabs = document.getElementById("search-mode-tabs");
    const pillFilter = document.getElementById("mineradio-search-pill-glass-filter");
    if (pillFilter) {
      const pDir = searchTabs ? getGlassDirection(searchTabs) : 1;
      // Pill uses a smaller base offset (~34 vs 90), scale proportionally
      const pillOffset = offset * (34 / 90);
      const pDx = String(pDir * -Math.round(pillOffset));
      pillFilter.querySelectorAll<SVGFEOffsetElement>("feOffset").forEach((node) => {
        node.setAttribute("dx", pDx);
        node.setAttribute("dy", "0");
      });
    }
  }

  function updateControlGlassDisplacementMap() {
    updateGlassDisplacementMapForElement(
      document.getElementById("bottom-bar"),
      document.getElementById("control-glass-map") as SVGImageElement | null,
      "key",
      glassCache
    );
  }

  function updateSearchBoxGlassDisplacementMap() {
    updateGlassDisplacementMapForElement(
      document.getElementById("search-box"),
      document.getElementById("search-box-glass-map") as SVGImageElement | null,
      "searchBoxKey",
      glassCache
    );
  }

  function updateSearchPillGlassDisplacementMapLocal() {
    updateSearchPillGlassDisplacementMap(
      document.getElementById("search-pill-glass-map") as SVGImageElement | null,
      glassCache
    );
  }

  function updateAll() {
    requestAnimationFrame(() => {
      updateControlGlassDisplacementMap();
      updateSearchBoxGlassDisplacementMap();
      updateSearchPillGlassDisplacementMapLocal();
      applyControlGlassChromaticOffset();
    });
  }

  onMount(() => {
    if (supportsControlGlassSvgFilter()) {
      document.documentElement.classList.add("control-glass-svg-ok");
    }
    applyControlGlassChromaticOffset();
    updateControlGlassDisplacementMap();
    updateSearchBoxGlassDisplacementMap();
    updateSearchPillGlassDisplacementMapLocal();

    const bar = document.getElementById("bottom-bar");
    const searchBox = document.getElementById("search-box");
    const searchTabs = document.getElementById("search-mode-tabs");
    const searchResults = document.getElementById("search-results");

    let ro: ResizeObserver | null = null;
    if (window.ResizeObserver && (bar || searchBox || searchTabs || searchResults)) {
      ro = new ResizeObserver(updateAll);
      if (bar) ro.observe(bar);
      if (searchBox) ro.observe(searchBox);
      if (searchTabs) ro.observe(searchTabs);
      if (searchResults) ro.observe(searchResults);
    }

    let mo: MutationObserver | null = null;
    if (window.MutationObserver && (searchTabs || searchResults)) {
      mo = new MutationObserver(() => {
        requestAnimationFrame(updateSearchPillGlassDisplacementMapLocal);
      });
      if (searchTabs) mo.observe(searchTabs, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
      if (searchResults) mo.observe(searchResults, { childList: true, subtree: true });
    }

    const onResize = () => updateAll();
    window.addEventListener("resize", onResize);

    onCleanup(() => {
      window.removeEventListener("resize", onResize);
      if (ro) ro.disconnect();
      if (mo) mo.disconnect();
    });
  });

  createEffect(() => {
    const _offset = fx.state.controlGlassChromaticOffset;
    void _offset;
    applyControlGlassChromaticOffset();
  });
}
