import { useLyrics } from "../stores/lyricsStore";
import { useVisual } from "../stores/visualStore";
import { useAudio } from "../stores/audioStore";
import { rpc } from "../lib/api";

export function useLyricsHook() {
  const lyrics = useLyrics();
  const visual = useVisual();
  const audio = useAudio();

  async function fetchLyric(song: any, _token: number) {
    try {
      const data = await rpc<any>("lyric", { id: String(song.id) });
      if (!data) return;

      // Parse LRC format: [mm:ss.xx]text
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

      lyrics.setOriginalLyricsState(lines, hasKaraoke, hasKaraoke ? "krc" : "lrc");
      return { lines, hasKaraoke, timingSource: hasKaraoke ? "krc" : "lrc" };
    } catch (err) {
      console.warn("Failed to fetch lyric:", err);
      return null;
    }
  }

  function setOriginalLyricsState(lines: any[], hasKaraoke: boolean, timingSource: string) {
    lyrics.set({
      lines,
      hasNativeKaraoke: hasKaraoke,
      timingSource: timingSource as any,
      sourceMode: "original",
    });
  }

  function applyCustomLyricState(song: any, _silent?: boolean) {
    const key = String(song.id || song.mid || song.songmid || "");
    const custom = lyrics.state.customLyricMap?.[key];
    if (custom) {
      const parsed = parseCustomLyricText(custom);
      lyrics.set({
        lines: parsed,
        sourceMode: "custom",
        timingSource: "custom",
      });
    }
  }

  function saveCustomLyricForCurrent(song: any, text: string) {
    const key = String(song.id || song.mid || song.songmid || "");
    const newMap = { ...(lyrics.state.customLyricMap || {}), [key]: text };
    lyrics.set("customLyricMap", newMap);
    try {
      localStorage.setItem("mineradio-custom-lyrics-v1", JSON.stringify(newMap));
    } catch { /* ignore */ }
    const parsed = parseCustomLyricText(text);
    lyrics.set({ lines: parsed, sourceMode: "custom", timingSource: "custom" });
  }

  function deleteCustomLyricForCurrent(song: any) {
    const key = String(song.id || song.mid || song.songmid || "");
    const newMap = { ...(lyrics.state.customLyricMap || {}) };
    delete newMap[key];
    lyrics.set("customLyricMap", newMap);
    try {
      localStorage.setItem("mineradio-custom-lyrics-v1", JSON.stringify(newMap));
    } catch { /* ignore */ }
  }

  function parseCustomLyricText(text: string): any[] {
    const lines: any[] = [];
    const rawLines = text.split("\n");
    for (const raw of rawLines) {
      const match = raw.match(/\[(\d+):(\d+\.\d+)\](.*)/);
      if (match) {
        const minute = parseInt(match[1]);
        const second = parseFloat(match[2]);
        const time = minute * 60 + second;
        const text = match[3].trim();
        if (text) {
          lines.push({ time, duration: 0, text });
        }
      }
    }
    for (let i = 0; i < lines.length; i++) {
      if (i < lines.length - 1) {
        lines[i].duration = lines[i + 1].time - lines[i].time;
      }
    }
    return lines;
  }

  function updateCurrentLyricIndex() {
    if (!audio.state.audio) return -1;
    const currentTime = audio.state.audio.currentTime;
    const lines = lyrics.state.lines;
    let idx = -1;
    for (let i = 0; i < lines.length; i++) {
      if (currentTime >= lines[i].time) {
        idx = i;
      } else {
        break;
      }
    }
    lyrics.setCurrentLyricIdx(idx);
    return idx;
  }

  function tickLyricsParticles(_dt: number) {
    // Update lyric sun energy
    const ls = visual.state;
    ls.lyricSunTarget = Math.min(1, ls.audioEnergy * 3 + ls.bass * 2);
    ls.lyricSunEnergy = ls.lyricSunEnergy * 0.9 + ls.lyricSunTarget * 0.1;
    ls.lyricSunAvg = ls.lyricSunAvg * 0.99 + ls.lyricSunEnergy * 0.01;
  }

  function updateStageLyrics3D(_dt: number) {
    // Update current lyric index for display
    updateCurrentLyricIndex();
    // 3D positioning would be handled by the visual engine hook
  }

  return {
    fetchLyric,
    setOriginalLyricsState,
    applyCustomLyricState,
    saveCustomLyricForCurrent,
    deleteCustomLyricForCurrent,
    parseCustomLyricText,
    updateCurrentLyricIndex,
    tickLyricsParticles,
    updateStageLyrics3D,
  };
}

export type LyricsHook = ReturnType<typeof useLyricsHook>;
