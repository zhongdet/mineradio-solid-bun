// @ts-nocheck
import { Component, For, createSignal, onMount, onCleanup } from "solid-js";
import { useFx } from "../../stores/fxStore";

const HOTKEY_STORE_KEY = "mineradio-hotkey-settings-v1";

const DEFAULT_BINDINGS: Record<string, string> = {
  togglePlay: "Space",
  prevTrack: "ArrowLeft",
  nextTrack: "ArrowRight",
  volumeUp: "ArrowUp",
  volumeDown: "ArrowDown",
  goHome: "Home",
  toggleFullscreen: "KeyF",
  exitOrClose: "Escape",
  toggleLyricsPanel: "KeyL",
  toggleFxPanel: "KeyP",
  toggleImmersive: "KeyI",
  toggleDesktopLyrics: "Alt+KeyL",
};

const CATEGORIES = [
  { label: "播放", keys: ["togglePlay", "prevTrack", "nextTrack"] },
  { label: "音量", keys: ["volumeUp", "volumeDown"] },
  { label: "导航", keys: ["goHome"] },
  { label: "窗口", keys: ["toggleFullscreen", "exitOrClose", "toggleImmersive"] },
  { label: "歌词", keys: ["toggleLyricsPanel", "toggleDesktopLyrics"] },
  { label: "视觉", keys: ["toggleFxPanel"] },
];

const ACTION_LABELS: Record<string, string> = {
  togglePlay: "播放 / 暂停",
  prevTrack: "上一首",
  nextTrack: "下一首",
  volumeUp: "音量增加",
  volumeDown: "音量降低",
  goHome: "回到 Home",
  toggleFullscreen: "全屏",
  exitOrClose: "退出/关闭",
  toggleLyricsPanel: "歌词面板",
  toggleFxPanel: "效果面板",
  toggleImmersive: "沉浸模式",
  toggleDesktopLyrics: "桌面歌词",
};

function loadBindings(): Record<string, string> {
  try {
    const raw = JSON.parse(localStorage.getItem(HOTKEY_STORE_KEY) || "{}");
    return { ...DEFAULT_BINDINGS, ...raw };
  } catch {
    return { ...DEFAULT_BINDINGS };
  }
}

function saveBindings(bindings: Record<string, string>) {
  try {
    localStorage.setItem(HOTKEY_STORE_KEY, JSON.stringify(bindings));
  } catch { /* ignore */ }
}

function formatKey(key: string): string {
  return key
    .replace("Control", "Ctrl")
    .replace("Meta", "Cmd")
    .replace("ArrowUp", "↑")
    .replace("ArrowDown", "↓")
    .replace("ArrowLeft", "←")
    .replace("ArrowRight", "→")
    .replace("Escape", "Esc")
    .replace("Key", "")
    .replace("Alt+", "Alt+")
    .replace("Shift+", "Shift+")
    .replace("Control+", "Ctrl+");
}

interface HotkeyModalProps {
  onClose: () => void;
}

const HotkeyModal: Component<HotkeyModalProps> = (props) => {
  const [bindings, setBindings] = createSignal(loadBindings());
  const [capturing, setCapturing] = createSignal<string | null>(null);

  const handleCapture = (actionKey: string) => {
    setCapturing(actionKey);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    const cap = capturing();
    if (!cap) return;
    e.preventDefault();
    e.stopPropagation();

    if (e.key === "Escape") {
      setCapturing(null);
      return;
    }

    let combo = "";
    if (e.ctrlKey || e.metaKey) combo += "Ctrl+";
    if (e.altKey) combo += "Alt+";
    if (e.shiftKey) combo += "Shift+";
    combo += e.key;

    const next = { ...bindings(), [cap]: combo };
    setBindings(next);
    saveBindings(next);
    setCapturing(null);
  };

  const resetAll = () => {
    setBindings({ ...DEFAULT_BINDINGS });
    saveBindings({ ...DEFAULT_BINDINGS });
  };

  const resetOne = (actionKey: string) => {
    const next = { ...bindings(), [actionKey]: DEFAULT_BINDINGS[actionKey] };
    setBindings(next);
    saveBindings(next);
  };

  onMount(() => {
    document.addEventListener("keydown", handleKeyDown, true);
  });

  onCleanup(() => {
    document.removeEventListener("keydown", handleKeyDown, true);
  });

  return (
    <div class="modal-overlay" onClick={props.onClose}>
      <div class="modal-content hotkey-modal" onClick={(e) => e.stopPropagation()}>
        <div class="modal-head">
          <div class="modal-title">快捷键设置</div>
          <button class="modal-close" onClick={props.onClose}>×</button>
        </div>
        <div class="hotkey-body">
          <For each={CATEGORIES}>
            {(cat) => (
              <div class="hotkey-category">
                <div class="hotkey-cat-label">{cat.label}</div>
                <For each={cat.keys}>
                  {(actionKey) => (
                    <div class="hotkey-row">
                      <span class="hotkey-action-label">{ACTION_LABELS[actionKey]}</span>
                      <div class="hotkey-binding">
                        <button
                          classList={{ "hotkey-capture-btn": true, capturing: capturing() === actionKey }}
                          onClick={() => handleCapture(actionKey)}
                        >
                          {capturing() === actionKey
                            ? "按下快捷键..."
                            : formatKey(bindings()[actionKey] || DEFAULT_BINDINGS[actionKey])}
                        </button>
                        <button
                          class="hotkey-reset-btn"
                          onClick={() => resetOne(actionKey)}
                          title="恢复默认"
                        >
                          ↺
                        </button>
                      </div>
                    </div>
                  )}
                </For>
              </div>
            )}
          </For>
        </div>
        <div class="modal-actions">
          <button class="fx-mini-btn" onClick={resetAll}>恢复全部默认</button>
          <button class="fx-mini-btn" onClick={props.onClose}>完成</button>
        </div>
      </div>
    </div>
  );
};

export default HotkeyModal;
export { loadBindings, HOTKEY_STORE_KEY, DEFAULT_BINDINGS };
