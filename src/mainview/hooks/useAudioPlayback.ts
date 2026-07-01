import { useAudio } from "../stores/audioStore";
import { usePlayback } from "../stores/playbackStore";
import { useVisual } from "../stores/visualStore";
import { useLyrics } from "../stores/lyricsStore";
import { rpc } from "../lib/api";

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

  async function playQueueAt(idx: number, opts: PlayQueueAtOpts = {}) {
    if (idx < 0 || idx >= playback.state.playQueue.length) return;
    if (playQueueAtAbort) clearTimeout(playQueueAtAbort);

    const token = ++playback.state.currentIdx; // Simple token to cancel stale calls
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

    // Try to get audio URL
    const quality = opts.qualityOverride || audio.state.targetVolume > 0 ? "standard" : "standard";
    let data: any;

    try {
      if ((song as any).mid) {
        // QQ music
        data = await rpc<any>("song_url_v1", { id: (song as any).mid, mediaMid: (song as any).mediaMid, quality });
      } else {
        data = await rpc<any>("song_url", { id: String(song.id), quality });
      }
    } catch (err) {
      console.error("PlayQueueAt: failed to get audio URL", err);
      return;
    }

    if (!data.url) {
      console.warn("PlayQueueAt: no URL available");
      return;
    }

    // Create or reuse audio element
    if (!audio.state.audio) {
      audio.createAudioElement();
    }

    const audioEl = audio.state.audio!;
    audioEl.src = `/api/audio?url=${encodeURIComponent(data.url)}`;
    audioEl.load();

    // Bind ended event
    audioEl.onended = () => {
      if (playback.state.playMode === "single") {
        playQueueAt(idx, { autoRepeat: true });
      } else {
        nextTrack();
      }
    };

    // Fetch lyrics
    fetchLyric(song, token);

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
        audio.state.audio.pause();
        playback.set("playing", false);
      }
    } finally {
      playback.set("playToggleBusy", false);
    }
  }

  function nextTrack() {
    if (!playback.state.playQueue.length) return;
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

async function fetchLyric(song: any, _token: number) {
  try {
    const data = await rpc<any>("lyric", { id: String(song.id) });
    if (!data) return;
    // Parse lrc format: [mm:ss.xx]text
    const lines: any[] = [];
    const raw = data.lrc?.lyric || "";
    const regex = /\[(\d+):(\d+\.\d+)\](.*)/g;
    let match;
    while ((match = regex.exec(raw)) !== null) {
      const minute = parseInt(match[1]);
      const second = parseFloat(match[2]);
      const time = minute * 60 + second;
      const text = match[3].trim();
      if (text) {
        lines.push({ time, duration: 0, text });
      }
    }
    // Calculate durations
    for (let i = 0; i < lines.length; i++) {
      if (i < lines.length - 1) {
        lines[i].duration = lines[i + 1].time - lines[i].time;
      }
    }
    // Check for karaoke (KRC)
    const hasKaraoke = !!data.krc?.lyric;
    return { lines, hasKaraoke, timingSource: hasKaraoke ? "krc" : "lrc" };
  } catch (err) {
    console.warn("Failed to fetch lyric:", err);
    return null;
  }
}

export type AudioPlaybackHook = ReturnType<typeof useAudioPlayback>;
