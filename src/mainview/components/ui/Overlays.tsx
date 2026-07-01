// @ts-nocheck
import { Component } from "solid-js";

function closeSourceFallbackNotice() {
  document.getElementById("source-fallback-notice")?.classList.remove("show");
}

const Overlays: Component = () => (
  <>
    <div id="toast"></div>
    <div id="source-fallback-notice" aria-live="polite">
      <div class="source-fallback-head">
        <div id="source-fallback-title" class="source-fallback-title">自动换源</div>
        <button class="source-fallback-close" type="button" onClick={closeSourceFallbackNotice}>×</button>
      </div>
      <div id="source-fallback-body" class="source-fallback-body"></div>
    </div>
  </>
);

export default Overlays;
