import { createStore } from "solid-js/store";

export interface Song {
  id: string | number;
  name: string;
  artist: string;
  cover: string;
  duration?: number;
  mid?: string;
  songmid?: string;
  mediaMid?: string;
  media_mid?: string;
  type?: string;
  radioContext?: string;
  programId?: string;
  localKey?: string;
  [key: string]: any;
}

export interface PlaylistPanelDetailState {
  playlist: Song | null;
}

export type PlayMode = 'loop' | 'shuffle' | 'single';

export interface PlaybackStore {
  playlist: Song[];
  playQueue: Song[];
  currentIdx: number;
  playing: boolean;
  playToggleBusy: boolean;
  playMode: PlayMode;
  miniQueueOpen: boolean;
  queueViewTab: 'queue' | 'playlist' | 'podcast';
  currentSong: Song | null;
  playModeIndex: number;
}

const [playback, setPlayback] = createStore<PlaybackStore>({
  playlist: [],
  playQueue: [],
  currentIdx: -1,
  playing: false,
  playToggleBusy: false,
  playMode: 'loop',
  miniQueueOpen: false,
  queueViewTab: 'queue',
  currentSong: null,
  playModeIndex: 0,
});

const playModes: PlayMode[] = ['loop', 'shuffle', 'single'];

export function usePlayback() {
  return {
    state: playback,
    set: (key: keyof PlaybackStore, value: any) => {
      setPlayback(key, value);
    },
    setCurrentIdx: (idx: number) => {
      setPlayback("currentIdx", idx);
      setPlayback("currentSong", playback.playQueue[idx] || null);
    },
    togglePlay: () => {
      if (playback.playToggleBusy) return;
      setPlayback("playing", !playback.playing);
    },
    nextTrack: () => {
      if (playback.playQueue.length === 0) return;
      let nextIdx: number;
      if (playback.playMode === 'shuffle') {
        nextIdx = Math.floor(Math.random() * playback.playQueue.length);
      } else {
        nextIdx = (playback.currentIdx + 1) % playback.playQueue.length;
      }
      setPlayback("currentIdx", nextIdx);
      setPlayback("currentSong", playback.playQueue[nextIdx] || null);
    },
    prevTrack: () => {
      if (playback.playQueue.length === 0) return;
      const prevIdx = playback.currentIdx <= 0
        ? playback.playQueue.length - 1
        : playback.currentIdx - 1;
      setPlayback("currentIdx", prevIdx);
      setPlayback("currentSong", playback.playQueue[prevIdx] || null);
    },
    cyclePlayMode: () => {
      const nextIdx = (playback.playModeIndex + 1) % playModes.length;
      setPlayback("playMode", playModes[nextIdx]);
      setPlayback("playModeIndex", nextIdx);
    },
    shuffleQueue: () => {
      const arr = [...playback.playQueue];
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      setPlayback("playQueue", arr);
    },
    clearQueue: () => {
      setPlayback({
        playQueue: [],
        currentIdx: -1,
        currentSong: null,
        playing: false,
      });
    },
    removeFromQueue: (idx: number) => {
      const newQueue = [...playback.playQueue];
      newQueue.splice(idx, 1);
      let newIdx = playback.currentIdx;
      if (idx < playback.currentIdx) newIdx--;
      else if (idx === playback.currentIdx && newQueue.length > 0) {
        newIdx = Math.min(playback.currentIdx, newQueue.length - 1);
      }
      setPlayback({
        playQueue: newQueue,
        currentIdx: newIdx,
        currentSong: newQueue[newIdx] || null,
      });
    },
    addToQueue: (song: Song) => {
      setPlayback("playQueue", [...playback.playQueue, song]);
    },
    toggleMiniQueue: () => {
      setPlayback("miniQueueOpen", !playback.miniQueueOpen);
    },
    setQueueViewTab: (tab: 'queue' | 'playlist' | 'podcast') => {
      setPlayback("queueViewTab", tab);
    },
    togglePlaylistPanel: () => {
      setPlayback("miniQueueOpen", !playback.miniQueueOpen);
    },
  };
}

export type PlaybackStoreType = typeof playback;
