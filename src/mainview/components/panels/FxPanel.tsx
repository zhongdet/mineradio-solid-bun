// @ts-nocheck
import { Component, For, Show } from "solid-js";
import { useFx } from "../../stores/fxStore";
import { useSettings } from "../../stores/settingsStore";

const FxPanel: Component = () => {
  const fx = useFx();
  const settings = useSettings();

  const presets = [
    { idx: 0, name: "Emily" },
    { idx: 1, name: "Aurora" },
    { idx: 2, name: "Nebula" },
    { idx: 4, name: "Ring" },
    { idx: 5, name: "Wallpaper" },
    { idx: 6, name: "Skull" },
  ];

  return (
    <>
      <button
        id="fx-fab"
        classList={{ "fx-fab-auto-hide": settings.state.fxFabAutoHide, "fx-fab-peek": false }}
        title="视觉控制台"
        onClick={() => fx.set("preset", fx.state.preset)}
      >
        <svg width="21" height="21" fill="none" stroke="currentColor" stroke-width="1.9" viewBox="0 0 24 24">
          <path d="M4 7h8"/><path d="M16 7h4"/><circle cx="14" cy="7" r="2"/><path d="M4 17h4"/><path d="M12 17h8"/><circle cx="10" cy="17" r="2"/>
        </svg>
      </button>
      <button
        id="fx-fab-hide-btn"
        type="button"
        classList={{ on: settings.state.fxFabAutoHide }}
        onClick={() => settings.toggleFxFabAutoHide()}
      >
        {settings.state.fxFabAutoHide ? "›" : "‹"}
      </button>
      <div id="fx-panel" classList={{ show: fx.state.presetTransition.active }}>
        <div class="fx-head">
          <div>
            <div class="fx-title">视觉控制台</div>
            <div class="fx-sub">MINERADIO VISUALS · 鼠标移开自动隐藏</div>
          </div>
        </div>
        <div class="fx-section-label">视觉预设</div>
        <div class="preset-grid" id="preset-grid">
          <For each={presets}>
            {(p) => (
              <button
                classList={{ "preset-btn": true, active: fx.state.preset === p.idx }}
                onClick={() => fx.setPreset(p.idx)}
                title={p.name}
              >
                {p.name}
              </button>
            )}
          </For>
        </div>
        <div class="fx-section-label">强度</div>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={fx.state.intensity}
          onInput={(e) => fx.set("intensity", parseFloat(e.currentTarget.value))}
        />
      </div>
    </>
  );
};

export default FxPanel;
