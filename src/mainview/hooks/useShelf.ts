import { useShelf as useShelfStore } from "../stores/shelfStore";
import { usePlayback } from "../stores/playbackStore";

export function useShelf() {
  const shelf = useShelfStore();
  const playback = usePlayback();

  function setShelfMode(mode: 'side' | 'stage' | 'off') {
    shelf.set("mode", mode);
  }

  function getCards(): any[] {
    return shelf.state.cards;
  }

  function hasOpenContent(): boolean {
    return shelf.state.pinnedOpen || shelf.state.visibility > 0.1;
  }

  function scheduleShelfRebuild(reason: string, immediate: boolean = false) {
    shelf.set("rebuildReason", reason);
    shelf.set("cardsDirty", true);

    if (immediate) {
      rebuildShelf();
    } else {
      if (shelf.state.rebuildTimer) clearTimeout(shelf.state.rebuildTimer);
      shelf.state.rebuildTimer = setTimeout(() => {
        rebuildShelf();
        shelf.set("rebuildTimer", null);
      }, 100);
    }
  }

  function rebuildShelf() {
    const cards: any[] = [];

    // Add current queue items as shelf cards
    const queue = playback.state.playQueue;
    for (let i = 0; i < Math.min(queue.length, 30); i++) {
      const song = queue[i];
      if (!song) continue;
      cards.push({
        item: song,
        idx: i,
        cover: song.cover || "",
        isCurrent: i === playback.state.currentIdx,
      });
    }

    shelf.set("cards", cards);
    shelf.set("cardsDirty", false);
  }

  function updateShelfHoverCueFromPointer(e: MouseEvent) {
    const cards = shelf.state.cards;
    if (!cards.length) return;

    // Simple hover detection: check if pointer is near the shelf area
    const x = e.clientX;
    const y = e.clientY;
    const isNearShelf = x > window.innerWidth - 400 && y < window.innerHeight * 0.8;

    if (isNearShelf) {
      shelf.setHoverCue(1);
    } else {
      shelf.setHoverCue(0);
    }
  }

  function tickShelfHoverCue(dt: number) {
    const cue = shelf.state.hoverCue;
    if (cue > 0) {
      const newCue = Math.max(0, cue - dt * 3);
      shelf.setHoverCue(newCue);
      shelf.setVisibility(newCue);
    }
  }

  function togglePinned() {
    shelf.togglePinned();
  }

  function safeShelfRebuild(reason: string) {
    scheduleShelfRebuild(reason, true);
  }

  return {
    setShelfMode,
    getCards,
    hasOpenContent,
    scheduleShelfRebuild,
    rebuildShelf,
    updateShelfHoverCueFromPointer,
    tickShelfHoverCue,
    togglePinned,
    safeShelfRebuild,
  };
}

export type ShelfHook = ReturnType<typeof useShelf>;
