import { createEffect } from "solid-js";
import { loadBindings, HOTKEY_STORE_KEY } from "../components/panels/HotkeyModal";

const HOTKEY_ACTIONS = [
  { key: 'togglePlay', label: '播放 / 暂停', category: '播放', local: 'Space', global: 'Ctrl+Alt+Space' },
  { key: 'prevTrack', label: '上一首', category: '播放', local: 'ArrowLeft', global: 'Ctrl+Alt+ArrowLeft' },
  { key: 'nextTrack', label: '下一首', category: '播放', local: 'ArrowRight', global: 'Ctrl+Alt+ArrowRight' },
  { key: 'volumeUp', label: '音量增加', category: '音量', local: 'ArrowUp', global: 'Ctrl+Alt+ArrowUp' },
  { key: 'volumeDown', label: '音量降低', category: '音量', local: 'ArrowDown', global: 'Ctrl+Alt+ArrowDown' },
  { key: 'goHome', label: '回到 Home', category: '导航', local: 'Home', global: '' },
  { key: 'toggleFullscreen', label: '全屏', category: '窗口', local: 'KeyF', global: 'Ctrl+Alt+KeyF' },
  { key: 'exitOrClose', label: '退出/关闭', category: '窗口', local: 'Escape', global: '' },
  { key: 'toggleLyricsPanel', label: '歌词面板', category: '歌词', local: 'KeyL', global: '' },
  { key: 'toggleFxPanel', label: '效果面板', category: '视觉', local: 'KeyP', global: '' },
  { key: 'toggleImmersive', label: '沉浸模式', category: '窗口', local: 'KeyI', global: '' },
  { key: 'toggleDesktopLyrics', label: '桌面歌词', category: '歌词', local: 'Alt+KeyL', global: 'Ctrl+Alt+KeyL' },
];

function getLocalBinding(actionKey: string): string {
  const bindings = loadBindings();
  return bindings[actionKey] || HOTKEY_ACTIONS.find(a => a.key === actionKey)?.local || '';
}

export function useHotkeys() {
  let captureState: string | null = null;

  function parseHotkey(hotkeyStr: string): { ctrl?: boolean; alt?: boolean; shift?: boolean; key: string } {
    const parts = hotkeyStr.split("+").map(p => p.trim().toLowerCase());
    const result: any = { key: parts[parts.length - 1] };
    for (const p of parts.slice(0, -1)) {
      if (p === "ctrl") result.ctrl = true;
      if (p === "alt") result.alt = true;
      if (p === "shift") result.shift = true;
    }
    return result;
  }

  function isHotkeyMatch(event: KeyboardEvent, hotkey: string): boolean {
    const parsed = parseHotkey(hotkey);
    return (
      parsed.ctrl === !!event.ctrlKey &&
      parsed.alt === !!event.altKey &&
      parsed.shift === !!event.shiftKey &&
      event.key.toLowerCase() === parsed.key.toLowerCase()
    );
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (captureState) return;

    const target = event.target as HTMLElement;
    const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

    for (const action of HOTKEY_ACTIONS) {
      const localBinding = getLocalBinding(action.key);
      if (isHotkeyMatch(event, localBinding)) {
        const rawKey = localBinding.split('+').pop() || '';
        if (isInput && !['Space', 'Escape'].includes(rawKey)) continue;
        event.preventDefault();
        dispatchHotkey(action.key);
        return;
      }
      if ((event.ctrlKey || event.metaKey) && action.global && isHotkeyMatch(event, action.global)) {
        event.preventDefault();
        dispatchHotkey(action.key);
        return;
      }
    }
  }

  function dispatchHotkey(actionKey: string) {
    switch (actionKey) {
      case "togglePlay":
      case "prevTrack":
      case "nextTrack":
      case "volumeUp":
      case "volumeDown":
      case "toggleDesktopLyrics":
        window.dispatchEvent(new CustomEvent("mineradio-hotkey", { detail: actionKey }));
        break;
      case "toggleFullscreen":
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(() => {});
        } else {
          document.exitFullscreen().catch(() => {});
        }
        break;
      case "goHome":
        window.dispatchEvent(new CustomEvent("mineradio-hotkey", { detail: actionKey }));
        break;
      case "exitOrClose":
        if (document.fullscreenElement) {
          document.exitFullscreen().catch(() => {});
        } else {
          window.dispatchEvent(new CustomEvent("mineradio-hotkey", { detail: actionKey }));
        }
        break;
      case "toggleLyricsPanel":
      case "toggleFxPanel":
      case "toggleImmersive":
        window.dispatchEvent(new CustomEvent("mineradio-hotkey", { detail: actionKey }));
        break;
    }
  }

  function setupHotkeyCapture(element: HTMLElement | null) {
    if (!element) return;
    captureState = "active";
    element.addEventListener("keydown", (e) => {
      e.stopPropagation();
    });
  }

  function releaseHotkeyCapture() {
    captureState = null;
  }

  // Global keyboard listener
  createEffect(() => {
    const handler = handleKeyDown;
    document.addEventListener("keydown", handler);
    return () => {
      document.removeEventListener("keydown", handler);
    };
  });

  return {
    handleKeyDown,
    dispatchHotkey,
    setupHotkeyCapture,
    releaseHotkeyCapture,
    hotkeyActions: HOTKEY_ACTIONS,
  };
}

export type HotkeysHook = ReturnType<typeof useHotkeys>;
