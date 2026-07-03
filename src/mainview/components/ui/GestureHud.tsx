// @ts-nocheck
import { Component, Show } from "solid-js";
import { useFx } from "../../stores/fxStore";
import { useGesture } from "../../hooks/useGesture";

const GestureHud: Component = () => {
  const fx = useFx();
  const gesture = useGesture();

  return (
    <>
      <div id="gesture-hud" class="gesture-hud" style={{ display: fx.state.cam === "on" ? "block" : "none" }}>
        <div>手势：<b id="gesture-label">{gesture.gestureLabel()}</b></div>
        <Show when={!gesture.handActive()}>
          <div id="gesture-confirm" class="gesture-confirm">
            将手放进摄像头视野
          </div>
        </Show>
        <div class="gesture-meter">
          <span id="gesture-fill" style={{
            width: `${Math.min(100, gesture.gripVal() * 100)}%`,
          }}></span>
        </div>
        <div class="gesture-legend">手掌推开粒子 · 捏合旋转 · 握拳收束</div>
      </div>
      <canvas id="hand-canvas" style={{ display: "none" }}></canvas>
    </>
  );
};

export default GestureHud;
