// @ts-nocheck
import { Component, Show } from "solid-js";
import { useUi } from "../../stores/uiStore";
import { useVisual } from "../../stores/visualStore";

const StatusChips: Component = () => {
  const ui = useUi();
  const visual = useVisual();

  return (
    <>
      <Show when={ui.state.aiDepthBusy}>
        <div id="ai-depth-chip"><div class="mini-spin"></div><span id="ai-depth-text">AI 深度估计…</span></div>
      </Show>
      <Show when={visual.state.beatMapBusy}>
        <div id="beat-chip"><div class="mini-spin"></div><span id="beat-text">分析节奏…</span></div>
      </Show>
    </>
  );
};

export default StatusChips;
