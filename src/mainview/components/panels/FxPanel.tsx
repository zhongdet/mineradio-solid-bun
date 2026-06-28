// @ts-nocheck
import { Component } from "solid-js";

export const FxPanel: Component = () => (
  <>
    <button id="fx-fab" title="视觉控制台">
      <svg width="21" height="21" fill="none" stroke="currentColor" stroke-width="1.9" viewBox="0 0 24 24">
        <path d="M4 7h8"/><path d="M16 7h4"/><circle cx="14" cy="7" r="2"/><path d="M4 17h4"/><path d="M12 17h8"/><circle cx="10" cy="17" r="2"/></svg>
    </button>
    <button id="fx-fab-hide-btn" type="button" onclick="toggleFxFabAutoHide(event)">‹</button>
    <div id="fx-panel">
      <div class="fx-head">
        <div><div class="fx-title">视觉控制台</div><div class="fx-sub">MINERADIO VISUALS · 鼠标移开自动隐藏</div></div>
      </div>
      <div class="fx-section-label">视觉预设</div>
      <div class="preset-grid" id="preset-grid"></div>
    </div>
  </>
);
