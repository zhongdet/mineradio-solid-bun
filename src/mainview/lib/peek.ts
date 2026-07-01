// @ts-nocheck
import { useSettings } from "../stores/settingsStore";
import { usePlayback } from "../stores/playbackStore";
import { useShelf } from "../stores/shelfStore";

const PEEK_HIDE_DELAY = 170;
const peekTimers: Record<string, ReturnType<typeof setTimeout> | null> = {};

export function setPeek(el: HTMLElement | null, on: boolean, key: string) {
  if (!el) return;
  const settings = useSettings();
  const playback = usePlayback();
  const shelf = useShelf();

  if (settings.state.immersiveMode && on && (key === "search" || key === "fx")) return;
  if (on && !settings.state.diyPlayerMode && key === "fx") return;
  if (!on && key === "search" && document.body.classList.contains("empty-home-active") && !settings.state.immersiveMode) return;
  if (!on && key === "pl" && settings.state.playlistPanelPinned) return;
  if (on && key === "fx") document.body.classList.remove("fullscreen-diy-peek");

  if (on) {
    const wasPeek = el.classList.contains("peek");
    if (peekTimers[key]) { clearTimeout(peekTimers[key]!); peekTimers[key] = null; }
    if (key === "fx") el.classList.remove("closing");
    if (key === "pl" && !wasPeek && playback.state.playQueue.length === 0 && playback.state.queueViewTab === "queue") {
      playback.setQueueViewTab("playlist");
    }
    if (key === "pl" && !wasPeek && playback.state.playQueue.length && playback.state.currentIdx >= 0) {
      if ((el as any).dataset?.preserveTabOnOpen === "1") delete (el as any).dataset.preserveTabOnOpen;
      else if (playback.state.queueViewTab !== "queue") playback.setQueueViewTab("queue");
    } else if (key === "pl" && (el as any).dataset?.preserveTabOnOpen === "1") {
      delete (el as any).dataset.preserveTabOnOpen;
    }
    el.classList.add("peek");
    if (key === "fx") {
      const fabOn = document.getElementById("fx-fab");
      if (fabOn) fabOn.classList.add("active");
    }
  } else {
    if (peekTimers[key]) clearTimeout(peekTimers[key]!);
    peekTimers[key] = setTimeout(() => {
      el.classList.remove("peek");
      if (key === "fx") {
        const fabOff = document.getElementById("fx-fab");
        if (fabOff && !el.classList.contains("show")) fabOff.classList.remove("active");
      }
      peekTimers[key] = null;
    }, PEEK_HIDE_DELAY);
  }
}
