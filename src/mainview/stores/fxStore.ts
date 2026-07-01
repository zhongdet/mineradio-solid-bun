import { createStore } from "solid-js/store";
import { LYRIC_LAYOUT_STORE_KEY, VISUAL_PRESET_SCHEMA } from "../utils/constants";

// FX defaults from app.js
const fxDefaults = {
  preset: 0,
  intensity: 0.85,
  cinemaShake: 0.5,
  depth: 1.0,
  coverResolution: 1.55,
  point: 1.0,
  speed: 1.0,
  twist: 0.0,
  color: 1.10,
  scatter: 0.0,
  bgFade: 0.20,
  bloomStrength: 0.62,
  lyricGlowStrength: 0.28,
  lyricScale: 1.0,
  lyricOffsetX: 0,
  lyricOffsetY: 0,
  lyricOffsetZ: 0,
  lyricTiltX: 0,
  lyricTiltY: 0,
  lyricColorMode: 'auto',
  lyricColor: '#a9b8c8',
  lyricHighlightMode: 'auto',
  lyricHighlightColor: '#fac900',
  lyricGlowLinked: true,
  lyricGlowColor: '#008aff',
  lyricFont: 'hei',
  lyricLetterSpacing: 0,
  lyricLineHeight: 1.0,
  lyricWeight: 900,
  visualTintMode: 'auto',
  visualTintColor: '#9db8cf',
  uiAccentColor: '#ffffff',
  homeAccentColor: '#ffffff',
  homeIconColor: '#ffffff',
  visualIconColor: '#ffffff',
  backgroundColorMode: 'cover',
  backgroundColor: '#000000',
  backgroundOpacity: 1,
  controlGlassChromaticOffset: 90,
  backgroundColorCustom: false,
  backgroundImage: '',
  backgroundMedia: null,
  desktopLyrics: false,
  desktopLyricsSize: 1.0,
  desktopLyricsOpacity: 0.92,
  desktopLyricsY: 0.76,
  desktopLyricsClickThrough: false,
  desktopLyricsCinema: true,
  desktopLyricsHighlight: false,
  desktopLyricsFps: 60,
  wallpaperMode: false,
  wallpaperOpacity: 1,
  floatLayer: false,
  cinema: true,
  edge: false,
  aiDepth: false,
  bloom: false,
  lyricGlow: true,
  lyricGlowBeat: true,
  lyricGlowParticles: false,
  lyricCameraLock: false,
  particleLyrics: true,
  backCover: false,
  shelf: 'side' as 'side' | 'stage' | 'off',
  shelfCameraMode: 'static' as 'static' | 'follow' | 'auto',
  shelfPresence: 'always' as 'always' | 'hover' | 'off',
  shelfShowPodcasts: false,
  shelfMergeCollections: false,
  shelfSize: 1,
  shelfOffsetX: 0,
  shelfOffsetY: 0,
  shelfOffsetZ: 0,
  shelfAngleY: -15,
  shelfAngleYManual: false,
  shelfOpacity: 1,
  shelfBgOpacity: 0.90,
  shelfAccentColor: '#ffffff',
  performanceBackground: 'auto' as 'auto' | 'release' | 'keep',
  performanceQuality: 'high' as 'eco' | 'balanced' | 'high' | 'ultra',
  liveBackgroundKeep: false,
  cam: 'off' as 'off' | 'on',
};

interface PresetTransition {
  active: boolean;
  start: number;
  duration: number;
  from: number;
  to: number;
}

export interface FxStore {
  preset: number;
  intensity: number;
  cinemaShake: number;
  depth: number;
  coverResolution: number;
  point: number;
  speed: number;
  twist: number;
  color: number;
  scatter: number;
  bgFade: number;
  bloomStrength: number;
  lyricGlowStrength: number;
  lyricScale: number;
  lyricOffsetX: number;
  lyricOffsetY: number;
  lyricOffsetZ: number;
  lyricTiltX: number;
  lyricTiltY: number;
  lyricColorMode: string;
  lyricColor: string;
  lyricHighlightMode: string;
  lyricHighlightColor: string;
  lyricGlowLinked: boolean;
  lyricGlowColor: string;
  lyricFont: string;
  lyricLetterSpacing: number;
  lyricLineHeight: number;
  lyricWeight: number;
  visualTintMode: string;
  visualTintColor: string;
  uiAccentColor: string;
  homeAccentColor: string;
  homeIconColor: string;
  visualIconColor: string;
  backgroundColorMode: string;
  backgroundColor: string;
  backgroundOpacity: number;
  controlGlassChromaticOffset: number;
  backgroundColorCustom: boolean;
  backgroundImage: string;
  backgroundMedia: any;
  desktopLyrics: boolean;
  desktopLyricsSize: number;
  desktopLyricsOpacity: number;
  desktopLyricsY: number;
  desktopLyricsClickThrough: boolean;
  desktopLyricsCinema: boolean;
  desktopLyricsHighlight: boolean;
  desktopLyricsFps: number;
  wallpaperMode: boolean;
  wallpaperOpacity: number;
  floatLayer: boolean;
  cinema: boolean;
  edge: boolean;
  aiDepth: boolean;
  bloom: boolean;
  lyricGlow: boolean;
  lyricGlowBeat: boolean;
  lyricGlowParticles: boolean;
  lyricCameraLock: boolean;
  particleLyrics: boolean;
  backCover: boolean;
  shelf: string;
  shelfCameraMode: string;
  shelfPresence: string;
  shelfShowPodcasts: boolean;
  shelfMergeCollections: boolean;
  shelfSize: number;
  shelfOffsetX: number;
  shelfOffsetY: number;
  shelfOffsetZ: number;
  shelfAngleY: number;
  shelfAngleYManual: boolean;
  shelfOpacity: number;
  shelfBgOpacity: number;
  shelfAccentColor: string;
  performanceBackground: string;
  performanceQuality: string;
  liveBackgroundKeep: boolean;
  cam: string;
  presetTransition: PresetTransition;
  playbackVisualPreset: number;
  // Derived
  isSkullPreset: boolean;
}

function readSavedLyricLayout(): Partial<FxStore> {
  try {
    const raw = JSON.parse(localStorage.getItem(LYRIC_LAYOUT_STORE_KEY) || '{}') || {};
    return raw;
  } catch { return {}; }
}

function readSavedPlaybackVisualPreset(): number {
  try {
    const raw = JSON.parse(localStorage.getItem(LYRIC_LAYOUT_STORE_KEY) || '{}') || {};
    if (!Object.prototype.hasOwnProperty.call(raw, 'preset')) return fxDefaults.preset;
    const savedPreset = Math.max(0, Math.min(6, Number(raw.preset) || 0));
    if (savedPreset === 3 && (raw as any).visualPresetSchema !== VISUAL_PRESET_SCHEMA) {
      return 5;
    }
    return savedPreset;
  } catch { return fxDefaults.preset; }
}

const initialFx: FxStore = {
  ...fxDefaults,
  presetTransition: { active: false, start: -10, duration: 0.92, from: 0, to: 0 },
  playbackVisualPreset: readSavedPlaybackVisualPreset(),
  isSkullPreset: false,
} as unknown as FxStore;

Object.assign(initialFx, readSavedLyricLayout());

// Normalize: skull preset only
if (initialFx.preset === 3) {
  initialFx.preset = 5; // wallpaper
}

const [fx, setFx] = createStore<FxStore>(initialFx);

export function useFx() {
  return {
    state: fx,
    setPreset: (preset: number) => {
      const from = fx.preset;
      const to = Math.max(0, Math.min(6, preset));
      if (from === to) return;
      setFx("presetTransition", {
        active: true,
        start: performance.now(),
        duration: 0.92,
        from,
        to,
      });
      setFx("preset", to);
      setFx("playbackVisualPreset", to);
      // Save to localStorage
      try {
        const saved = JSON.parse(localStorage.getItem(LYRIC_LAYOUT_STORE_KEY) || '{}') || {};
        saved.preset = to;
        saved.visualPresetSchema = VISUAL_PRESET_SCHEMA;
        localStorage.setItem(LYRIC_LAYOUT_STORE_KEY, JSON.stringify(saved));
      } catch { /* ignore */ }
    },
    set: (key: keyof FxStore, value: any) => {
      setFx(key, value);
    },
    reset: () => {
      setFx({ ...fxDefaults, presetTransition: { active: false, start: -10, duration: 0.92, from: 0, to: 0 }, playbackVisualPreset: fxDefaults.preset });
    },
    // Derived
    isSkullPreset: () => fx.preset === 6,
    isEmilyPreset: () => fx.preset === 0,
    isWallpaperPreset: () => fx.preset === 5,
    getCinemaShakeAmount: () => fx.cinemaShake * fx.intensity,
    getIntensity: () => fx.intensity,
  };
}

export type FxStoreType = typeof fx;
