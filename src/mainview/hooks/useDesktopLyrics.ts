// @ts-nocheck
import { createEffect, onCleanup } from "solid-js";
import { useFx } from "../stores/fxStore";
import { useLyrics } from "../stores/lyricsStore";
import { useVisual } from "../stores/visualStore";
import { usePlayback } from "../stores/playbackStore";

let lastPushTime = 0;
let lastText = "";

export function useDesktopLyrics() {
  const fx = useFx();
  const lyrics = useLyrics();
  const visual = useVisual();
  const playback = usePlayback();

  const pushState = async () => {
    if (!fx.state.desktopLyrics) return;
    const now = performance.now();
    if (now - lastPushTime < 50) return;

    const idx = lyrics.state.currentLyricIdx;
    const lines = lyrics.state.lines;
    const text = idx >= 0 && idx < lines.length ? lines[idx].text : "";

    if (text === lastText && now - lastPushTime < 900) return;
    lastText = text;
    lastPushTime = now;

    const current = playback.state.currentSong;
    const payload = {
      enabled: fx.state.desktopLyrics,
      text,
      title: current?.name || "",
      artist: current?.artist || "",
      playing: playback.state.playing,
      size: fx.state.desktopLyricsSize,
      opacity: fx.state.desktopLyricsOpacity,
      y: fx.state.desktopLyricsY,
      clickThrough: fx.state.desktopLyricsClickThrough,
      cinema: fx.state.desktopLyricsCinema,
      highlightFollow: fx.state.desktopLyricsHighlight,
      frameRate: fx.state.desktopLyricsFps,
      letterSpacing: fx.state.lyricLetterSpacing * 100,
      lineHeight: fx.state.lyricLineHeight,
      lyricScale: fx.state.lyricScale,
      fontWeight: fx.state.lyricWeight,
      motion: {
        beatGlow: visual.state.lyricSunEnergy || 0,
        glowBreath: visual.state.lyricSunHold || 0,
        sunEnergy: visual.state.lyricSunEnergy || 0,
      },
      colors: {
        primary: fx.state.lyricColor,
        highlight: fx.state.lyricHighlightColor,
        glow: fx.state.lyricGlowColor,
      },
    };

    try {
      const apiPort = new URLSearchParams(window.location.search).get("apiPort") || "3001";
      await fetch(`http://127.0.0.1:${apiPort}/api/desktop-lyrics-update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch {
      // Overlay window may not be running
    }
  };

  // Sync enabled state
  createEffect(() => {
    const enabled = fx.state.desktopLyrics;
    pushState();
  });

  // Periodic push when playing
  let interval = 0;
  createEffect(() => {
    if (playback.state.playing && fx.state.desktopLyrics) {
      interval = setInterval(pushState, 100);
    } else {
      clearInterval(interval);
    }
  });

  onCleanup(() => clearInterval(interval));
}
