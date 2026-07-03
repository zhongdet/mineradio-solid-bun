// @ts-nocheck
import { onMount, onCleanup } from "solid-js";
import { useUi } from "../stores/uiStore";
import { usePlayback } from "../stores/playbackStore";
import { useShelf } from "./useShelf";
import { isPointerOverUi } from "../lib/pointerUtils";

// Idle guide canvas state
let idleGuideCanvas = null;
let idleGuideCtx = null;
let idleGuideW = 0;
let idleGuideH = 0;
let idleGuideDpr = 1;
let idleGuideParticles = [];
let idleGuideTrails = [[], [], [], []];
let idleGuideStartedAt = 0;
let idleGuideVisible = false;
let idleGuideLastFrameAt = 0;
let idleGuideDelayTimer = null;
const IDLE_GUIDE_BACKGROUND_ENABLED = false;

// Interaction state
const idleGuideInteraction = {
  angle: 0,
  velocity: 0,
  rotX: -0.12,
  rotY: 0,
  spinX: 0,
  spinY: 0,
  zoom: 1,
  zoomTarget: 1,
  zoomPulse: 0,
  dragging: false,
  lastX: 0,
  lastY: 0,
  lastT: 0,
  pointerX: 0.5,
  pointerY: 0.5,
  pointerActive: false,
  focus: 0,
  press: 0,
  tiltX: 0,
  tiltY: 0,
};

const ui = useUi();
const playback = usePlayback();
const shelf = useShelf();

function shouldShowIdleGuide(): boolean {
  if (!IDLE_GUIDE_BACKGROUND_ENABLED) return false;
  if (document.body.classList.contains("splash-active")) return false;
  if (ui.state.immersiveMode) return false;
  if (playback.playing) return false;
  if (document.querySelector(".modal-mask.show")) return false;
  return true;
}

function shouldHandleIdleGuidePointer(e: MouseEvent): boolean {
  if (!idleGuideCanvas || !shouldShowIdleGuide()) return false;
  if (isPointerOverUi(e)) return false;
  return true;
}

function clampIdleGuideSpin(v: number): number {
  if (!isFinite(v)) return 0;
  return Math.max(-4.8, Math.min(4.8, v));
}

// --- Pointer event handlers ---

function idleGuidePointerDown(e: MouseEvent) {
  if (!shouldHandleIdleGuidePointer(e)) return;
  const guide = idleGuideInteraction;
  guide.dragging = true;
  guide.pointerActive = true;
  guide.lastX = e.clientX;
  guide.lastY = e.clientY;
  guide.lastT = performance.now();
  guide.pointerX = e.clientX / Math.max(1, idleGuideW || innerWidth);
  guide.pointerY = e.clientY / Math.max(1, idleGuideH || innerHeight);
  document.body.classList.add("idle-guide-dragging");
}

function idleGuidePointerMove(e: MouseEvent) {
  if (!idleGuideCanvas) return;
  const canReact = shouldHandleIdleGuidePointer(e) || idleGuideInteraction.dragging;
  idleGuideInteraction.pointerActive = canReact;
  if (canReact) {
    idleGuideInteraction.pointerX = e.clientX / Math.max(1, idleGuideW || innerWidth);
    idleGuideInteraction.pointerY = e.clientY / Math.max(1, idleGuideH || innerHeight);
  }
  if (!idleGuideInteraction.dragging) return;
  const guide = idleGuideInteraction;
  const now = performance.now();
  const dt = Math.max(1 / 120, Math.min(0.08, (now - guide.lastT) / 1000 || 1 / 60));
  const dx = e.clientX - guide.lastX;
  const dy = e.clientY - guide.lastY;
  const rx = -dy * 0.0032;
  const ry = dx * 0.0034;
  guide.rotX += rx;
  guide.rotY += ry;
  guide.angle += ry * 0.22;
  guide.spinX = clampIdleGuideSpin(rx / dt * 0.46);
  guide.spinY = clampIdleGuideSpin(ry / dt * 0.46);
  guide.velocity = Math.sqrt(guide.spinX * guide.spinX + guide.spinY * guide.spinY);
  guide.lastX = e.clientX;
  guide.lastY = e.clientY;
  guide.lastT = now;
}

function idleGuidePointerUp() {
  if (!idleGuideInteraction.dragging) return;
  idleGuideInteraction.dragging = false;
  document.body.classList.remove("idle-guide-dragging");
}

function idleGuidePointerLeave() {
  if (!idleGuideInteraction.dragging) idleGuideInteraction.pointerActive = false;
}

function idleGuideWheel(e: WheelEvent) {
  if (!shouldHandleIdleGuidePointer(e)) return;
  const guide = idleGuideInteraction;
  guide.pointerActive = true;
  guide.pointerX = e.clientX / Math.max(1, idleGuideW || innerWidth);
  guide.pointerY = e.clientY / Math.max(1, idleGuideH || innerHeight);
  const nextZoom = guide.zoomTarget * Math.exp(-e.deltaY * 0.0012);
  guide.zoomTarget = Math.max(0.58, Math.min(1.82, nextZoom));
  guide.zoomPulse = Math.min(1, guide.zoomPulse + Math.min(0.28, Math.abs(e.deltaY) * 0.0014));
  e.preventDefault();
}

// --- Resize ---

function resizeIdleGuideCanvas() {
  if (!idleGuideCanvas) return;
  idleGuideDpr = Math.min(window.devicePixelRatio || 1, 1.6);
  idleGuideW = window.innerWidth;
  idleGuideH = window.innerHeight;
  idleGuideCanvas.width = Math.max(1, Math.floor(idleGuideW * idleGuideDpr));
  idleGuideCanvas.height = Math.max(1, Math.floor(idleGuideH * idleGuideDpr));
  idleGuideCanvas.style.width = idleGuideW + "px";
  idleGuideCanvas.style.height = idleGuideH + "px";
  idleGuideCtx.setTransform(idleGuideDpr, 0, 0, idleGuideDpr, 0, 0);
  idleGuideParticles = [];
  resetIdleGuideTrails();
  if (!IDLE_GUIDE_BACKGROUND_ENABLED) return;
  const minDim = Math.min(idleGuideW, idleGuideH);
  const maxDim = Math.max(idleGuideW, idleGuideH);
  const count = idleGuideW < 800 ? 150 : 240;
  for (let i = 0; i < count; i++) {
    const ring = i < count * 0.76;
    const a = Math.random() * Math.PI * 2;
    const r = ring
      ? minDim * 0.035 + Math.pow(Math.random(), 0.58) * minDim * 0.335
      : Math.pow(Math.random(), 0.82) * maxDim * 0.58;
    const wobbleAmp = minDim * (ring ? 0.012 + Math.random() * 0.035 : 0.010 + Math.random() * 0.055);
    idleGuideParticles.push({
      a,
      r,
      cx: ring ? 0.5 : Math.random(),
      cy: ring ? 0.5 : Math.random(),
      size: ring ? 0.30 + Math.random() * 0.62 : 0.18 + Math.random() * 0.44,
      speed: ((ring ? 0.018 : 0.010) + Math.random() * (ring ? 0.045 : 0.030)) * (Math.random() < 0.5 ? -1 : 1),
      phase: Math.random() * Math.PI * 2,
      wobbleAmp,
      wobbleSpeed: 0.18 + Math.random() * 0.76,
      oval: 0.56 + Math.random() * 0.36,
      zAmp: 0.34 + Math.random() * 0.82,
      driftX: (Math.random() * 2 - 1) * wobbleAmp * 0.75,
      driftY: (Math.random() * 2 - 1) * wobbleAmp * 0.75,
      layer: Math.random(),
      z: (Math.random() * 2 - 1) * (ring ? minDim * 0.28 : maxDim * 0.42),
      ring,
    });
  }
}

// --- 3D to 2D projection ---

function projectIdleGuidePoint(
  x: number,
  y: number,
  z: number,
  rot: { sx: number; cx: number; sy: number; cy: number },
  cx: number,
  cy: number,
  depth: number,
): { x: number; y: number; z: number; scale: number } {
  const x1 = x * rot.cy + z * rot.sy;
  const z1 = -x * rot.sy + z * rot.cy;
  const y1 = y * rot.cx - z1 * rot.sx;
  const z2 = y * rot.sx + z1 * rot.cx;
  const scale = depth / (depth - z2 * 0.72);
  const clampedScale = Math.max(0.52, Math.min(1.74, scale));
  return {
    x: cx + x1 * clampedScale,
    y: cy + y1 * clampedScale,
    z: z2,
    scale: clampedScale,
  };
}

// --- Trails ---

function resetIdleGuideTrails() {
  idleGuideTrails = [[], [], [], []];
}

function pushIdleGuideTrail(index: number, pt: { x: number; y: number; scale?: number }, alpha: number, now: number) {
  const trail = idleGuideTrails[index];
  if (!trail) idleGuideTrails[index] = [];
  const last = trail[trail.length - 1];
  const dx = last ? pt.x - last.x : 999;
  const dy = last ? pt.y - last.y : 999;
  if (!last || Math.sqrt(dx * dx + dy * dy) > 1.4 || now - last.t > 42) {
    trail.push({ x: pt.x, y: pt.y, scale: pt.scale || 1, alpha: alpha || 1, t: now });
  }
  while (trail.length > 26) trail.shift();
}

function drawIdleGuideTrail(
  ctx: CanvasRenderingContext2D,
  trail: Array<{ x: number; y: number; scale: number; alpha: number; t: number }>,
  now: number,
  alpha: number,
  energy: number,
) {
  if (!trail || trail.length < 2) return;
  while (trail.length && now - trail[0].t > 680) trail.shift();
  if (trail.length < 2) return;
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (let i = 1; i < trail.length; i++) {
    const prev = trail[i - 1];
    const cur = trail[i];
    const age = (now - cur.t) / 680;
    const order = i / Math.max(1, trail.length - 1);
    const fade = Math.max(0, 1 - age) * order;
    if (fade <= 0) continue;
    ctx.strokeStyle = "rgba(255,255,255," + (alpha * fade * (0.18 + energy * 0.24)).toFixed(3) + ")";
    ctx.lineWidth = (0.7 + cur.scale * 0.9 + energy * 1.2) * fade;
    ctx.beginPath();
    ctx.moveTo(prev.x, prev.y);
    const mx = (prev.x + cur.x) * 0.5;
    const my = (prev.y + cur.y) * 0.5;
    ctx.quadraticCurveTo(mx, my, cur.x, cur.y);
    ctx.stroke();
  }
  ctx.restore();
}

// --- Frame scheduling ---

function scheduleIdleGuideFrame(delay?: number) {
  if (idleGuideDelayTimer) {
    clearTimeout(idleGuideDelayTimer);
    idleGuideDelayTimer = null;
  }
  if (delay && delay > 0) {
    idleGuideDelayTimer = setTimeout(() => {
      idleGuideDelayTimer = null;
      requestAnimationFrame(drawIdleGuideFrame);
    }, delay);
  } else {
    requestAnimationFrame(drawIdleGuideFrame);
  }
}

// --- Main render loop ---

function drawIdleGuideFrame() {
  if (!idleGuideCanvas || !idleGuideCtx) return;
  const ctx = idleGuideCtx;
  const nowFrame = performance.now();
  const dtFrame = Math.max(1 / 120, Math.min(0.05, (nowFrame - idleGuideLastFrameAt) / 1000 || 1 / 60));
  idleGuideLastFrameAt = nowFrame;

  const idleShow = shouldShowIdleGuide();
  const shelfCueValue = shelf.tickShelfHoverCue(dtFrame);
  const shelfCueShow = shelf.hasOpenContent();
  const show = idleShow || shelfCueShow;

  document.body.classList.toggle("idle-guide-on", show);
  document.body.classList.toggle("idle-guide-interactive", idleShow);
  if (!idleShow) document.body.classList.remove("idle-guide-dragging");

  if (!show) {
    idleGuideCtx.clearRect(0, 0, idleGuideW, idleGuideH);
    resetIdleGuideTrails();
    scheduleIdleGuideFrame(140);
    return;
  }

  const t = (nowFrame - idleGuideStartedAt) / 1000;
  const cx = idleGuideW * 0.5;
  const cy = idleGuideH * 0.50;
  const guide = idleGuideInteraction;

  // Physics: spin decay
  if (!guide.dragging) {
    guide.rotX += guide.spinX * dtFrame;
    guide.rotY += guide.spinY * dtFrame;
    guide.spinX *= Math.pow(0.90, dtFrame * 60);
    guide.spinY *= Math.pow(0.90, dtFrame * 60);
    if (Math.abs(guide.spinX) < 0.01) guide.spinX = 0;
    if (Math.abs(guide.spinY) < 0.01) guide.spinY = 0;
  }

  // Continuous rotation
  guide.rotY += 0.012 * dtFrame;
  guide.angle += guide.spinY * dtFrame * 0.2 + 0.01 * dtFrame;
  guide.velocity = Math.sqrt(guide.spinX * guide.spinX + guide.spinY * guide.spinY);

  // Focus / press interpolation
  const targetFocus = guide.pointerActive ? 1 : 0;
  const targetPress = guide.dragging ? 1 : 0;
  guide.focus += (targetFocus - guide.focus) * 0.1;
  guide.press += (targetPress - guide.press) * 0.16;
  guide.zoom += (guide.zoomTarget - guide.zoom) * 0.13;
  guide.zoomPulse *= Math.pow(0.84, dtFrame * 60);
  if (guide.zoomPulse < 0.002) guide.zoomPulse = 0;

  // Pointer tilt
  guide.tiltX += ((guide.pointerX - 0.5) * 0.26 - guide.tiltX) * 0.08;
  guide.tiltY += ((guide.pointerY - 0.5) * 0.18 - guide.tiltY) * 0.08;

  // --- Clear ---
  ctx.clearRect(0, 0, idleGuideW, idleGuideH);
  ctx.globalCompositeOperation = "lighter";

  // --- Background halo ---
  const breathe = 0.5 + 0.5 * Math.sin(t * 0.72);
  const zoom = guide.zoom;
  const zoomBoost = guide.zoomPulse;
  const haloRadius =
    Math.min(idleGuideW, idleGuideH) * (0.36 + breathe * 0.035 + guide.press * 0.018) * zoom;
  const halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, haloRadius);
  halo.addColorStop(
    0,
    "rgba(255,255,255," +
      (0.034 + breathe * 0.02 + guide.focus * 0.014 + guide.press * 0.018 + zoomBoost * 0.018).toFixed(3) +
      ")",
  );
  halo.addColorStop(
    0.44,
    "rgba(255,255,255," + (0.014 + guide.focus * 0.01).toFixed(3) + ")",
  );
  halo.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, idleGuideW, idleGuideH);

  // --- Ring particles ---
  const ringPts: Array<{ x: number; y: number; z: number; scale: number; alpha: number }> = [];
  const pointerX = guide.pointerX * idleGuideW;
  const pointerY = guide.pointerY * idleGuideH;
  const spinEnergy = Math.min(1, guide.velocity / 1.5 + guide.press * 0.42);
  const rot = {
    sx: Math.sin(guide.rotX),
    cx: Math.cos(guide.rotX),
    sy: Math.sin(guide.rotY),
    cy: Math.cos(guide.rotY),
  };
  const depth = Math.max(520, Math.min(idleGuideW, idleGuideH) * 0.92);

  for (let i = 0; i < idleGuideParticles.length; i++) {
    const p = idleGuideParticles[i];
    const localA = p.a + t * p.speed;
    const wanderA = p.phase + t * p.wobbleSpeed;
    const wobble =
      Math.sin(wanderA) * p.wobbleAmp +
      Math.sin(t * (p.wobbleSpeed * 0.57 + 0.11) + p.phase * 1.7) * p.wobbleAmp * 0.45;
    let x: number, y: number;
    let projected: ReturnType<typeof projectIdleGuidePoint> | null = null;
    let pointScale = 1;

    if (p.ring) {
      const rr = (p.r + wobble + breathe * 12) * zoom * (1 + guide.press * 0.03 + zoomBoost * 0.018);
      const baseX =
        Math.cos(localA) * rr +
        Math.sin(wanderA * 0.73) * p.wobbleAmp * 0.54 +
        p.driftX;
      const baseY =
        Math.sin(localA + Math.sin(wanderA) * 0.1) * rr * p.oval +
        Math.sin(t * 0.33 + p.phase) * p.wobbleAmp * 0.68 +
        p.driftY;
      const baseZ =
        (Math.sin(localA * 0.84 + p.phase * 0.31) * rr * p.zAmp + p.z * 0.54 + Math.cos(wanderA * 0.91) * p.wobbleAmp) *
        zoom;
      projected = projectIdleGuidePoint(baseX, baseY, baseZ, rot, cx, cy, depth);
      pointScale = projected.scale;
      x = projected.x + guide.tiltX * projected.z * 0.02;
      y = projected.y + guide.tiltY * projected.z * 0.018;

      // Pointer attraction
      const nDx = pointerX - x;
      const nDy = pointerY - y;
      const near = guide.focus * Math.max(0, 1 - Math.sqrt(nDx * nDx + nDy * nDy) / 210);
      x += nDx * near * 0.04;
      y += nDy * near * 0.04;

      ringPts.push({
        x,
        y,
        z: projected.z,
        scale: projected.scale,
        alpha: 0.08 + breathe * 0.04 + near * 0.08,
      });
    } else {
      const driftX =
        ((p.cx - 0.5) * idleGuideW * 0.92 +
          Math.cos(localA) * (12 + p.wobbleAmp * 0.28) +
          wobble * 0.28) *
        zoom;
      const driftY =
        ((p.cy - 0.5) * idleGuideH * 0.72 +
          Math.sin(localA * 0.8 + p.phase * 0.2) * (12 + p.wobbleAmp * 0.24)) *
        zoom;
      const driftZ =
        (p.z + Math.sin(localA + p.phase) * (32 + p.wobbleAmp * 0.32)) * zoom;
      const fieldPt = projectIdleGuidePoint(driftX, driftY, driftZ, rot, cx, cy, depth * 1.16);
      pointScale = fieldPt.scale;
      x = fieldPt.x;
      y = fieldPt.y;
    }

    const depthGlow = p.ring && projected ? 0.66 + projected.scale * 0.2 : 1;
    const aP = p.ring
      ? (0.07 + breathe * 0.065 + Math.sin(t * (0.8 + p.layer) + p.phase) * 0.024 + spinEnergy * 0.032) *
        depthGlow
      : 0.034 + guide.focus * 0.01;

    ctx.beginPath();
    ctx.arc(
      x,
      y,
      p.size * pointScale * Math.sqrt(zoom) * (1 + spinEnergy * (p.ring ? 0.24 : 0.08) + zoomBoost * 0.12),
      0,
      Math.PI * 2,
    );
    ctx.fillStyle = "rgba(255,255,255," + Math.max(0, aP).toFixed(3) + ")";
    ctx.fill();
  }

  // --- Ring connections ---
  ctx.lineWidth = 1;
  for (let j = 0; j < ringPts.length; j += 3) {
    const aPt = ringPts[j];
    const bPt = ringPts[(j + 7) % ringPts.length];
    if (!aPt || !bPt) continue;
    const dx = aPt.x - bPt.x;
    const dy = aPt.y - bPt.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > Math.min(idleGuideW, idleGuideH) * 0.17) continue;
    ctx.strokeStyle =
      "rgba(255,255,255," +
      (0.018 + breathe * 0.02 + guide.focus * 0.012 + spinEnergy * 0.018).toFixed(3) +
      ")";
    ctx.beginPath();
    ctx.moveTo(aPt.x, aPt.y);
    ctx.lineTo(bPt.x, bPt.y);
    ctx.stroke();
  }

  // --- Anchor points with trails ---
  if (guide.focus > 0.03 || spinEnergy > 0.05) {
    const orbitR = Math.min(idleGuideW, idleGuideH) * (0.305 + guide.press * 0.018) * zoom;
    const anchorAlpha = Math.min(0.68, 0.16 + guide.focus * 0.24 + spinEnergy * 0.38);
    for (let k = 0; k < 4; k++) {
      const anchorA = guide.angle + t * 0.08 + k * 1.72 + (k === 2 ? 0.38 : 0);
      const anchorPt = projectIdleGuidePoint(
        Math.cos(anchorA) * orbitR,
        Math.sin(anchorA) * orbitR * 0.52,
        Math.sin(anchorA + k * 0.54) * orbitR * 0.48,
        rot,
        cx,
        cy,
        depth,
      );
      pushIdleGuideTrail(k, anchorPt, anchorAlpha, nowFrame);
      drawIdleGuideTrail(ctx, idleGuideTrails[k], nowFrame, anchorAlpha, spinEnergy);

      ctx.beginPath();
      ctx.arc(
        anchorPt.x,
        anchorPt.y,
        (2.0 + spinEnergy * 1.8 + (k === 0 ? guide.press * 1.8 : 0)) * anchorPt.scale,
        0,
        Math.PI * 2,
      );
      ctx.fillStyle = "rgba(255,255,255," + anchorAlpha.toFixed(3) + ")";
      ctx.fill();
    }
  }

  // --- Handle (center interactive element) ---
  if (guide.focus > 0.03) {
    const handleA = guide.angle + t * 0.36;
    const handleR = Math.min(idleGuideW, idleGuideH) * (0.315 + breathe * 0.012 + guide.press * 0.012) * zoom;
    const handlePt = projectIdleGuidePoint(
      Math.cos(handleA) * handleR,
      Math.sin(handleA) * handleR * 0.52,
      Math.sin(handleA + 0.62) * handleR * 0.48,
      rot,
      cx,
      cy,
      depth,
    );
    const hx = handlePt.x;
    const hy = handlePt.y;

    const handleGlow = ctx.createRadialGradient(hx, hy, 0, hx, hy, 28 + guide.press * 12);
    handleGlow.addColorStop(0, "rgba(255,255,255," + (0.22 * guide.focus + 0.16 * guide.press).toFixed(3) + ")");
    handleGlow.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = handleGlow;
    ctx.beginPath();
    ctx.arc(hx, hy, 28 + guide.press * 12, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(hx, hy, 2.4 + guide.press * 1.6, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255," + (0.54 * guide.focus + 0.24 * guide.press).toFixed(3) + ")";
    ctx.fill();
  }

  // Shelf hover cue
  if (shelfCueShow) {
    ctx.globalCompositeOperation = "lighter";
    drawShelfGuideCue(ctx, t, shelfCueValue);
  }

  ctx.globalCompositeOperation = "source-over";
  scheduleIdleGuideFrame(0);
}

function drawShelfGuideCue(_ctx: CanvasRenderingContext2D, _t: number, _cue: number) {
  // Placeholder - shelf hover cue rendering (deferred with skull particles)
}

// --- Init ---

export function useIdleGuide() {
  onMount(() => {
    idleGuideCanvas = document.getElementById("idle-guide-canvas");
    if (!idleGuideCanvas) return;
    idleGuideCtx = idleGuideCanvas.getContext("2d");
    if (!idleGuideCtx) return;
    idleGuideStartedAt = performance.now();
    idleGuideLastFrameAt = performance.now();

    resizeIdleGuideCanvas();

    window.addEventListener("resize", resizeIdleGuideCanvas);

    // Pointer event listeners
    const canvas = idleGuideCanvas;
    canvas.addEventListener("pointerdown", idleGuidePointerDown);
    window.addEventListener("pointermove", idleGuidePointerMove);
    window.addEventListener("pointerup", idleGuidePointerUp);
    canvas.addEventListener("pointerleave", idleGuidePointerLeave);
    canvas.addEventListener("wheel", idleGuideWheel, { passive: false });

    drawIdleGuideFrame();

    onCleanup(() => {
      window.removeEventListener("resize", resizeIdleGuideCanvas);
      canvas.removeEventListener("pointerdown", idleGuidePointerDown);
      window.removeEventListener("pointermove", idleGuidePointerMove);
      window.removeEventListener("pointerup", idleGuidePointerUp);
      canvas.removeEventListener("pointerleave", idleGuidePointerLeave);
      canvas.removeEventListener("wheel", idleGuideWheel);
      if (idleGuideDelayTimer) {
        clearTimeout(idleGuideDelayTimer);
        idleGuideDelayTimer = null;
      }
    });
  });
}

export type IdleGuideHook = ReturnType<typeof useIdleGuide>;
