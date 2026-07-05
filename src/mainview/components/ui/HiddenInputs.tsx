// @ts-nocheck
import { Component } from "solid-js";
import { useActionStore } from "../../stores/actionStore";

function handleFileInput(e: Event) {
  const input = e.target as HTMLInputElement;
  const files = input.files;
  if (!files || files.length === 0) return;
  for (const file of Array.from(files)) {
    if (file.type.startsWith("image/")) {
      loadImageFile(file);
      break;
    }
    // TODO: handle audio file import
  }
  input.value = "";
}

function loadImageFile(file: File) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const dataUrl = e.target?.result as string;
    const img = new Image();
    img.onload = () => {
      const iw = img.naturalWidth || img.width;
      const ih = img.naturalHeight || img.height;
      if (Math.abs(iw - ih) <= 1) {
        // Already square — commit directly
        const cv = document.createElement("canvas");
        cv.width = cv.height = 512;
        const ctx = cv.getContext("2d");
        if (ctx) ctx.drawImage(img, 0, 0, 512, 512);
        commitCustomCover(cv);
      } else {
        // Need crop
        useActionStore.getState().openCoverCrop(img, dataUrl);
      }
    };
    img.src = dataUrl;
  };
  reader.readAsDataURL(file);
}

function commitCustomCover(canvas: HTMLCanvasElement) {
  // Store the custom cover data URL for the current song
  const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
  const customCoverMap = (window as any).__customCoverMap || {};
  // Will be associated with current song when song changes
  (window as any).__customCoverMap = customCoverMap;
  (window as any).__pendingCustomCover = dataUrl;
}

const HiddenInputs: Component = () => (
  <>
    <input type="file" id="file-input" accept=".mp3,.flac,.wav,.ogg,.m4a,.jpg,.jpeg,.png,.webp" multiple style="display:none" onChange={handleFileInput} />
    <input type="file" id="background-image-input" accept=".jpg,.jpeg,.png,.webp,.mp4,.webm,.mov,image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime" style="display:none" />
    <div id="drop-overlay"><div class="drop-text">拖放音乐或封面</div></div>
    <div id="free-camera-hint">自由镜头 R 固定/退出 · WASD 移动 · 鼠标转向</div>
    <div id="loading-overlay"><div class="spinner"></div></div>
    <canvas id="login-guide-canvas" aria-hidden="true"></canvas>
  </>
);

export default HiddenInputs;
