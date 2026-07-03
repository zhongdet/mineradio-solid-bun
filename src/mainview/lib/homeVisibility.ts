// @ts-nocheck
import { useHome } from "../stores/homeStore";
import { usePlayback } from "../stores/playbackStore";
import { useSettings } from "../stores/settingsStore";
import { useShelf } from "../stores/shelfStore";
import { useVisual } from "../stores/visualStore";
import { useFx } from "../stores/fxStore";
import { setHomeControlsLocked, revealBottomControls } from "./uiControls";
import { setPeek } from "./peek";

function shouldShowEmptyHomeCore(ignoreSplash: boolean): boolean {
  if (!ignoreSplash && document.body.classList.contains("splash-active")) return false;
  const settings = useSettings();
  if (settings.state.immersiveMode) return false;
  const home = useHome();
  if (home.state.homeForcedOpen) return true;
  if (home.state.homeSuppressed) return false;
  const shelf = useShelf();
  if (shelf.state.pinnedOpen) return false;
  const pb = usePlayback();
  if (pb.state.playQueue.length) return false;
  if (pb.state.currentIdx >= 0 && pb.state.playQueue[pb.state.currentIdx]) return false;
  if (pb.state.playing) return false;
  return true;
}

export function shouldShowEmptyHome(): boolean {
  return shouldShowEmptyHomeCore(false);
}

export function shouldShowEmptyHomeAfterSplash(): boolean {
  return shouldShowEmptyHomeCore(true);
}

export function shouldForceEmptyHomeAfterSplash(): boolean {
  const settings = useSettings();
  if (settings.state.immersiveMode) return false;
  const shelf = useShelf();
  if (shelf.state.pinnedOpen) return false;
  const pb = usePlayback();
  if (pb.state.playQueue.length) return false;
  if (pb.state.currentIdx >= 0 && pb.state.playQueue[pb.state.currentIdx]) return false;
  if (pb.state.playing) return false;
  return true;
}

export function shouldUseIdleWallpaperPreview(ignoreSplash?: boolean): boolean {
  if (!ignoreSplash && document.body.classList.contains("splash-active")) return false;
  const settings = useSettings();
  if (settings.state.immersiveMode) return false;
  const pb = usePlayback();
  if (pb.state.playing) return false;
  const shelf = useShelf();
  if (shelf.state.pinnedOpen) return false;
  return true;
}

export function activateHomeWallpaperPreview(_opts?: { skipTransition?: boolean; instant?: boolean }) {
  document.body.classList.add("home-wallpaper-preview");
  const visual = useVisual();
  visual.set("particleAlphaTarget", _opts?.instant ? 0.96 : 0.96);
  const fx = useFx();
  if (fx.state.preset !== 5) {
    fx.setPreset(5, { skipTransition: true, noSave: true });
  }
}

export function deactivateHomeWallpaperPreview(_playback?: boolean) {
  document.body.classList.remove("home-wallpaper-preview");
  const home = useHome();
  home.set("homeVisualPresetActive", false);
  const visual = useVisual();
  visual.set("particleAlphaTarget", 0);
}

export function applyStartupStarfieldPreset() {
  const pb = usePlayback();
  if (pb.state.playing || pb.state.currentIdx >= 0) return;
  const fx = useFx();
  if (fx.state.preset !== 5) {
    fx.setPreset(5, { skipTransition: true, noSave: true });
  }
}

export function switchPlaybackVisualPreset() {
  document.body.classList.remove("home-wallpaper-preview");
  const fx = useFx();
  const targetPreset = typeof fx.state.playbackVisualPreset === "number" ? fx.state.playbackVisualPreset : 0;
  if (fx.state.preset !== targetPreset) {
    fx.setPreset(targetPreset, { noSave: true });
  }
}

let homeWallpaperPrewarmStarted = false;
export function prewarmHomeWallpaperPreview() {
  if (homeWallpaperPrewarmStarted) return;
  homeWallpaperPrewarmStarted = true;
  if (!shouldUseIdleWallpaperPreview(true)) return;
  setTimeout(() => {
    if (!shouldUseIdleWallpaperPreview(true)) return;
    activateHomeWallpaperPreview({ skipTransition: true, instant: true });
  }, 900);
}

export function updateEmptyHomeVisibility(opts?: { forceLoad?: boolean }) {
  const show = shouldShowEmptyHome();
  const home = useHome();
  home.setEmptyHomeActive(show);
  document.body.classList.toggle("empty-home-active", show);
  if (show) setHomeControlsLocked(true);
  else setHomeControlsLocked(false);
  if (show) activateHomeWallpaperPreview();
  else deactivateHomeWallpaperPreview(false);
  if (show) {
    const sa = document.getElementById("search-area");
    setPeek(sa, true, "search");
  }
}
