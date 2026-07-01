import { createStore } from "solid-js/store";

export interface ShelfStore {
  mode: 'side' | 'stage' | 'off';
  pinnedOpen: boolean;
  hoverCue: number;
  visibility: number;
  cards: any[];
  cardsDirty: boolean;
  rebuildReason: string;
  rebuildTimer: ReturnType<typeof setTimeout> | null;
}

const [shelf, setShelf] = createStore<ShelfStore>({
  mode: 'side',
  pinnedOpen: false,
  hoverCue: 0,
  visibility: 1,
  cards: [],
  cardsDirty: false,
  rebuildReason: '',
  rebuildTimer: null,
});

export function useShelf() {
  return {
    state: shelf,
    set: (key: keyof ShelfStore, value: any) => {
      setShelf(key, value);
    },
    setMode: (mode: 'side' | 'stage' | 'off') => {
      setShelf("mode", mode);
    },
    togglePinned: () => {
      setShelf("pinnedOpen", !shelf.pinnedOpen);
    },
    setHoverCue: (value: number) => {
      setShelf("hoverCue", value);
    },
    scheduleRebuild: (reason: string) => {
      setShelf("rebuildReason", reason);
      setShelf("cardsDirty", true);
      if (shelf.rebuildTimer) clearTimeout(shelf.rebuildTimer);
      shelf.rebuildTimer = setTimeout(() => {
        setShelf("cardsDirty", false);
        shelf.rebuildTimer = null;
      }, 100);
    },
    setCards: (cards: any[]) => {
      setShelf("cards", cards);
    },
    setVisibility: (v: number) => {
      setShelf("visibility", v);
    },
    rebuildShelf: (playQueue: any[], currentIdx: number) => {
      const cards: any[] = [];
      for (let i = 0; i < Math.min(playQueue.length, 30); i++) {
        const song = playQueue[i];
        if (!song) continue;
        cards.push({
          item: song,
          idx: i,
          cover: song.cover || "",
          isCurrent: i === currentIdx,
        });
      }
      setShelf("cards", cards);
      setShelf("cardsDirty", false);
    },
  };
}

export type ShelfStoreType = typeof shelf;
