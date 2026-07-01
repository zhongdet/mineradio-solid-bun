// @ts-nocheck
import { Component } from "solid-js";

const GestureHud: Component = () => (
  <>
    <div id="gesture-hud" class="gesture-hud">
      <div>手势：<b id="gesture-label">待命</b></div>
      <div id="gesture-confirm" class="gesture-confirm">将手放进摄像头视野</div>
      <div class="gesture-meter"><span id="gesture-fill"></span></div>
      <div class="gesture-legend">手掌推开粒子 · 捏合旋转 · 握拳收束</div>
    </div>
    <canvas id="hand-canvas"></canvas>
  </>
);

export default GestureHud;
