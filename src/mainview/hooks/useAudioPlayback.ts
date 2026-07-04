import { useAudio } from "../stores/audioStore";
import { usePlayback } from "../stores/playbackStore";
import { useVisual } from "../stores/visualStore";
import { useLyrics } from "../stores/lyricsStore";
import { rpc, qqApi, proxyImageUrl } from "../lib/api";
import { forcePlaybackControlsInteractive } from "../lib/uiControls";
import { updateEmptyHomeVisibility, switchPlaybackVisualPreset } from "../lib/homeVisibility";
import { createEffect, onCleanup } from "solid-js";

interface PlayQueueAtOpts {
  context?: string;
  qualityOverride?: string;
  resumeAt?: number;
  manual?: boolean;
  preserveHomeState?: boolean;
  autoRepeat?: boolean;
}

export function useAudioPlayback() {
  const audio = useAudio();
  const playback = usePlayback();
  const visual = useVisual();
  const lyrics = useLyrics();

  let playQueueAtAbort: ReturnType<typeof setTimeout> | null = null;

  // Listen for mineradio-hotkey events dispatched from BottomBar, SearchArea, etc.
  createEffect(() => {
    function onHotkey(e: Event) {
      const detail = (e as CustomEvent).detail;
      if (detail === "togglePlay") togglePlay();
      else if (detail === "nextTrack") nextTrack();
      else if (detail === "prevTrack") prevTrack();
      else if (detail === "volumeUp") {
        const v = Math.min(1, audio.state.targetVolume + 0.05);
        audio.setVolume(v);
      } else if (detail === "volumeDown") {
        const v = Math.max(0, audio.state.targetVolume - 0.05);
        audio.setVolume(v);
      } else if (detail === "goHome") {
        window.dispatchEvent(new CustomEvent("mineradio-go-home"));
      } else if (detail === "exitOrClose") {
        window.dispatchEvent(new CustomEvent("mineradio-exit-or-close"));
      } else if (detail === "toggleLyricsPanel") {
        window.dispatchEvent(new CustomEvent("mineradio-toggle-lyrics-panel"));
      } else if (detail === "toggleFxPanel") {
        window.dispatchEvent(new CustomEvent("mineradio-toggle-fx-panel"));
      } else if (detail === "toggleImmersive") {
        window.dispatchEvent(new CustomEvent("mineradio-toggle-immersive"));
      } else if (detail === "toggleDesktopLyrics") {
        window.dispatchEvent(new CustomEvent("mineradio-toggle-desktop-lyrics"));
      }
    }
    window.addEventListener("mineradio-hotkey", onHotkey);
    onCleanup(() => window.removeEventListener("mineradio-hotkey", onHotkey));
  });

  // ── UI updaters (ported from legacy loadCoverFromUrl + setAlbumBackground) ──

  function updateNowPlayingUI(song: any) {
    const cover = song?.cover || '';
    if (!cover) {
      const albumBg = document.getElementById('album-bg');
      if (albumBg) { albumBg.classList.remove('visible'); albumBg.style.backgroundImage = ''; }
      const thumbCover = document.getElementById('thumb-cover') as HTMLImageElement | null;
      if (thumbCover) thumbCover.removeAttribute('src');
      const thumbWrap = document.getElementById('thumb-wrap');
      if (thumbWrap) thumbWrap.classList.remove('visible');
      return;
    }

    // Album background
    const albumBg = document.getElementById('album-bg');
    if (albumBg) {
      albumBg.style.backgroundImage = 'url(' + proxyImageUrl(cover) + ')';
      albumBg.classList.add('visible');
    }

    // Thumb wrap
    const thumbCover = document.getElementById('thumb-cover') as HTMLImageElement | null;
    if (thumbCover) thumbCover.src = proxyImageUrl(cover);
    const thumbTitle = document.getElementById('thumb-title');
    if (thumbTitle) thumbTitle.textContent = song.name || '';
    const thumbArtist = document.getElementById('thumb-artist');
    if (thumbArtist) thumbArtist.textContent = song.artist || '';
    const thumbWrap = document.getElementById('thumb-wrap');
    if (thumbWrap) thumbWrap.classList.add('visible');

    // Control cover in bottom bar
    const controlCoverImg = document.querySelector('#control-cover img') as HTMLImageElement | null;
    if (controlCoverImg) controlCoverImg.src = proxyImageUrl(cover);

    // Mini-queue list: rebuild list items from queue
    rebuildMiniQueue();

    // Store cover URL for visual engine
    visual.set("coverTextureUrl", cover);
  }

  function rebuildMiniQueue() {
    const list = document.getElementById('mini-queue-list');
    if (!list) return;
    const q = playback.state.playQueue;
    const idx = playback.state.currentIdx;
    list.innerHTML = '';
    q.forEach((s: any, i: number) => {
      const row = document.createElement('div');
      row.className = 'mini-queue-row' + (i === idx ? ' active' : '');
      row.style.cursor = 'pointer';
      row.onclick = () => playQueueAt(i);
      const cover = s.cover || '';
      row.innerHTML =
        (cover ? '<img class="mini-queue-row-cover" src="' + cover + '" onerror="this.style.opacity=\'0.2\'" loading="lazy">' : '') +
        '<div class="mini-queue-row-info">' +
          '<span class="mini-queue-row-title">' + (s.name || '') + '</span>' +
          '<span class="mini-queue-row-artist">' + (s.artist || '') + '</span>' +
        '</div>' +
        '<button class="mini-queue-row-remove" title="移除" style="opacity:0.5;cursor:pointer;background:none;border:none;color:inherit;font-size:14px;padding:2px 6px;">×</button>';
      const removeBtn = row.querySelector('.mini-queue-row-remove') as HTMLButtonElement | null;
      if (removeBtn) {
        removeBtn.onclick = (e) => {
          e.stopPropagation();
          removeFromQueue(i);
          rebuildMiniQueue();
        };
      }
      list.appendChild(row);
    });
    const count = document.getElementById('mini-queue-count');
    if (count) count.textContent = q.length + ' 首';
  }

  let trackSwitchToken = 0;

  async function playQueueAt(idx: number, opts: PlayQueueAtOpts = {}) {
    if (idx < 0 || idx >= playback.state.playQueue.length) return;
    if (playQueueAtAbort) clearTimeout(playQueueAtAbort);

    const token = ++trackSwitchToken;
    playback.set("currentIdx", idx);
    playback.set("playToggleBusy", false);

    const song = playback.state.playQueue[idx];
    if (!song) return;

    // Cancel previous track
    audio.state.audio?.pause();

    // Reset audio visual state
    visual.resetAudioVisualState();
    playback.set("currentSong", song);

    // Prepare lyric state
    lyrics.set("lines", []);
    lyrics.set("hasNativeKaraoke", false);
    lyrics.set("timingSource", "fallback");

    // Update UI: album background, thumb wrap, bottom bar, mini queue
    updateNowPlayingUI(song);

    // Hide empty home, show controls
    updateEmptyHomeVisibility();
    forcePlaybackControlsInteractive();

    // Try to get audio URL
    const quality = opts.qualityOverride || audio.state.targetVolume > 0 ? "standard" : "standard";
    let data: any;

    try {
      const isQQ = song.provider === "qq" || song.source === "qq" || song.type === "qq";
      if (isQQ) {
        const qqMid = song.mid || song.songmid || song.mediaMid;
        if (qqMid) {
          data = await qqApi.songUrl(qqMid, song.mediaMid, quality);
        } else {
          data = await rpc<any>("song_url", { id: String(song.id), quality });
        }
      } else {
        data = await rpc<any>("song_url", { id: String(song.id), quality });
      }
    } catch (err) {
      console.error("PlayQueueAt: failed to get audio URL", err);
      if (token === trackSwitchToken) nextTrack();
      return;
    }

    if (token !== trackSwitchToken) return;

    const songUrl = data?.url || data?.data?.[0]?.url;
    if (!songUrl) {
      console.warn("PlayQueueAt: no URL available");
      if (token === trackSwitchToken) nextTrack();
      return;
    }

    // Create or reuse audio element
    if (!audio.state.audio) {
      audio.createAudioElement();
    }

    const audioEl = audio.state.audio!;
    audioEl.src = `/api/audio?url=${encodeURIComponent(songUrl)}`;
    audioEl.load();

    // Bind ended event
    audioEl.onended = () => {
      if (token !== trackSwitchToken) return;
      if (playback.state.playMode === "single") {
        playQueueAt(idx, { autoRepeat: true });
      } else {
        nextTrack();
      }
    };

    // Fetch lyrics
    await fetchLyric(song, token);
    if (token !== trackSwitchToken) return;

    // Play
    await playAudio();
  }

  async function playAudio() {
    if (!audio.state.audio) return false;
    audio.initAudioContext();
    audio.setVolume(audio.state.targetVolume);
    try {
      await audio.state.audio.play();
      audio.set("audioReady", true);
      playback.set("playing", true);
      switchPlaybackVisualPreset();
      return true;
    } catch (err) {
      console.warn("Audio play blocked:", err);
      playback.set("playing", false);
      return false;
    }
  }

  async function togglePlay() {
    if (playback.state.playToggleBusy) return;
    playback.set("playToggleBusy", true);

    try {
      if (!audio.state.audio?.src && playback.state.playQueue.length > 0 && playback.state.currentIdx >= 0) {
        await playQueueAt(playback.state.currentIdx, { manual: true });
        return;
      }

      if (!audio.state.audio) return;

      if (audio.state.audio.paused) {
        await playAudio();
      } else {
        await fadeOutAndPauseAudio();
      }
    } catch (err) {
      console.warn("TogglePlay error:", err);
      playback.set("playing", false);
    } finally {
      playback.set("playToggleBusy", false);
    }
  }

  async function fadeOutAndPauseAudio() {
    if (!audio.state.audio) return;
    const fadeSerial = audio.state.audioFadeSerial + 1;
    audio.set("audioFadeSerial", fadeSerial);
    const el = audio.state.audio;
    const startVol = audio.state.volume;
    const steps = 20;
    const fadeTime = 300;
    const stepTime = fadeTime / steps;
    for (let i = 0; i < steps; i++) {
      if (fadeSerial !== audio.state.audioFadeSerial) return;
      const t = (i + 1) / steps;
      el.volume = startVol * (1 - t);
      await new Promise(r => setTimeout(r, stepTime));
    }
    el.pause();
    el.volume = 1;
    playback.set("playing", false);
    audio.set("volume", startVol);
  }

  function nextTrack() {
    if (!playback.state.playQueue.length) return;
    playback.set("playToggleBusy", false);
    let nextIdx: number;
    if (playback.state.playMode === "shuffle") {
      nextIdx = Math.floor(Math.random() * playback.state.playQueue.length);
    } else {
      nextIdx = (playback.state.currentIdx + 1) % playback.state.playQueue.length;
    }
    playQueueAt(nextIdx);
  }

  function prevTrack() {
    if (!playback.state.playQueue.length) return;
    playback.set("playToggleBusy", false);
    const prevIdx = playback.state.currentIdx <= 0
      ? playback.state.playQueue.length - 1
      : playback.state.currentIdx - 1;
    playQueueAt(prevIdx);
  }

  function cyclePlayMode() {
    const modes = ["loop" as const, "shuffle" as const, "single" as const];
    const idx = modes.indexOf(playback.state.playMode);
    const nextMode = modes[(idx + 1) % modes.length];
    playback.set("playMode", nextMode);
  }

  function shuffleQueue() {
    const arr = [...playback.state.playQueue];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    playback.set("playQueue", arr);
    playback.set("currentIdx", 0);
  }

  function clearQueue() {
    playback.clearQueue();
  }

  function removeFromQueue(idx: number) {
    playback.removeFromQueue(idx);
  }

  function getPlayModeIcon(mode: string): string {
    if (mode === "shuffle") return "🔀";
    if (mode === "single") return "🔁";
    return "🔁";
  }

  // ── Fetch Lyrics ──

  async function fetchLyric(song: any, _token: number) {
    console.log("[Playback] fetchLyric", { songId: song.id, songName: song.name || song.title });
    try {
      const data = await rpc<any>("lyric", { id: String(song.id) });
      if (!data) { console.warn("[Playback] fetchLyric: no data"); return null; }
      const lines: any[] = [];
      const raw = data.lrc?.lyric || "";
      console.log("[Playback] fetchLyric lrc length:", raw.length, "krc:", !!data.krc);
      const regex = /\[(\d+):(\d+\.\d+)\](.*)/g;
      let match;
      while ((match = regex.exec(raw)) !== null) {
        const minute = parseInt(match[1]);
        const second = parseFloat(match[2]);
        const time = minute * 60 + second;
        const text = match[3].trim();
        if (text) lines.push({ time, duration: 0, text });
      }
      for (let i = 0; i < lines.length; i++) {
        if (i < lines.length - 1) lines[i].duration = lines[i + 1].time - lines[i].time;
      }
      const hasKaraoke = !!data.krc?.lyric;
      console.log("[Playback] fetchLyric parsed", { lineCount: lines.length });
      lyrics.set("lines", lines);
      lyrics.set("hasNativeKaraoke", hasKaraoke);
      lyrics.set("timingSource", hasKaraoke ? "krc" : "lrc");
      return { lines, hasKaraoke, timingSource: hasKaraoke ? "krc" as const : "lrc" as const };
    } catch (err) {
      console.warn("Failed to fetch lyric:", err);
      return null;
    }
  }

  return {
    playQueueAt,
    togglePlay,
    nextTrack,
    prevTrack,
    cyclePlayMode,
    shuffleQueue,
    clearQueue,
    removeFromQueue,
    getPlayModeIcon,
    playAudio,
  };
}

export type AudioPlaybackHook = ReturnType<typeof useAudioPlayback>;
