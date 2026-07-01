import { createEffect, onCleanup, onMount } from "solid-js";
import { useUser } from "../stores/userStore";
import { useAuth } from "../stores/authStore";
import { usePlayback } from "../stores/playbackStore";
import { rpc } from "../lib/api";
import { getPlayQueueAt, getForcePlaybackControlsInteractive } from "../lib/playbackBridge";

export function usePlaylists() {
  const user = useUser();
  const auth = useAuth();
  const playback = usePlayback();

  async function doRefreshUserPlaylists(_force: boolean = false) {
    if (!auth.state.loginStatus.loggedIn) return;
    try {
      const data = await rpc<any>("user_playlist", { uid: auth.state.loginStatus.userId });
      const playlists = (data.playlist || []).map((p: any) => ({
        id: p.id,
        name: p.name,
        cover: p.picUrl || "",
        trackCount: p.trackCount || 0,
        provider: "netease",
      }));
      user.set("userPlaylists", playlists);
    } catch (err) {
      console.error("User playlists fetch failed:", err);
    }
  }

  // Watch login status: refresh playlists when login changes to logged in
  createEffect(() => {
    if (auth.state.loginStatus.loggedIn) {
      doRefreshUserPlaylists();
    }
  });

  // Also refresh on mount (in case already logged in from persistent session)
  onMount(() => {
    if (auth.state.loginStatus.loggedIn) {
      doRefreshUserPlaylists();
    }
  });

  async function loadPlaylistIntoQueueById(id: string, autoPlay: boolean = true, name: string = "") {
    try {
      const data = await rpc<any>("playlist_track_all", { id, limit: 1000 });
      const songs = (data.songs || []).map((s: any) => ({
        id: s.id,
        name: s.name,
        artist: (s.ar || [{}])[0]?.name || "Unknown",
        cover: s.al?.picUrl || "",
        duration: s.dt,
      }));
      if (!songs.length) return;
      playback.set("playQueue", songs);
      playback.set("currentIdx", 0);
      const forceInteractive = getForcePlaybackControlsInteractive();
      if (forceInteractive) forceInteractive();
      if (autoPlay) {
        const playQueueAt = getPlayQueueAt();
        if (playQueueAt) await playQueueAt(0).catch((e: any) => console.warn("[LoadPlaylist]", e));
      }
    } catch (err) {
      console.error("Load playlist failed:", err);
    }
  }

  // Listen for playlist refresh and load requests
  let refreshHandler: (() => void) | null = null;
  let loadHandler: ((e: Event) => void) | null = null;
  createEffect(() => {
    refreshHandler = () => doRefreshUserPlaylists(true);
    loadHandler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.id) loadPlaylistIntoQueueById(detail.id, true, detail.name || "");
    };
    window.addEventListener("mineradio-do-refresh-playlists", refreshHandler);
    window.addEventListener("mineradio-load-playlist", loadHandler);
  });
  onCleanup(() => {
    if (refreshHandler) window.removeEventListener("mineradio-do-refresh-playlists", refreshHandler);
    if (loadHandler) window.removeEventListener("mineradio-load-playlist", loadHandler);
  });

  async function toggleLikeSong(song: any) {
    const songId = String(song.id || song.mid);
    const isLiked = user.state.likedSongMap?.[songId];

    try {
      if (isLiked) {
        await rpc("like", { id: songId, like: false });
        const map = { ...(user.state.likedSongMap || {}) };
        delete map[songId];
        user.setLikedSongMap(map);
      } else {
        await rpc("like", { id: songId, like: true });
        user.setLikedSongMap({ ...(user.state.likedSongMap || {}), [songId]: true });
      }
    } catch (err) {
      console.warn("Like toggle failed:", err);
    }
  }

  async function syncLikeStatusForSong(song: any) {
    const songId = String(song.id || song.mid);
    try {
      const data = await rpc<any>("song_like_check", { id: songId });
      const liked = data?.like === true;
      const map = { ...(user.state.likedSongMap || {}) };
      if (liked) map[songId] = true;
      else delete map[songId];
      user.setLikedSongMap(map);
    } catch { /* ignore */ }
  }

  function openCollectModal(song: any) {
    user.openCollectModal(song);
  }

  async function addCollectTargetToPlaylist(pid: string) {
    if (!user.state.collectTargetSong) return;
    try {
      await rpc("playlist_track_add", { pid, tracks: [user.state.collectTargetSong.id] });
      user.closeCollectModal();
    } catch (err) {
      console.error("Add to playlist failed:", err);
    }
  }

  async function createPlaylistFromCollect(name: string) {
    try {
      const data = await rpc<any>("playlist_create", { name });
      if (data?.id && user.state.collectTargetSong) {
        await rpc("playlist_track_add", { pid: data.id, tracks: [user.state.collectTargetSong.id] });
      }
      user.closeCollectModal();
      doRefreshUserPlaylists();
    } catch (err) {
      console.error("Create playlist failed:", err);
    }
  }

  return {
    doRefreshUserPlaylists,
    toggleLikeSong,
    syncLikeStatusForSong,
    openCollectModal,
    addCollectTargetToPlaylist,
    createPlaylistFromCollect,
  };
}

export type PlaylistsHook = ReturnType<typeof usePlaylists>;
