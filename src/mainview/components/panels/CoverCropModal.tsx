// @ts-nocheck
import { Component, createSignal, createEffect, onCleanup, onMount } from "solid-js";

declare const gsap: any;

interface CoverCropModalProps {
  img: HTMLImageElement;
  dataUrl: string;
  onClose: () => void;
  onCommit: (canvas: HTMLCanvasElement) => void;
}

const CoverCropModal: Component<CoverCropModalProps> = (props) => {
  const [scale, setScale] = createSignal(1);
  let maskRef: HTMLDivElement | undefined;
  let stageRef: HTMLDivElement | undefined;
  let imgRef: HTMLImageElement | undefined;
  let previewRef: HTMLCanvasElement | undefined;
  let zoomRef: HTMLInputElement | undefined;

  let state = {
    naturalW: 0,
    naturalH: 0,
    stageSize: 312,
    baseScale: 1,
    x: 0,
    y: 0,
    dragging: false,
    lastX: 0,
    lastY: 0,
  };

  onMount(() => {
    state.naturalW = props.img.naturalWidth || props.img.width;
    state.naturalH = props.img.naturalHeight || props.img.height;
    animateOpen();
    requestAnimationFrame(() => {
      initGeometry();
      updateTransform();
    });
  });

  onCleanup(() => {});

  function animateOpen() {
    if (!maskRef || !window.gsap) return;
    const panel = maskRef.querySelector<HTMLElement>(".modal");
    maskRef.classList.add("show");
    window.gsap.set(maskRef, { display: "flex", visibility: "visible" });
    window.gsap.fromTo(maskRef, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.38, ease: "power2.out", overwrite: true });
    if (panel) {
      window.gsap.fromTo(panel,
        { autoAlpha: 0, y: 26, scale: 0.965, filter: "blur(12px)" },
        { autoAlpha: 1, y: 0, scale: 1, filter: "blur(0px)", duration: 0.68, ease: "expo.out", overwrite: true }
      );
    }
  }

  function animateClose() {
    if (!maskRef || !window.gsap) { props.onClose(); return; }
    const panel = maskRef.querySelector<HTMLElement>(".modal");
    if (panel) window.gsap.to(panel, { autoAlpha: 0, y: 18, scale: 0.976, filter: "blur(8px)", duration: 0.28, ease: "power2.in", overwrite: true });
    window.gsap.to(maskRef, {
      autoAlpha: 0, duration: 0.34, ease: "power2.inOut", overwrite: true,
      onComplete: () => {
        maskRef!.classList.remove("show");
        window.gsap.set(maskRef!, { clearProps: "display,visibility,opacity" });
        if (panel) window.gsap.set(panel, { clearProps: "opacity,visibility,transform,filter" });
        props.onClose();
      },
    });
  }

  function initGeometry() {
    const rect = stageRef?.getBoundingClientRect();
    state.stageSize = rect ? Math.max(220, Math.round(rect.width)) : 312;
    state.baseScale = state.stageSize / Math.min(state.naturalW, state.naturalH);
    state.x = 0;
    state.y = 0;
    setScale(1);
  }

  function clampPan() {
    const s = state.baseScale * scale();
    const rw = state.naturalW * s;
    const rh = state.naturalH * s;
    const maxX = Math.max(0, (rw - state.stageSize) / 2);
    const maxY = Math.max(0, (rh - state.stageSize) / 2);
    state.x = Math.max(-maxX, Math.min(maxX, state.x));
    state.y = Math.max(-maxY, Math.min(maxY, state.y));
  }

  function updateTransform() {
    clampPan();
    if (!imgRef) return;
    const baseW = state.naturalW * state.baseScale;
    const baseH = state.naturalH * state.baseScale;
    imgRef.style.width = baseW + "px";
    imgRef.style.height = baseH + "px";
    imgRef.style.transform = `translate(-50%, -50%) translate(${state.x}px,${state.y}px) scale(${scale()})`;
    drawPreview();
  }

  function currentCropRect() {
    const s = state.baseScale * scale();
    const rw = state.naturalW * s;
    const rh = state.naturalH * s;
    const left = state.stageSize / 2 - rw / 2 + state.x;
    const top = state.stageSize / 2 - rh / 2 + state.y;
    let sx = (0 - left) / s;
    let sy = (0 - top) / s;
    const sSize = state.stageSize / s;
    sx = Math.max(0, Math.min(state.naturalW - sSize, sx));
    sy = Math.max(0, Math.min(state.naturalH - sSize, sy));
    return { sx, sy, sSize };
  }

  function drawPreview() {
    const preview = previewRef;
    const crop = currentCropRect();
    if (!preview || !crop) return;
    const ctx = preview.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, preview.width, preview.height);
    ctx.drawImage(props.img, crop.sx, crop.sy, crop.sSize, crop.sSize, 0, 0, preview.width, preview.height);
  }

  function handlePointerDown(e: PointerEvent) {
    state.dragging = true;
    state.lastX = e.clientX;
    state.lastY = e.clientY;
    stageRef?.classList.add("dragging");
    if (stageRef?.setPointerCapture) {
      try { stageRef.setPointerCapture(e.pointerId); } catch {}
    }
  }

  function handlePointerMove(e: PointerEvent) {
    if (!state.dragging) return;
    state.x += e.clientX - state.lastX;
    state.y += e.clientY - state.lastY;
    state.lastX = e.clientX;
    state.lastY = e.clientY;
    updateTransform();
  }

  function stopDrag() {
    state.dragging = false;
    stageRef?.classList.remove("dragging");
  }

  function handleWheel(e: WheelEvent) {
    e.preventDefault();
    const next = scale() + (e.deltaY < 0 ? 0.10 : -0.10);
    const clamped = Math.max(1, Math.min(3.2, next));
    setScale(clamped);
    if (zoomRef) zoomRef.value = String(clamped);
    updateTransform();
  }

  function handleZoomInput(e: Event) {
    const val = parseFloat((e.target as HTMLInputElement).value) || 1;
    setScale(Math.max(1, Math.min(3.2, val)));
    updateTransform();
  }

  function handleBackdrop(e: MouseEvent) {
    if (e.target === e.currentTarget) animateClose();
  }

  function handleCommit() {
    const crop = currentCropRect();
    const cv = document.createElement("canvas");
    cv.width = cv.height = 512;
    const ctx = cv.getContext("2d");
    if (ctx) {
      ctx.drawImage(props.img, crop.sx, crop.sy, crop.sSize, crop.sSize, 0, 0, 512, 512);
    }
    props.onCommit(cv);
    animateClose();
  }

  return (
    <div id="cover-crop-modal" class="modal-mask" ref={maskRef} onClick={handleBackdrop}>
      <div class="modal cover-crop-modal" onClick={(e) => e.stopPropagation()}>
        <h2>裁剪封面</h2>
        <div class="cover-crop-layout">
          <div
            id="cover-crop-stage"
            class="cover-crop-stage"
            ref={stageRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={stopDrag}
            onPointerCancel={stopDrag}
            onWheel={handleWheel}
          >
            <img
              id="cover-crop-img"
              ref={imgRef}
              src={props.dataUrl}
              alt=""
              style={{ position: "absolute", left: "50%", top: "50%", "max-width": "none", "max-height": "none", "user-select": "none", "pointer-events": "none", "will-change": "transform" }}
            />
          </div>
          <div class="cover-crop-side">
            <canvas id="cover-crop-preview" ref={previewRef} width="160" height="160"></canvas>
            <label class="cover-zoom-control">
              <span>缩放</span>
              <input ref={zoomRef} id="cover-crop-zoom" type="range" min="1" max="3.2" step="0.01" value="1" onInput={handleZoomInput} />
            </label>
          </div>
        </div>
        <div class="btn-row">
          <button class="modal-btn" onClick={animateClose}>取消</button>
          <button class="modal-btn primary" onClick={handleCommit}>使用封面</button>
        </div>
      </div>
    </div>
  );
};

export default CoverCropModal;
