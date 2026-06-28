// @ts-nocheck
import { Component } from "solid-js";

export const HiddenInputs: Component = () => (
  <>
    <input type="file" id="file-input" accept=".mp3,.flac,.wav,.ogg,.m4a,.jpg,.jpeg,.png,.webp" multiple style="display:none" />
    <input type="file" id="background-image-input" accept=".jpg,.jpeg,.png,.webp,.mp4,.webm,.mov,image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime" style="display:none" />
    <div id="drop-overlay"><div class="drop-text">拖放音乐或封面</div></div>
    <div id="free-camera-hint">自由镜头 R 固定/退出 · WASD 移动 · 鼠标转向</div>
    <div id="loading-overlay"><div class="spinner"></div></div>
    <canvas id="login-guide-canvas" aria-hidden="true"></canvas>
  </>
);
