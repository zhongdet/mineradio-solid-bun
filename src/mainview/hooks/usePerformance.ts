import { useUi } from "../stores/uiStore";
import { useFx } from "../stores/fxStore";

export function usePerformance() {
  const ui = useUi();
  const fx = useFx();

  // Performance constants from app.js
  const RENDER_DPR_CAP = 1.35;
  const RENDER_PIXEL_BUDGET = 5200000;
  const RENDER_MIN_DPR = 0.72;

  function getRenderPixelRatio(): number {
    const device = window.devicePixelRatio || 1;
    const isDeepBackground = isDeepBackgroundMode();
    if (isDeepBackground) return Math.min(device, 0.30);

    const quality = normalizePerformanceQuality(fx.state.performanceQuality);
    let cap: number, budget: number, min: number;

    switch (quality) {
      case "eco": cap = 0.95; min = 0.56; budget = 2400000; break;
      case "balanced": cap = 1.12; min = 0.66; budget = 3800000; break;
      case "ultra": cap = 1.75; min = 0.85; budget = 7800000; break;
      default: cap = RENDER_DPR_CAP; min = RENDER_MIN_DPR; budget = RENDER_PIXEL_BUDGET;
    }

    const cssPixels = Math.max(1, innerWidth * innerHeight);
    const budgetCap = Math.sqrt(budget / cssPixels);
    const effectiveCap = Math.min(cap, budgetCap);
    return Math.max(min, Math.min(device, effectiveCap));
  }

  function isDeepBackgroundMode(): boolean {
    return !!(
      document.hidden ||
      ui.state.desktopRuntimeState.minimized ||
      ui.state.desktopRuntimeState.visible === false
    );
  }

  function normalizePerformanceQuality(quality: string): "eco" | "balanced" | "high" | "ultra" {
    if (["eco", "balanced", "ultra"].includes(quality)) return quality as any;
    return "high";
  }

  function normalizePerformanceBackgroundMode(mode: string, liveKeep: boolean): "auto" | "release" | "keep" {
    if (liveKeep) return "keep";
    if (mode === "release") return "release";
    return "auto";
  }

  function markRenderInteraction(_reason: string, holdMs: number = 900) {
    if (isDeepBackgroundMode()) return;
    ui.setRenderPerfState({ lastRenderAt: 0 });
    // Mark interaction boost
    setTimeout(() => {
      // Reset interaction state after hold
    }, holdMs);
  }

  function trimRuntimeCaches(reason: string, aggressive: boolean = false) {
    const protectedKeys: Record<string, boolean> = {};

    // Trim cover depth cache
    const coverKeys = Object.keys(ui.state.coverDepthCache);
    const keep = aggressive ? 4 : 10;
    let dropped = 0;
    if (coverKeys.length > keep) {
      const drop = coverKeys.length - keep;
      for (let i = 0; i < drop && i < coverKeys.length; i++) {
        if (!protectedKeys[coverKeys[i]]) {
          delete ui.state.coverDepthCache[coverKeys[i]];
          dropped++;
        }
      }
    }

    // Update runtime perf state
    ui.set("runtimePerfState", {
      ...ui.state.runtimePerfState,
      lastCacheTrimAt: performance.now(),
      cacheTrimCount: ui.state.runtimePerfState.cacheTrimCount + 1,
      lastCacheTrimReason: reason,
    });

    return dropped;
  }

  function collectRuntimePerfSnapshot() {
    return {
      render: {
        mode: ui.state.renderPerfState.mode,
        fps: ui.state.renderPerfState.fps,
        skipped: ui.state.renderPerfState.skipped,
        longFrames: ui.state.renderPerfState.longFrames,
      },
      runtime: ui.state.runtimePerfState,
      deepSleep: isDeepBackgroundMode(),
    };
  }

  function scheduleBackgroundCacheTrim() {
    if (!isDeepBackgroundMode()) return;
    setTimeout(() => {
      trimRuntimeCaches("deep-background", true);
    }, 900);
  }

  function shouldSkipFrame(): boolean {
    const now = performance.now();
    const lastRender = ui.state.renderPerfState.lastRenderAt;
    if (lastRender === 0) return false;

    const fps = ui.state.renderPerfState.fps || 60;
    const frameBudget = 1000 / fps;
    return (now - lastRender) < frameBudget;
  }

  function markRenderFrame() {
    ui.setRenderPerfState({ lastRenderAt: performance.now() });
  }

  return {
    getRenderPixelRatio,
    isDeepBackgroundMode,
    markRenderInteraction,
    trimRuntimeCaches,
    collectRuntimePerfSnapshot,
    scheduleBackgroundCacheTrim,
    shouldSkipFrame,
    markRenderFrame,
    normalizePerformanceQuality,
    normalizePerformanceBackgroundMode,
  };
}

export type PerformanceHook = ReturnType<typeof usePerformance>;
