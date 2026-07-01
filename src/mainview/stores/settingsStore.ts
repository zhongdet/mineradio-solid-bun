import { createStore } from "solid-js/store";
import {
  DIY_MODE_STORE_KEY,
  PLAYLIST_PANEL_PIN_STORE_KEY,
  USER_CAPSULE_AUTO_HIDE_STORE_KEY,
  FX_FAB_AUTO_HIDE_STORE_KEY,
  CONTROLS_AUTO_HIDE_STORE_KEY,
  PLAYBACK_QUALITY_STORE_KEY,
} from "../utils/constants";
import { getBooleanPreference, setBooleanPreference, getSavedVolume } from "../utils/localStorage";

export interface HotkeyAction {
  key: string;
  label: string;
  category: string;
  local: string;
  global: string;
}

export interface HotkeySettings {
  actions: HotkeyAction[];
  hotkeyGlobalStatus: Record<string, string>;
}

export interface FreeCameraState {
  active: boolean;
  locked: boolean;
  position: { x: number; y: number; z: number };
  yaw: number;
  pitch: number;
  roll: number;
  fov: number;
}

export interface SettingsStore {
  diyPlayerMode: boolean;
  playlistPanelPinned: boolean;
  userCapsuleAutoHide: boolean;
  fxFabAutoHide: boolean;
  fxFabAutoHideRevealArmed: boolean;
  controlsAutoHide: boolean;
  controlsHovering: boolean;
  immersiveMode: boolean;
  hotkeySettings: HotkeySettings;
  freeCamera: FreeCameraState;
  playbackQuality: string;
  cursorVisible: boolean;
  cursorHideTimer: number | null;
}

const hotkeyActions: HotkeyAction[] = [
  { key: 'togglePlay', label: '播放 / 暂停', category: '播放', local: 'Space', global: 'Ctrl+Alt+Space' },
  { key: 'prevTrack', label: '上一首', category: '播放', local: 'ArrowLeft', global: 'Ctrl+Alt+ArrowLeft' },
  { key: 'nextTrack', label: '下一首', category: '播放', local: 'ArrowRight', global: 'Ctrl+Alt+ArrowRight' },
  { key: 'volumeUp', label: '音量增加', category: '音量', local: 'ArrowUp', global: 'Ctrl+Alt+ArrowUp' },
  { key: 'volumeDown', label: '音量降低', category: '音量', local: 'ArrowDown', global: 'Ctrl+Alt+ArrowDown' },
  { key: 'toggleFullscreen', label: '全屏', category: '窗口', local: 'KeyF', global: 'Ctrl+Alt+KeyF' },
  { key: 'toggleDesktopLyrics', label: '桌面歌词', category: '歌词', local: 'Alt+KeyL', global: 'Ctrl+Alt+KeyL' },
];

const defaultSettings: SettingsStore = {
  diyPlayerMode: getBooleanPreference(DIY_MODE_STORE_KEY, false),
  playlistPanelPinned: getBooleanPreference(PLAYLIST_PANEL_PIN_STORE_KEY, false),
  userCapsuleAutoHide: getBooleanPreference(USER_CAPSULE_AUTO_HIDE_STORE_KEY, false),
  fxFabAutoHide: getBooleanPreference(FX_FAB_AUTO_HIDE_STORE_KEY, false),
  fxFabAutoHideRevealArmed: true,
  controlsAutoHide: getBooleanPreference(CONTROLS_AUTO_HIDE_STORE_KEY, false),
  controlsHovering: false,
  immersiveMode: false,
  hotkeySettings: {
    actions: hotkeyActions,
    hotkeyGlobalStatus: {},
  },
  freeCamera: {
    active: false,
    locked: false,
    position: { x: 0, y: 0, z: 6.6 },
    yaw: 0,
    pitch: 0,
    roll: 0,
    fov: 45,
  },
  playbackQuality: 'standard',
  cursorVisible: true,
  cursorHideTimer: null,
};

const [settings, setSettings] = createStore<SettingsStore>(defaultSettings);

export function useSettings() {
  return {
    state: settings,
    toggleDiyMode: () => {
      const next = !settings.diyPlayerMode;
      setSettings("diyPlayerMode", next);
      setBooleanPreference(DIY_MODE_STORE_KEY, next);
      document.body.classList.toggle("diy-mode", next);
      document.body.classList.toggle("simple-mode", !next);
      if (!next) {
        // Close panels and controls in simple mode
        setSettings("immersiveMode", false);
      }
    },
    togglePlaylistPanelPinned: () => {
      setSettings("playlistPanelPinned", !settings.playlistPanelPinned);
      setBooleanPreference(PLAYLIST_PANEL_PIN_STORE_KEY, !settings.playlistPanelPinned);
    },
    toggleUserCapsuleAutoHide: () => {
      const next = !settings.userCapsuleAutoHide;
      setSettings("userCapsuleAutoHide", next);
      setBooleanPreference(USER_CAPSULE_AUTO_HIDE_STORE_KEY, next);
      document.body.classList.toggle("user-capsule-auto-hide", next);
    },
    toggleFxFabAutoHide: () => {
      const next = !settings.fxFabAutoHide;
      setSettings("fxFabAutoHide", next);
      setSettings("fxFabAutoHideRevealArmed", next);
      setBooleanPreference(FX_FAB_AUTO_HIDE_STORE_KEY, next);
      document.body.classList.toggle("fx-fab-auto-hide", next);
      if (!next) document.body.classList.remove("fx-fab-peek");
    },
    toggleControlsAutoHide: () => {
      const next = !settings.controlsAutoHide;
      setSettings("controlsAutoHide", next);
      setBooleanPreference(CONTROLS_AUTO_HIDE_STORE_KEY, next);
      document.body.classList.toggle("controls-auto-hide", next);
    },
    setControlsHovering: (hovering: boolean) => {
      setSettings("controlsHovering", hovering);
    },
    toggleImmersiveMode: () => {
      setSettings("immersiveMode", !settings.immersiveMode);
      document.body.classList.toggle("immersive-mode", !settings.immersiveMode);
    },
    setPlaybackQuality: (quality: string) => {
      setSettings("playbackQuality", quality);
      try {
        localStorage.setItem(PLAYBACK_QUALITY_STORE_KEY, quality);
      } catch { /* ignore */ }
    },
    readPlaybackQuality: (): string => {
      try {
        const raw = localStorage.getItem(PLAYBACK_QUALITY_STORE_KEY);
        return raw || "standard";
      } catch { return "standard"; }
    },
    readSavedVolume: (): number => getSavedVolume(),
  };
}

export type SettingsStoreType = typeof settings;
