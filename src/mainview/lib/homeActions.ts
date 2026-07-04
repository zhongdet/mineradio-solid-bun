// @ts-nocheck
/**
 * Home page card action handlers — ported from legacy app.js
 * These mirror the original Mineradio behavior exactly.
 */
import { useAuth } from "../stores/authStore";
import { useHome } from "../stores/homeStore";
import { usePlayback } from "../stores/playbackStore";
import { useSettings } from "../stores/settingsStore";
import { useShelf } from "../stores/shelfStore";
import { useUser } from "../stores/userStore";
import { useActionStore } from "../stores/actionStore";
import { rpc } from "./api";
import { startVisualGuide } from "./startupGuides";
import { setPeek } from "./peek";
import { setHomeControlsLocked, forcePlaybackControlsInteractive } from "./uiControls";
import { getPlayQueueAt } from "./playbackBridge";

// ---- Home Data Loading ----

let homeDiscoverLoading = false;

async function loadHomeDiscover(): Promise<void> {
  if (homeDiscoverLoading) return;
  const home = useHome();
  if (home.state.homeDiscoverState.loaded && !home.state.homeDiscoverState.loading) {
    // Check if we have data; if loaded but empty, we may still need to reload
    if (home.state.homeDiscoverState.songs.length || home.state.homeDiscoverState.playlists.length) return;
  }
  homeDiscoverLoading = true;
  if (!home.state.homeDiscoverState.loggedIn) {
    homeDiscoverLoading = false;
    return;
  }
  home.setHomeDiscoverLoading(true);
  try {
    const [personalized, _recommend, playlists] = await Promise.all([
      rpc<any>("personalized", { limit: 12 }).catch(() => ({ result: { songList: [] } })),
      rpc<any>("recommend_songs", {}).catch(() => ({ data: { dailySongs: [] } })),
      rpc<any>("personalized_playlist", { limit: 12 }).catch(() => ({ result: { list: [] } })),
    ]);
    const songs = (personalized.result?.songList || []).map((s: any) => ({
      id: s.id,
      name: s.name,
      artist: (s.artists || [{}])[0]?.name || "Unknown",
      cover: s.al?.picUrl || "",
      duration: s.dt,
    }));
    const playlistItems = (personalized.result?.playlist || playlists.result?.list || []).map((p: any) => ({
      id: p.id,
      name: p.name,
      cover: p.picUrl || "",
      trackCount: p.trackCount || 0,
    }));
    home.setHomeDiscoverResults(songs, playlistItems, []);
  } catch (err) {
    console.error("Home discover load failed:", err);
    home.setHomeDiscoverError("Discover load failed");
  } finally {
    homeDiscoverLoading = false;
  }
}

// ---- Toast ----
let toastTimer: ReturnType<typeof setTimeout> | null = null;

export function showToast(msg: string) {
  const t = document.getElementById("toast");
  if (!t) return;
  t.textContent = msg;
  t.classList.add("show");
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 2600);
}

// ---- Helpers ----
function hasAnyPlatformLogin(): boolean {
  const auth = useAuth();
  return !!(auth.state.loginStatus.loggedIn || auth.state.qqLoginStatus.loggedIn);
}

function homeListenSummary() {
  const home = useHome();
  const stats = home.state.listenStatsState;
  const recent = (stats.recentSongs && stats.recentSongs[0]) || null;
  let topSong = null;
  let topArtist = null;
  if (stats.favoriteArtist) topArtist = { name: stats.favoriteArtist };
  return { recent, topSong, topArtist, totalPlays: stats.totalSongs };
}

function openPlaylistPanelTab(tab: string, preserve?: boolean) {
  const playback = usePlayback();
  const mapped = tab === "podcasts" ? "podcasts" : tab === "playlists" ? "playlists" : "queue";
  playback.set("queueViewTab", mapped as any);
  useActionStore.getState().playlistTab(mapped);
  const panel = document.getElementById("playlist-panel");
  if (panel && preserve !== false) (panel as any).dataset.preserveTabOnOpen = "1";
  if (panel) setPeek(panel, true, "pl");
}

function runHomeSearch(query: string) {
  useActionStore.getState().homeSearch(query);
}

function songFromListenRecord(record: any) {
  if (!record) return null;
  let provider = record.sourceKey || "";
  if (!provider && record.type === "qq") provider = "qq";
  if (!provider) provider = record.mid ? "qq" : "netease";
  return {
    provider,
    source: provider,
    type: record.type || (provider === "qq" ? "qq" : "song"),
    id: record.id || record.mid || record.key || "",
    mid: record.mid || "",
    songmid: record.mid || "",
    mediaMid: record.mediaMid || "",
    name: record.name || "继续听",
    artist: record.artist || "",
    cover: record.cover || "",
  };
}

function cloneSong(song: any) {
  return { ...song };
}

// ---- Home Card Actions ----

export function openHomeLibrary() {
  if (!hasAnyPlatformLogin()) {
    startVisualGuide({ source: 'home', manual: true });
    return;
  }
  const home = useHome();
  home.setHomeSuppressed(false);
  setHomeControlsLocked(false);
  openPlaylistPanelTab("playlists", true);
  useActionStore.getState().refreshPlaylists();
}

export function playHomeSong(index: number) {
  const home = useHome();
  home.set("homeForcedOpen", false);
  home.set("homeSuppressed", false);
  setHomeControlsLocked(false);

  const song = home.state.homeDiscoverState.songs[index];
  if (!song) {
    if (index > 0) playHomePrivateRadio();
    else playHomeDaily();
    return;
  }

  const playback = usePlayback();
  const queueSongs = home.state.homeDiscoverState.songs.map(cloneSong);
  playback.set("playQueue", queueSongs);
  playback.set("currentIdx", Math.max(0, Math.min(playback.state.playQueue.length - 1, index)));
  forcePlaybackControlsInteractive();

  // Rebuild shelf (mini queue) with new queue data
  const shelf = useShelf();
  shelf.rebuildShelf(queueSongs, playback.state.currentIdx);

  const playQueueAt = getPlayQueueAt();
  if (playQueueAt) {
    playQueueAt(playback.state.currentIdx).catch((e: any) => console.warn("[HomeSongPlay]", e));
  }
}

async function playHomeDaily() {
  const home = useHome();
  home.set("homeForcedOpen", false);
  home.set("homeSuppressed", false);
  setHomeControlsLocked(false);

  const auth = useAuth();
  if (!hasAnyPlatformLogin()) {
    auth.showLoginModal();
    return;
  }

  // Load discover data if not yet loaded
  if (!home.state.homeDiscoverState.songs.length) {
    await loadHomeDiscover();
  }

  const songs = home.state.homeDiscoverState.songs;
  if (!songs.length) {
    runHomeSearch("每日推荐");
    return;
  }

  const playback = usePlayback();
  const queueSongs = songs.map(cloneSong);
  playback.set("playQueue", queueSongs);
  playback.set("currentIdx", 0);
  forcePlaybackControlsInteractive();

  // Rebuild shelf (mini queue) with new queue data
  const shelf = useShelf();
  shelf.rebuildShelf(queueSongs, 0);

  const playQueueAt = getPlayQueueAt();
  if (playQueueAt) {
    await playQueueAt(0).catch((e: any) => console.warn("[HomeDailyPlay]", e));
  }
}

async function playHomePrivateRadio() {
  const home = useHome();
  home.set("homeForcedOpen", false);
  home.set("homeSuppressed", false);
  setHomeControlsLocked(false);

  const auth = useAuth();
  if (!hasAnyPlatformLogin()) {
    auth.showLoginModal();
    return;
  }

  // Load discover data if not yet loaded
  if (!home.state.homeDiscoverState.songs.length && !home.state.homeDiscoverState.playlists.length) {
    await loadHomeDiscover();
  }

  const songs = home.state.homeDiscoverState.songs;
  if (songs.length) {
    const playback = usePlayback();
    const queueSongs = songs.map(cloneSong);
    playback.set("playQueue", queueSongs);
    playback.set("currentIdx", 0);
    forcePlaybackControlsInteractive();

    // Rebuild shelf (mini queue) with new queue data
    const shelf = useShelf();
    shelf.rebuildShelf(queueSongs, 0);

    const playQueueAt = getPlayQueueAt();
    if (playQueueAt) {
      await playQueueAt(0).catch((e: any) => console.warn("[HomePrivatePlay]", e));
    }
    return;
  }

  const playlists = home.state.homeDiscoverState.playlists;
  if (playlists.length && playlists[0]?.id) {
    useActionStore.getState().loadPlaylist(playlists[0].id, playlists[0].name || "私人雷达");
    return;
  }

  openHomeLibrary();
}

export function playHomeRecent(record?: any) {
  const home = useHome();
  home.set("homeForcedOpen", false);
  home.set("homeSuppressed", false);
  setHomeControlsLocked(false);

  const summary = homeListenSummary();
  record = record || summary.recent;

  if (!record) {
    showToast("还没有听歌记录");
    return;
  }

  const song = songFromListenRecord(record);
  if (!song || (!song.id && !song.mid)) {
    runHomeSearch(record.name || "");
    return;
  }

  const playback = usePlayback();
  const queueSongs = [cloneSong(song)];
  playback.set("playQueue", queueSongs);
  playback.set("currentIdx", 0);
  forcePlaybackControlsInteractive();

  // Rebuild shelf (mini queue) with new queue data
  const shelf = useShelf();
  shelf.rebuildShelf(queueSongs, 0);

  const playQueueAt = getPlayQueueAt();
  if (playQueueAt) {
    playQueueAt(0).catch((e: any) => console.warn("[HomeRecentPlay]", e));
  }
}

export function openHomeInsight() {
  const summary = homeListenSummary();
  if (summary.topArtist && summary.topArtist.name) {
    runHomeSearch(summary.topArtist.name);
    return;
  }
  if (summary.topSong && summary.topSong.name) {
    runHomeSearch(summary.topSong.name);
    return;
  }
  showToast("播放几首歌后会生成听歌画像");
}
