// @ts-nocheck
import { Component, onMount, onCleanup } from "solid-js";
import { useSplashAnimation } from "../../hooks/useSplashAnimation";
import { updateEmptyHomeVisibility, shouldForceEmptyHomeAfterSplash, prewarmHomeWallpaperPreview, applyStartupStarfieldPreset } from "../../lib/homeVisibility";
import { maybeRunStartupVisualGuide, maybeRunStartupLoginGuide, maybeShowUploadTipOnce } from "../../lib/startupGuides";

const Splash: Component = () => {
  let splashEl: HTMLDivElement | undefined;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const perf = (name: string) => {
    try {
      const t = Math.round(performance.now());
      if (performance.mark) performance.mark(`mineradio:${name}`);
      console.debug("[MineradioPerf]", name, t + "ms");
    } catch (_) {}
  };

  const dismiss = () => {
    if (!splashEl) return;
    if (splashEl.classList.contains("hide") || splashEl.classList.contains("exiting")) return;
    if (timer) { clearTimeout(timer); timer = null; }
    perf("splash-dismiss");

    splashEl.classList.remove("ready");
    document.body.classList.add("splash-revealing");

    const content = splashEl.querySelector(".splash-content") as HTMLElement | null;
    if (content) {
      content.style.transition = "opacity 680ms cubic-bezier(.22,1,.36,1), transform 980ms cubic-bezier(.22,1,.36,1)";
      content.style.opacity = "0";
      content.style.transform = "translateY(-14px) scale(.986)";
    }

    splashEl.classList.add("exiting");

    setTimeout(() => {
      if (splashEl) {
        splashEl.classList.add("hide");
        splashEl.style.display = "none";
      }
      perf("home-revealed");
      document.body.classList.remove("splash-active");
      document.body.classList.remove("splash-revealing");
      requestAnimationFrame(() => {
        updateEmptyHomeVisibility({ forceLoad: true });
        let homeShown = document.body.classList.contains("empty-home-active");
        if (!homeShown && shouldForceEmptyHomeAfterSplash()) {
          homeShown = true;
          updateEmptyHomeVisibility({ forceLoad: true });
        }
        requestAnimationFrame(() => {
          const guideStarted = maybeRunStartupVisualGuide("splash");
          if (!guideStarted) maybeRunStartupLoginGuide("splash");
          setTimeout(maybeShowUploadTipOnce, 5200);
        });
      });
    }, 1180);
  };

  const requestEnter = () => {
    if (splashEl && splashEl.classList.contains("ready")) dismiss();
  };

  const onKeydown = (e: KeyboardEvent) => {
    if (!document.body.classList.contains("splash-active")) return;
    if (e.key === "Enter" || e.code === "Space") {
      e.preventDefault();
      requestEnter();
    }
  };

  useSplashAnimation();

  onMount(() => {
    perf("dom-content-loaded");
    document.body.classList.add("splash-active");
    prewarmHomeWallpaperPreview();
    applyStartupStarfieldPreset();

    if (splashEl) {
      splashEl.addEventListener("click", requestEnter);
    }
    document.addEventListener("keydown", onKeydown);

    const readyDelay = window.AudioContext || (window as any).webkitAudioContext ? 5000 : 900;
    timer = setTimeout(() => {
      if (!splashEl) return;
      perf("splash-ready");
      splashEl.classList.add("ready");
      splashEl.setAttribute("role", "button");
      splashEl.setAttribute("tabindex", "0");
      splashEl.setAttribute("aria-label", "点击进入 Mineradio");
      timer = null;
    }, readyDelay);
  });

  onCleanup(() => {
    if (timer) { clearTimeout(timer); timer = null; }
    if (splashEl) splashEl.removeEventListener("click", requestEnter);
    document.removeEventListener("keydown", onKeydown);
    document.body.classList.remove("splash-active");
    document.body.classList.remove("splash-revealing");
  });

  return (
    <div id="splash" ref={splashEl}>
      <canvas id="splash-canvas"></canvas>
      <div class="splash-bg-noise"></div>
      <div class="splash-content">
        <div class="splash-wordmark" id="splash-wordmark" aria-label="Mineradio">
          <span class="splash-word-mine">Mine</span>
          <span class="splash-word-radio" aria-label="radio">
            rad<span class="splash-word-i" aria-hidden="true"></span><span class="splash-word-o">o</span>
          </span>
        </div>
        <div class="splash-signal-line"></div>
        <div class="splash-sub">private visual radio</div>
        <div class="splash-enter" aria-hidden="true">点击进入</div>
      </div>
    </div>
  );
};

export default Splash;
