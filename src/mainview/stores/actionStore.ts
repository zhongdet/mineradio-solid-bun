import { create } from "zustand";

// ── Action Callbacks Interface ──
// Each hook registers its methods here after initialization.

interface ActionCallbacks {
  // Search
  doSearch: (query: string, opts?: { autoPlayFirst?: boolean }) => void;
  loadPodcastHot: () => void;
  setSearchMode: (mode: string) => void;

  // Playback control (via useAudioPlayback)
  togglePlay: () => void;
  nextTrack: () => void;
  prevTrack: () => void;
  volumeUp: () => void;
  volumeDown: () => void;

  // Playlists
  loadPlaylist: (id: string, name?: string) => void;
  refreshPlaylists: () => void;

  // Auth
  openWebLogin: () => void;
  submitQQCookie: (cookie?: string) => void;
  logout: () => void;
  refreshLoginStatus: () => void;
  toggleLike: (songId: string) => void;
  collectSong: (song: any) => void;

  // Home
  playHomeSong: (index: number) => void;
  playHomeRecent: (record: any) => void;

  // UI
  openHotkeyModal: () => void;
  openTrackDetail: (type: "song" | "artist") => void;
  openUpdateModal: () => void;
  openCoverCrop: (img: HTMLImageElement, dataUrl: string) => void;
  setPlaylistTab: (tab: string) => void;
  homeSearch: (query: string) => void;
}

// ── Public ActionStore Interface ──

export interface ActionStoreState {
  // Register callbacks from hooks
  register: (cbs: Partial<ActionCallbacks>) => void;

  // Search actions
  search: (query: string, mode?: string) => void;
  podcastHot: () => void;
  homeSearch: (query: string) => void;
  setSearchMode: (mode: string) => void;
  loadPodcastHot: () => void;

  // Playback control
  hotkey: (action: string) => void;
  togglePlay: () => void;
  nextTrack: () => void;
  prevTrack: () => void;
  volumeUp: () => void;
  volumeDown: () => void;

  // Playlists
  loadPlaylist: (id: string, name?: string) => void;
  refreshPlaylists: () => void;
  playlistTab: (tab: string) => void;

  // Auth
  openWebLogin: () => void;
  submitQQCookie: (cookie?: string) => void;
  logout: () => void;
  refreshLoginStatus: () => void;
  toggleLike: (song: any, idx?: number) => void;
  collectSong: (song: any) => void;

  // Home
  playHomeSong: (index: number) => void;
  playHomeRecent: (record: any) => void;

  // UI
  revealIdleParticles: (delay: number) => void;
  openHotkeyModal: () => void;
  openTrackDetail: (type: "song" | "artist") => void;
}

let callbacks: Partial<ActionCallbacks> = {};

export const useActionStore = create<ActionStoreState>((_set) => ({
  // Registration
  register: (cbs: Partial<ActionCallbacks>) => {
    callbacks = { ...callbacks, ...cbs };
  },

  // Search
  search: (query, mode) => {
    if (mode) callbacks.setSearchMode?.(mode);
    callbacks.doSearch?.(query);
  },
  podcastHot: () => callbacks.loadPodcastHot?.(),
  homeSearch: (query) => callbacks.homeSearch?.(query),
  setSearchMode: (mode) => callbacks.setSearchMode?.(mode),
  loadPodcastHot: () => callbacks.loadPodcastHot?.(),

  // Playback control
  hotkey: (action) => {
    switch (action) {
      case "togglePlay": callbacks.togglePlay?.(); break;
      case "nextTrack": callbacks.nextTrack?.(); break;
      case "prevTrack": callbacks.prevTrack?.(); break;
      case "volumeUp": callbacks.volumeUp?.(); break;
      case "volumeDown": callbacks.volumeDown?.(); break;
      case "goHome":
        window.dispatchEvent(new CustomEvent("mineradio-go-home"));
        break;
      case "exitOrClose":
        window.dispatchEvent(new CustomEvent("mineradio-exit-or-close"));
        break;
      case "toggleLyricsPanel":
        window.dispatchEvent(new CustomEvent("mineradio-toggle-lyrics-panel"));
        break;
      case "toggleFxPanel":
        window.dispatchEvent(new CustomEvent("mineradio-toggle-fx-panel"));
        break;
      case "toggleImmersive":
        window.dispatchEvent(new CustomEvent("mineradio-toggle-immersive"));
        break;
      case "toggleDesktopLyrics":
        window.dispatchEvent(new CustomEvent("mineradio-toggle-desktop-lyrics"));
        break;
    }
  },
  togglePlay: () => callbacks.togglePlay?.(),
  nextTrack: () => callbacks.nextTrack?.(),
  prevTrack: () => callbacks.prevTrack?.(),
  volumeUp: () => callbacks.volumeUp?.(),
  volumeDown: () => callbacks.volumeDown?.(),

  // Playlists
  loadPlaylist: (id, name) => callbacks.loadPlaylist?.(id, name),
  refreshPlaylists: () => callbacks.refreshPlaylists?.(),
  playlistTab: (tab) => callbacks.setPlaylistTab?.(tab),

  // Auth
  openWebLogin: () => callbacks.openWebLogin?.(),
  submitQQCookie: (cookie) => callbacks.submitQQCookie?.(cookie),
  logout: () => callbacks.logout?.(),
  refreshLoginStatus: () => callbacks.refreshLoginStatus?.(),
  toggleLike: (song, _idx) => {
    const songId = String(song?.id || song?.mid);
    if (songId) callbacks.toggleLike?.(songId);
  },
  collectSong: (song) => callbacks.collectSong?.(song),

  // Home
  playHomeSong: (index) => callbacks.playHomeSong?.(index),
  playHomeRecent: (record) => callbacks.playHomeRecent?.(record),

  // UI
  revealIdleParticles: (_delay) => {
    // Dead code — no receivers. Kept as no-op for backward compat.
  },
  openHotkeyModal: () => callbacks.openHotkeyModal?.(),
  openTrackDetail: (type) => callbacks.openTrackDetail?.(type),
  openUpdateModal: () => callbacks.openUpdateModal?.(),
  openCoverCrop: (img, dataUrl) => callbacks.openCoverCrop?.(img, dataUrl),
}));
