import { createStore } from "solid-js/store";
import { CUSTOM_LYRIC_STORE_KEY } from "../utils/constants";

export interface LyricLine {
  time: number;
  duration: number;
  text: string;
  end?: number;
  words?: { time: number; text: string; end?: number }[];
  hasKaraokeWord?: boolean;
}

export interface CustomLyricPrefs {
  sourceMode: string;
  [songId: string]: any;
}

export interface LyricsStore {
  lines: LyricLine[];
  visible: boolean;
  hasNativeKaraoke: boolean;
  timingSource: 'netease' | 'qq' | 'fallback' | 'custom' | 'none';
  sourceMode: 'original' | 'custom';
  lyricSunEnergy: number;
  lyricSunTarget: number;
  lyricSunHold: number;
  lyricSunAvg: number;
  lyricSunPeak: number;
  customLyricMap: Record<string, string>;
  customLyricPrefs: Record<string, any>;
  currentLyricIdx: number;
}

const [lyrics, setLyrics] = createStore<LyricsStore>({
  lines: [],
  visible: false,
  hasNativeKaraoke: false,
  timingSource: 'none',
  sourceMode: 'original',
  lyricSunEnergy: 0,
  lyricSunTarget: 0,
  lyricSunHold: 0,
  lyricSunAvg: 0,
  lyricSunPeak: 0.55,
  customLyricMap: {},
  customLyricPrefs: {},
  currentLyricIdx: -1,
});

export function useLyrics() {
  return {
    state: lyrics,
    set: (keyOrPartial: keyof LyricsStore | Partial<LyricsStore>, value?: any) => {
      if (typeof keyOrPartial === "string") {
        setLyrics(keyOrPartial, value);
      } else {
        setLyrics(keyOrPartial);
      }
    },
    setOriginalLyricsState: (lines: LyricLine[], hasKaraoke: boolean, timingSource: string) => {
      setLyrics({
        lines,
        hasNativeKaraoke: hasKaraoke,
        timingSource: timingSource as any,
        sourceMode: 'original',
      });
    },
    applyCustomLyricState: (song: any, _silent?: boolean) => {
      const key = String(song.id || song.mid || song.songmid || '');
      const custom = lyrics.customLyricMap[key];
      if (custom) {
        const parsed = parseCustomLyricText(custom);
        setLyrics({
          lines: parsed,
          sourceMode: 'custom',
          timingSource: 'custom',
        });
      }
    },
    saveCustomLyricForCurrent: (song: any, text: string) => {
      const key = String(song.id || song.mid || song.songmid || '');
      const newMap = { ...lyrics.customLyricMap, [key]: text };
      setLyrics("customLyricMap", newMap);
      try {
        localStorage.setItem(CUSTOM_LYRIC_STORE_KEY, JSON.stringify(newMap));
      } catch { /* ignore */ }
      // Re-apply
      const parsed = parseCustomLyricText(text);
      setLyrics({ lines: parsed, sourceMode: 'custom', timingSource: 'custom' });
    },
    deleteCustomLyricForCurrent: (song: any) => {
      const key = String(song.id || song.mid || song.songmid || '');
      const newMap = { ...lyrics.customLyricMap };
      delete newMap[key];
      setLyrics("customLyricMap", newMap);
      try {
        localStorage.setItem(CUSTOM_LYRIC_STORE_KEY, JSON.stringify(newMap));
      } catch { /* ignore */ }
    },
    setCurrentLyricIdx: (idx: number) => {
      setLyrics("currentLyricIdx", idx);
    },
  };
}

export function parseCustomLyricText(text: string): LyricLine[] {
  const lines: LyricLine[] = [];
  const rawLines = text.split('\n');
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
  // Calculate durations
  for (let i = 0; i < lines.length; i++) {
    if (i < lines.length - 1) {
      lines[i].duration = lines[i + 1].time - lines[i].time;
    }
  }
  return lines;
}

export type LyricsStoreType = typeof lyrics;
