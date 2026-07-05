// @ts-nocheck
import { createEffect, onCleanup } from "solid-js";
import { useFx } from "../stores/fxStore";
import { usePlayback } from "../stores/playbackStore";
import { proxyImageUrl } from "../lib/api";

let pushTimer: ReturnType<typeof setInterval> | null = null;

export function useDesktopWallpaper() {
  const fx = useFx();
  const playback = usePlayback();

  async function pushState() {
    try {
      const apiPort = new URLSearchParams(location.search).get("apiPort");
      const base = apiPort ? `http://127.0.0.1:${apiPort}` : window.location.origin;
      const song = playback.state.currentSong;
      const payload: any = {
        enabled: fx.state.wallpaperMode,
        opacity: fx.state.wallpaperOpacity ?? 1,
        playing: playback.state.playing,
        title: song?.name || "",
        artist: song?.artist || "",
        cover: song?.cover ? proxyImageUrl(song.cover) : "",
        colors: fx.state.colors || {},
        preset: fx.state.preset ?? 0,
      };
      await fetch(`${base}/api/wallpaper-update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch { /* ignore */ }
  }

  // Push on wallpaper mode change
  createEffect(() => {
    const _enabled = fx.state.wallpaperMode;
    pushState();
  });

  // Push on song change
  createEffect(() => {
    const _song = playback.state.currentSong;
    if (fx.state.wallpaperMode) pushState();
  });

  // Push on play state change
  createEffect(() => {
    const _playing = playback.state.playing;
    if (fx.state.wallpaperMode) pushState();
  });

  // Periodic push while enabled
  createEffect(() => {
    if (fx.state.wallpaperMode) {
      if (pushTimer) clearInterval(pushTimer);
      pushTimer = setInterval(pushState, 2000);
    } else {
      if (pushTimer) { clearInterval(pushTimer); pushTimer = null; }
    }
  });

  onCleanup(() => {
    if (pushTimer) { clearInterval(pushTimer); pushTimer = null; }
  });
}
