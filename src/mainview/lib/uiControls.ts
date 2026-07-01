// @ts-nocheck
import { usePlayback } from "../stores/playbackStore";
import { useSettings } from "../stores/settingsStore";
import { useShelf } from "../stores/shelfStore";

let controlsHideTimer: ReturnType<typeof setTimeout> | null = null;
let controlsHandleDimTimer: ReturnType<typeof setTimeout> | null = null;
let controlsShelfSuppressUntil = 0;

const PEEK_HIDE_DELAY = 170;

export function hasActivePlaybackControls(): boolean {
  const pb = usePlayback();
  const audio = document.querySelector("audio") as HTMLAudioElement | null;
  return !!(pb.state.playing || (audio && !audio.paused) || (pb.state.playQueue.length > 0 && pb.state.currentIdx >= 0 && pb.state.playQueue[pb.state.currentIdx]));
}

export function setControlsHidden(hidden: boolean) {
  const bar = document.getElementById("bottom-bar");
  if (!bar) return;
  const settings = useSettings();
  if (hidden && (settings.state.controlsHovering || usePlayback().state.miniQueueOpen)) hidden = false;
  bar.classList.toggle("soft-hidden", !!hidden && settings.state.controlsAutoHide && bar.classList.contains("visible"));
  (bar as HTMLElement).style.pointerEvents = "";
  updateControlsChromeState();
}

export function isBottomControlsSuppressedForShelf(): boolean {
  const shelf = useShelf();
  return !!(shelf.state.pinnedOpen || (controlsShelfSuppressUntil && performance.now() < controlsShelfSuppressUntil));
}

export function suppressBottomControlsForShelf(duration?: number) {
  controlsShelfSuppressUntil = performance.now() + (duration == null ? 900 : duration);
  const settings = useSettings();
  settings.setControlsHovering(false);
  if (controlsHideTimer) { clearTimeout(controlsHideTimer); controlsHideTimer = null; }
  document.body.classList.remove("controls-handle-awake");
  const pb = usePlayback();
  if (pb.state.miniQueueOpen) pb.toggleMiniQueue();
  const bar = document.getElementById("bottom-bar");
  if (bar) {
    bar.classList.remove("visible", "soft-hidden");
    (bar as HTMLElement).style.pointerEvents = "";
  }
  updateControlsChromeState();
}

export function scheduleControlsHide(delay?: number) {
  if (controlsHideTimer) clearTimeout(controlsHideTimer);
  const settings = useSettings();
  if (!settings.state.controlsAutoHide) return;
  controlsHideTimer = setTimeout(() => {
    controlsHideTimer = null;
    if (!settings.state.controlsHovering) setControlsHidden(true);
  }, delay == null ? 480 : delay);
}

export function revealBottomControls(delay?: number) {
  if (document.body.classList.contains("home-controls-locked")) return;
  if (isBottomControlsSuppressedForShelf()) return;
  const bar = document.getElementById("bottom-bar");
  if (bar) bar.classList.add("visible");
  wakeBottomHandle();
  setControlsHidden(false);
  const settings = useSettings();
  if (settings.state.controlsAutoHide) scheduleControlsHide(delay == null ? 520 : delay);
}

export function updateControlsChromeState() {
  const bar = document.getElementById("bottom-bar");
  const handle = document.getElementById("bottom-handle");
  const active = !!(bar && bar.classList.contains("visible") && !bar.classList.contains("soft-hidden"));
  document.body.classList.toggle("controls-visible", active);
  if (handle) handle.classList.toggle("active", active);
}

export function wakeBottomHandle(duration?: number) {
  document.body.classList.add("controls-handle-awake");
  if (controlsHandleDimTimer) clearTimeout(controlsHandleDimTimer);
  controlsHandleDimTimer = setTimeout(() => {
    controlsHandleDimTimer = null;
    document.body.classList.remove("controls-handle-awake");
  }, duration == null ? 2000 : duration);
}

export function forcePlaybackControlsInteractive() {
  if (!hasActivePlaybackControls()) return;
  try {
    document.body.classList.remove("home-controls-locked");
    const bar = document.getElementById("bottom-bar");
    const settings = useSettings();
    if (bar) {
      (bar as HTMLElement).style.pointerEvents = "";
      if (!settings.state.controlsAutoHide) {
        bar.classList.add("visible");
        bar.classList.remove("soft-hidden");
      }
    }
    ["play-btn", "prev-btn", "next-btn", "mini-queue-btn", "heart-btn", "play-mode-btn", "collect-btn"].forEach((id) => {
      const btn = document.getElementById(id) as HTMLButtonElement | null;
      if (!btn) return;
      btn.disabled = false;
      btn.classList.remove("busy");
    });
    updateControlsChromeState();
    if (bar && bar.classList.contains("visible") && settings.state.controlsAutoHide && !settings.state.controlsHovering) scheduleControlsHide(220);
  } catch (e) {
    console.warn("[PlaybackControlsRestore]", e);
  }
}

export function setHomeControlsLocked(locked: boolean) {
  document.body.classList.toggle("home-controls-locked", !!locked);
  const bottom = document.getElementById("bottom-bar");
  if (bottom && locked && !hasActivePlaybackControls()) bottom.classList.add("soft-hidden");
  if (bottom && !locked) bottom.classList.remove("soft-hidden");
  if (locked) {
    const pb = usePlayback();
    if (pb.state.miniQueueOpen) pb.toggleMiniQueue();
  }
}

export function openHomePlayerConsole() {
  setHomeControlsLocked(false);
  const bar = document.getElementById("bottom-bar");
  if (bar) {
    bar.classList.add("visible");
    bar.classList.remove("soft-hidden");
    (bar as HTMLElement).style.pointerEvents = "";
  }
  wakeBottomHandle(2800);
  setControlsHidden(false);
  forcePlaybackControlsInteractive();
  updateControlsChromeState();
  const settings = useSettings();
  if (settings.state.controlsAutoHide) scheduleControlsHide(1800);
}
