// @ts-nocheck
import { createStore } from "solid-js/store";
import { USER_FX_ARCHIVE_STORE_KEY } from "../utils/constants";
import { useFx, FxStore } from "./fxStore";

interface ArchiveSlot {
  name: string;
  snapshot: Partial<FxStore> | null;
  savedAt: number;
}

interface ArchiveState {
  slots: ArchiveSlot[];
}

function clampRange(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, isNaN(v) ? min : v));
}

function normalizeHexColor(v: any, fallback = "#ffffff"): string {
  if (typeof v !== "string") return fallback;
  if (/^#[0-9a-fA-F]{6}$/.test(v)) return v;
  if (/^#[0-9a-fA-F]{3}$/.test(v)) return v;
  return fallback;
}

function archiveNumber(raw: any, key: string, def: number, min: number, max: number): number {
  return clampRange(Number(raw[key]) || def, min, max);
}

function normalizeFxArchiveSnapshot(raw: any): Partial<FxStore> | null {
  if (!raw || typeof raw !== "object") return null;
  return {
    preset: clampRange(Number(raw.preset) || 0, 0, 6),
    intensity: archiveNumber(raw, "intensity", 0.85, 0.2, 1.6),
    cinemaShake: archiveNumber(raw, "cinemaShake", 0.5, 0, 1.8),
    depth: archiveNumber(raw, "depth", 1.0, 0.2, 1.8),
    coverResolution: archiveNumber(raw, "coverResolution", 1.55, 0.75, 1.55),
    point: archiveNumber(raw, "point", 1.0, 0.5, 2.2),
    speed: archiveNumber(raw, "speed", 1.0, 0.2, 2.5),
    twist: archiveNumber(raw, "twist", 0.0, 0, 0.6),
    color: archiveNumber(raw, "color", 1.10, 0.5, 2.0),
    scatter: archiveNumber(raw, "scatter", 0.0, 0, 0.5),
    bgFade: archiveNumber(raw, "bgFade", 0.20, 0, 1.2),
    bloomStrength: archiveNumber(raw, "bloomStrength", 0.62, 0, 1.6),
    lyricGlowStrength: archiveNumber(raw, "lyricGlowStrength", 0.28, 0, 0.85),
    lyricScale: archiveNumber(raw, "lyricScale", 1.0, 0.35, 1.65),
    lyricOffsetX: archiveNumber(raw, "lyricOffsetX", 0, -2.0, 2.0),
    lyricOffsetY: archiveNumber(raw, "lyricOffsetY", 0, -1.2, 1.35),
    lyricOffsetZ: archiveNumber(raw, "lyricOffsetZ", 0, -1.6, 1.6),
    lyricTiltX: archiveNumber(raw, "lyricTiltX", 0, -42, 42),
    lyricTiltY: archiveNumber(raw, "lyricTiltY", 0, -42, 42),
    lyricCameraLock: !!raw.lyricCameraLock,
    lyricColorMode: raw.lyricColorMode === "custom" ? "custom" : "auto",
    lyricColor: normalizeHexColor(raw.lyricColor, "#a9b8c8"),
    lyricHighlightMode: raw.lyricHighlightMode === "custom" ? "custom" : "auto",
    lyricHighlightColor: normalizeHexColor(raw.lyricHighlightColor, "#fac900"),
    lyricGlowLinked: raw.lyricGlowLinked !== false,
    lyricGlowColor: normalizeHexColor(raw.lyricGlowColor, "#008aff"),
    lyricFont: raw.lyricFont || "hei",
    lyricLetterSpacing: archiveNumber(raw, "lyricLetterSpacing", 0, -0.04, 0.18),
    lyricLineHeight: archiveNumber(raw, "lyricLineHeight", 1.0, 0.86, 1.35),
    lyricWeight: archiveNumber(raw, "lyricWeight", 900, 500, 900),
    visualTintMode: raw.visualTintMode === "custom" ? "custom" : "auto",
    visualTintColor: normalizeHexColor(raw.visualTintColor, "#9db8cf"),
    uiAccentColor: normalizeHexColor(raw.uiAccentColor, "#ffffff"),
    homeAccentColor: normalizeHexColor(raw.homeAccentColor, "#ffffff"),
    homeIconColor: normalizeHexColor(raw.homeIconColor, "#f4d28a"),
    visualIconColor: normalizeHexColor(raw.visualIconColor, "#7fd8ff"),
    backgroundColorMode: raw.backgroundColorMode === "custom" || raw.backgroundColorCustom ? "custom" : "cover",
    backgroundColor: normalizeHexColor(raw.backgroundColor, "#000000"),
    backgroundOpacity: archiveNumber(raw, "backgroundOpacity", 1, 0, 1),
    controlGlassChromaticOffset: archiveNumber(raw, "controlGlassChromaticOffset", 90, 0, 140),
    backgroundColorCustom: !!raw.backgroundColorCustom,
    floatLayer: !!raw.floatLayer,
    cinema: raw.cinema !== false,
    edge: !!raw.edge,
    aiDepth: !!raw.aiDepth,
    bloom: !!raw.bloom,
    lyricGlow: raw.lyricGlow !== false,
    lyricGlowBeat: raw.lyricGlowBeat !== false,
    lyricGlowParticles: !!raw.lyricGlowParticles,
    desktopLyrics: !!raw.desktopLyrics,
    desktopLyricsSize: archiveNumber(raw, "desktopLyricsSize", 1.0, 0.72, 1.55),
    desktopLyricsOpacity: archiveNumber(raw, "desktopLyricsOpacity", 0.92, 0.28, 1),
    desktopLyricsY: archiveNumber(raw, "desktopLyricsY", 0.76, 0.08, 0.92),
    desktopLyricsClickThrough: raw.desktopLyricsClickThrough === true,
    desktopLyricsCinema: raw.desktopLyricsCinema !== false,
    desktopLyricsHighlight: raw.desktopLyricsHighlight === true,
    desktopLyricsFps: archiveNumber(raw, "desktopLyricsFps", 60, 0, 120),
    performanceQuality: ["eco", "balanced", "high", "ultra"].includes(raw.performanceQuality) ? raw.performanceQuality : "high",
    particleLyrics: raw.particleLyrics !== false,
    backCover: !!raw.backCover,
    shelf: ["off", "side", "stage"].includes(raw.shelf) ? raw.shelf : "side",
    shelfCameraMode: ["static", "follow", "auto"].includes(raw.shelfCameraMode) ? raw.shelfCameraMode : "static",
    shelfPresence: ["always", "hover", "off"].includes(raw.shelfPresence) ? raw.shelfPresence : "always",
    shelfShowPodcasts: raw.shelfShowPodcasts !== false,
    shelfMergeCollections: !!raw.shelfMergeCollections,
    shelfSize: archiveNumber(raw, "shelfSize", 1, 0.65, 1.45),
    shelfOffsetX: archiveNumber(raw, "shelfOffsetX", 0, -1.2, 1.2),
    shelfOffsetY: archiveNumber(raw, "shelfOffsetY", 0, -0.9, 0.9),
    shelfOffsetZ: archiveNumber(raw, "shelfOffsetZ", 0, -0.9, 0.9),
    shelfAngleY: archiveNumber(raw, "shelfAngleY", -15, -30, 30),
    shelfAngleYManual: !!raw.shelfAngleYManual,
    shelfOpacity: archiveNumber(raw, "shelfOpacity", 1, 0.25, 1),
    shelfBgOpacity: archiveNumber(raw, "shelfBgOpacity", 0.90, 0.25, 0.98),
    shelfAccentColor: normalizeHexColor(raw.shelfAccentColor, "#ffffff"),
    cam: ["off", "on"].includes(raw.cam) ? raw.cam : "off",
  };
}

function readArchives(): ArchiveSlot[] {
  try {
    const raw = JSON.parse(localStorage.getItem(USER_FX_ARCHIVE_STORE_KEY) || "[]");
    if (!Array.isArray(raw)) return [];
    return raw.map((s: any) => ({
      name: String(s.name || "未命名"),
      snapshot: s.snapshot ? normalizeFxArchiveSnapshot(s.snapshot) : null,
      savedAt: Number(s.savedAt) || 0,
    }));
  } catch {
    return [];
  }
}

function writeArchives(slots: ArchiveSlot[]) {
  try {
    localStorage.setItem(USER_FX_ARCHIVE_STORE_KEY, JSON.stringify(slots));
  } catch { /* ignore */ }
}

function captureFxSnapshot(fxState: any): Partial<FxStore> {
  return normalizeFxArchiveSnapshot({ ...fxState }) || {};
}

function applyFxSnapshot(snapshot: Partial<FxStore>, fx: any) {
  if (!snapshot) return;
  const { preset, ...rest } = snapshot;
  Object.keys(rest).forEach((key) => {
    if (rest[key] !== undefined) fx.set(key as any, rest[key]);
  });
  if (preset !== undefined) fx.setPreset(preset);
}

const initialSlots = readArchives();
const [archiveState, setArchiveState] = createStore<ArchiveState>({ slots: initialSlots });

export function useArchive() {
  return {
    state: archiveState,
    save: (index: number, fxState: any) => {
      const snapshot = captureFxSnapshot(fxState);
      const existing = archiveState.slots[index];
      const slot: ArchiveSlot = {
        name: existing?.name || `存档 ${index + 1}`,
        snapshot,
        savedAt: Date.now(),
      };
      const next = [...archiveState.slots];
      next[index] = slot;
      setArchiveState("slots", next);
      writeArchives(next);
    },
    load: (index: number, fx: any) => {
      const slot = archiveState.slots[index];
      if (slot?.snapshot) applyFxSnapshot(slot.snapshot, fx);
    },
    rename: (index: number, name: string) => {
      const next = [...archiveState.slots];
      if (next[index]) {
        next[index] = { ...next[index], name };
        setArchiveState("slots", next);
        writeArchives(next);
      }
    },
    remove: (index: number) => {
      const next = archiveState.slots.filter((_, i) => i !== index);
      setArchiveState("slots", next);
      writeArchives(next);
    },
    addBlank: () => {
      const next = [...archiveState.slots, { name: `存档 ${archiveState.slots.length + 1}`, snapshot: null, savedAt: 0 }];
      setArchiveState("slots", next);
      writeArchives(next);
    },
    exportJson: (index: number) => {
      const slot = archiveState.slots[index];
      if (!slot) return;
      const blob = new Blob([JSON.stringify(slot, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${slot.name}.json`;
      a.click();
      URL.revokeObjectURL(url);
    },
    importJson: (jsonStr: string) => {
      try {
        const data = JSON.parse(jsonStr);
        const snapshot = normalizeFxArchiveSnapshot(data.snapshot || data);
        if (!snapshot) return false;
        const slot: ArchiveSlot = {
          name: data.name || "导入存档",
          snapshot,
          savedAt: data.savedAt || Date.now(),
        };
        const next = [...archiveState.slots, slot];
        setArchiveState("slots", next);
        writeArchives(next);
        return true;
      } catch {
        return false;
      }
    },
  };
}
