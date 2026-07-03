// @ts-nocheck
import * as THREE from "three";
import { useFx } from "../stores/fxStore";
import { useShelf } from "../stores/shelfStore";
import { usePlayback } from "../stores/playbackStore";
import { useVisual } from "../stores/visualStore";

const VISIBLE_RADIUS = 5;
const CARD_W = 2.05;
const CARD_H = 1.025;
const CANVAS_W = 720;
const CANVAS_H = 360;

const coverCache: Record<string, { loaded: boolean; loading: boolean; img: HTMLImageElement | null; failed: boolean }> = {};

function loadCover(url: string): Promise<HTMLImageElement | null> {
  if (!url) return Promise.resolve(null);
  const rec = coverCache[url];
  if (rec?.loaded && rec.img) return Promise.resolve(rec.img);
  if (rec?.loading) return new Promise(() => {});
  coverCache[url] = { loaded: false, loading: true, img: null, failed: false };
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => { coverCache[url] = { loaded: true, loading: false, img, failed: false }; resolve(img); };
    img.onerror = () => { coverCache[url] = { loaded: true, loading: false, img: null, failed: true }; resolve(null); };
    img.src = url;
  });
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lh: number, maxLines: number) {
  const chars = String(text || "").split("");
  let line = "";
  const lines: string[] = [];
  for (const ch of chars) {
    const test = line + ch;
    if (ctx.measureText(test).width > maxW && line) {
      lines.push(line);
      line = ch;
      if (lines.length >= maxLines - 1) break;
    } else {
      line = test;
    }
  }
  if (line && lines.length < maxLines) lines.push(line);
  for (let j = 0; j < lines.length; j++) ctx.fillText(lines[j], x, y + j * lh);
}

function drawCard(
  card: { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; texture: THREE.CanvasTexture; item: any; isCenter: boolean },
  bass: number,
  accentColor: string,
) {
  const { canvas, ctx, texture, item, isCenter } = card;
  const W = canvas.width;
  const H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  const pad = 18;

  roundRect(ctx, pad, pad, W - pad * 2, H - pad * 2, 32);
  ctx.fillStyle = "rgba(0,0,0,0.82)";
  ctx.fill();
  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, "rgba(255,255,255,0.10)");
  grad.addColorStop(1, "rgba(255,255,255,0.018)");
  ctx.fillStyle = grad;
  ctx.fill();

  const isNow = item.isCurrent;
  ctx.strokeStyle = isNow ? accentColor + "b8" : "rgba(255,255,255,0.14)";
  ctx.lineWidth = isNow ? 1.8 + bass * 1.2 : 1.1;
  ctx.stroke();

  const coverSize = H - pad * 2 - 8;
  const cx = pad + 6;
  const cy = pad + 4;
  roundRect(ctx, cx, cy, coverSize, coverSize, 26);
  ctx.fillStyle = "rgba(255,255,255,0.04)";
  ctx.fill();

  if (item.cover) {
    const rec = coverCache[item.cover];
    if (rec?.loaded && rec.img) {
      ctx.save();
      roundRect(ctx, cx, cy, coverSize, coverSize, 26);
      ctx.clip();
      ctx.drawImage(rec.img, cx, cy, coverSize, coverSize);
      ctx.restore();
    } else {
      loadCover(item.cover);
    }
  }

  const tx = pad + coverSize + 32;
  ctx.font = "700 17px Inter, Arial";
  ctx.fillStyle = isNow ? accentColor : "rgba(255,255,255,0.92)";
  ctx.fillText(item.tag || "", tx, pad + 36);

  ctx.font = "700 30px Inter, Arial";
  ctx.fillStyle = "rgba(255,255,255,0.96)";
  wrapText(ctx, item.title || "", tx, pad + 78, W - tx - pad - 14, 36, 2);

  ctx.font = "400 17px Inter, Arial";
  ctx.fillStyle = "rgba(255,255,255,0.52)";
  wrapText(ctx, item.sub || "", tx, pad + 156, W - tx - pad - 14, 24, 2);

  ctx.strokeStyle = isNow ? accentColor + "e6" : "rgba(255,255,255,0.30)";
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.moveTo(tx, H - pad - 22);
  ctx.lineTo(tx + Math.min(260, 80 + bass * 320), H - pad - 22);
  ctx.stroke();

  if (isCenter) {
    ctx.font = "600 14px Inter, Arial";
    ctx.fillStyle = accentColor + "d6";
    ctx.fillText("\u70b9\u51fb\u64ad\u653e", tx, H - pad - 50);
  }

  texture.needsUpdate = true;
}

export function useShelf3D(scene: THREE.Scene | null, camera: THREE.PerspectiveCamera | null) {
  const fx = useFx();
  const shelf = useShelf();
  const playback = usePlayback();
  const visual = useVisual();

  let group: THREE.Group | null = null;
  let cards: Array<{
    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
    texture: THREE.CanvasTexture;
    mesh: THREE.Mesh;
    item: any;
    index: number;
    isCenter: boolean;
    selected: boolean;
    floatMix: number;
    drawKey: string;
    lastDof?: number;
    dofBucket?: number;
    fxPulse?: number;
  }> = [];
  let centerSmooth = 0;
  let centerTarget = 0;
  let lastRebuildTime = 0;
  let lastDrawTime = 0;
  let shelfVisibility = 0;
  let appRevealed = false;

  function getMode(): string {
    return fx.state.shelf;
  }

  function shelfAlwaysVisible(): boolean {
    return fx.state.shelfPresence === "always";
  }

  function rebuild() {
    if (!group) return;

    for (const c of cards) {
      c.texture.dispose();
      c.mesh.material.dispose();
      c.mesh.geometry.dispose();
      group.remove(c.mesh);
    }
    cards = [];

    const queue = playback.state.playQueue;
    const currentIdx = playback.state.currentIdx;
    const items: any[] = [];

    for (let i = 0; i < Math.min(queue.length, 30); i++) {
      const song = queue[i];
      if (!song) continue;
      items.push({
        type: "queue",
        title: song.name || "",
        sub: song.artist || "",
        cover: song.cover || "",
        tag: i === currentIdx ? "\u6b63\u5728\u64ad\u653e" : `#${i + 1}`,
        queueIndex: i,
        isCurrent: i === currentIdx,
      });
    }

    if (items.length && currentIdx >= 0) {
      centerTarget = Math.min(items.length - 1, currentIdx);
      centerSmooth = centerTarget;
    }

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const cv = document.createElement("canvas");
      cv.width = CANVAS_W;
      cv.height = CANVAS_H;
      const ctx = cv.getContext("2d")!;
      const tx = new THREE.CanvasTexture(cv);
      tx.minFilter = THREE.LinearFilter;
      tx.magFilter = THREE.LinearFilter;
      tx.generateMipmaps = false;
      const mat = new THREE.MeshBasicMaterial({
        map: tx,
        transparent: true,
        opacity: 0.96,
        depthWrite: false,
        depthTest: false,
        side: THREE.DoubleSide,
      });
      const geo = new THREE.PlaneGeometry(CARD_W, CARD_H, 1, 1);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.renderOrder = 50 + i;
      mesh.userData = { action: { kind: "playQueue", index: item.queueIndex } };
      group!.add(mesh);

      cards.push({
        canvas: cv,
        ctx,
        texture: tx,
        mesh,
        item,
        index: i,
        isCenter: Math.abs(i - centerSmooth) < 0.5,
        selected: false,
        floatMix: 0,
        drawKey: "",
      });
    }
  }

  function ensureGroup(scene: THREE.Scene) {
    if (!group) {
      group = new THREE.Group();
      group.renderOrder = 50;
      scene.add(group);
    }
  }

  function placeCard(card: any, mode: string, parX: number, parY: number, bass: number) {
    const delta = card.index - centerSmooth;
    const absD = Math.abs(delta);
    if (absD > VISIBLE_RADIUS + 0.5) {
      card.mesh.visible = false;
      return;
    }
    card.mesh.visible = true;
    card.mesh.renderOrder = 60 + Math.round((VISIBLE_RADIUS + 1 - Math.min(absD, VISIBLE_RADIUS + 1)) * 10);

    const parWeight = Math.max(0, 1 - absD * 0.16);
    const pulse = card.fxPulse || 0;

    // DOF blur on distant cards
    const nextDof = Math.max(0, Math.min(1, (absD - 0.45) / 3.2));
    const nextDofBucket = Math.round(nextDof * 5);
    if (card.dofBucket !== nextDofBucket) {
      card.dofBucket = nextDofBucket;
      drawCard(card, bass, fx.state.shelfAccentColor);
    }

    // Selection lift animation
    const liftTarget = card.selected ? 1 : 0;
    const liftRate = liftTarget > (card.floatMix || 0) ? 0.20 : 0.13;
    card.floatMix = (card.floatMix || 0) + (liftTarget - (card.floatMix || 0)) * liftRate;
    if (!liftTarget && card.floatMix < 0.004) card.floatMix = 0;
    const lift = card.floatMix || 0;

    if (mode === "side") {
      const shelfCtl = {
        size: fx.state.shelfSize,
        x: fx.state.shelfOffsetX,
        y: fx.state.shelfOffsetY,
        z: fx.state.shelfOffsetZ,
        angle: fx.state.shelfAngleY * (Math.PI / 180),
        opacity: fx.state.shelfOpacity,
      };

      // Layout values matching original (non-portrait, non-narrow, non-skull defaults)
      const sideX = 3.18 + shelfCtl.x;
      const sideY = shelfCtl.y;
      const sideXStep = 0.040;
      const sideYStep = 0.68;
      const sideZ = 0.86 + shelfCtl.z;
      const sideZStep = 0.170;
      const sideScale = shelfCtl.size;
      const sideRotY = 0.28 + shelfCtl.angle;
      const sideRotX = 0.042;

      // Position: arc with X stepping in, Y stepping down, Z stepping back
      const px = sideX + absD * sideXStep + parX * 0.060 * parWeight - lift * 0.145;
      const py = sideY - delta * sideYStep + parY * 0.046 * parWeight + lift * 0.105;
      const pz = sideZ - absD * sideZStep + (parY * 0.026 - parX * 0.028) * parWeight + lift * 0.220;

      const scale = (absD < 0.5 ? 1.12 : Math.max(0.55, 1.04 - absD * 0.14)) * (1 + pulse * 0.056 + lift * 0.075) * sideScale;

      card.mesh.position.set(px, py, pz);
      card.mesh.rotation.y = sideRotY + parX * 0.038 * parWeight;
      card.mesh.rotation.x = -delta * sideRotX - parY * 0.024 * parWeight;
      card.mesh.scale.setScalar(scale);

      // Opacity: distance fade + visibility + shelf opacity
      const opBase = absD < 0.5 ? 1.0 : Math.max(0.22, 1.0 - absD * 0.30);
      card.mesh.material.opacity = Math.min(1, opBase * shelfVisibility + pulse * 0.10) * shelfCtl.opacity;
    } else {
      // Stage mode
      const stageXStep = 1.55;
      const stageY = -2.20 + fx.state.shelfOffsetY;
      const stageZ = 1.0 + fx.state.shelfOffsetZ;
      const stageScale = fx.state.shelfSize;

      const px = fx.state.shelfOffsetX + delta * stageXStep + parX * 0.110 * parWeight;
      const py = stageY + parY * 0.060 * parWeight;
      const pz = (absD < 0.5 ? stageZ : stageZ - Math.min(2.0, absD) * 0.55) + (parY * 0.040 - parX * 0.035) * parWeight;
      const scale = (absD < 0.5 ? 1.20 : Math.max(0.45, 1.0 - absD * 0.22)) * (1 + pulse * 0.060) * stageScale;

      card.mesh.position.set(px, py, pz);
      card.mesh.rotation.y = -delta * 0.22 + parX * 0.050 * parWeight;
      card.mesh.rotation.x = 0.10 - absD * 0.04 - parY * 0.028 * parWeight;
      card.mesh.scale.setScalar(scale);

      const opBase = absD < 0.5 ? 1.0 : Math.max(0.22, 1.0 - absD * 0.30);
      card.mesh.material.opacity = opBase * fx.state.shelfOpacity;
    }
  }

  function update(dt: number) {
    if (!group || !scene) return;

    const mode = getMode();
    if (mode === "off") {
      if (group.parent) scene.remove(group);
      return;
    }

    if (!group.parent) scene.add(group);

    // Mark app as revealed after first meaningful update
    if (!appRevealed && playback.state.playQueue.length > 0) {
      appRevealed = true;
    }

    // Rebuild if data changed
    const now = performance.now() / 1000;
    if (now - lastRebuildTime > 0.8) {
      lastRebuildTime = now;
      const queueLen = playback.state.playQueue.length;
      if (queueLen !== cards.length) {
        rebuild();
      }
    }

    // Smooth center
    centerSmooth += (centerTarget - centerSmooth) * 0.16;
    if (Math.abs(centerSmooth - centerTarget) < 0.001) centerSmooth = centerTarget;

    // Pointer parallax
    const parX = (visual.state.pointerParallax as any)?.x || 0;
    const parY = (visual.state.pointerParallax as any)?.y || 0;

    // Audio bass for card animations
    const bass = visual.state.smoothBass || 0;

    // Visibility animation (matches original)
    const modeVal = getMode();
    let targetVis: number;
    if (!appRevealed) {
      targetVis = 0;
    } else if (modeVal === "side") {
      if (!cards.length) targetVis = 0;
      else targetVis = (shelf.state.pinnedOpen || shelfAlwaysVisible()) ? 1.0 : 0;
    } else {
      targetVis = cards.length ? 1.0 : 0;
    }
    shelfVisibility += (targetVis - shelfVisibility) * (targetVis > shelfVisibility ? 0.22 : 0.18);
    if (shelfVisibility < 0.01 && targetVis === 0) shelfVisibility = 0;
    group.visible = appRevealed && (modeVal !== "side" || shelfVisibility > 0) && cards.length > 0;

    // Group rotation: bind to particles when always-visible
    const pRot = visual.state.particlesRotation;
    const bindToCover = shelfAlwaysVisible() && pRot && modeVal === "side";
    if (bindToCover) {
      group.rotation.x += ((pRot.x - parY * 0.010) - group.rotation.x) * 0.075;
      group.rotation.y += ((pRot.y + parX * 0.018) - group.rotation.y) * 0.075;
      group.rotation.z += (pRot.z - group.rotation.z) * 0.075;
    } else {
      group.rotation.y += (parX * 0.018 - group.rotation.y) * 0.045;
      group.rotation.x += (-parY * 0.010 - group.rotation.x) * 0.045;
      group.rotation.z *= 0.955;
    }

    // Passive always-visible group render order
    const passiveAlwaysGroup = shelfAlwaysVisible() && !shelf.state.pinnedOpen;
    const liftedCardActive = passiveAlwaysGroup && cards.some((c) => c.selected || (c.floatMix || 0) > 0.025);
    group.renderOrder = passiveAlwaysGroup && !liftedCardActive ? 30 : 50;

    // Place cards
    for (const card of cards) {
      placeCard(card, modeVal, parX, parY, bass);
    }

    // Redraw cards periodically
    if (now - lastDrawTime > 1.35) {
      lastDrawTime = now;
      for (const card of cards) {
        card.isCenter = Math.abs(card.index - centerSmooth) < 0.5;
        if (card.isCenter || card.index === playback.state.currentIdx) {
          drawCard(card, bass, fx.state.shelfAccentColor);
        }
      }
    }
  }

  function dispose() {
    if (group && scene) {
      for (const c of cards) {
        c.texture.dispose();
        c.mesh.material.dispose();
        c.mesh.geometry.dispose();
      }
      scene.remove(group);
      group = null;
      cards = [];
    }
  }

  // ── Interaction: click to play/scroll ──

  function raycasterFromPointerEvent(e: MouseEvent): THREE.Raycaster {
    const mx = (e.clientX / window.innerWidth) * 2 - 1;
    const my = -(e.clientY / window.innerHeight) * 2 + 1;
    const rc = new THREE.Raycaster();
    rc.setFromCamera(new THREE.Vector2(mx, my), camera!);
    return rc;
  }

  function isPointerOverUi(e: MouseEvent): boolean {
    const el = document.elementFromPoint(e.clientX, e.clientY);
    if (!el) return false;
    // Check if pointer is over interactive UI elements
    const uiEl = el.closest('.fx-panel, .search-area, .bottom-bar, .playlist-panel, .stage-lyrics, .modals, .top-right, .gesture-hud, .thumb-wrap, .trial-banner, .status-chips, .overlays, .hidden-inputs, .visual-guide, .hotkey-modal, .empty-home');
    return !!uiEl;
  }

  function raycastCards(rc: THREE.Raycaster): any | null {
    if (!group) return null;
    const meshes = cards.map((c) => c.mesh);
    const intersects = rc.intersectObjects(meshes);
    if (intersects.length > 0) {
      const hit = intersects[0];
      const card = cards.find((c) => c.mesh === hit.object);
      if (card) return card;
    }
    return null;
  }

  function setSelected(idx: number | null) {
    for (const c of cards) {
      c.selected = idx !== null && c.index === idx;
    }
  }

  function clearSelected() {
    for (const c of cards) c.selected = false;
  }

  function step(direction: number) {
    if (!cards.length) return;
    const prevTarget = Math.round(centerTarget);
    centerTarget = Math.max(0, Math.min(cards.length - 1, centerTarget + direction));
    const nextTarget = Math.round(centerTarget);
    if (nextTarget !== prevTarget) {
      // Pulse the target card
      const targetCard = cards.find((c) => c.index === nextTarget);
      if (targetCard) targetCard.fxPulse = 0.55;
    }
  }

  function getCenterIdx(): number {
    return Math.round(centerSmooth);
  }

  // Scroll/wheel handler
  function handleWheel(e: WheelEvent) {
    if (isPointerOverUi(e)) return;
    if (!group || !group.parent) return;
    if (getMode() === "off") return;

    const mode = getMode();
    const rc = raycasterFromPointerEvent(e);
    const cardHit = raycastCards(rc);
    let inShelfArea = false;

    if (mode === "side" && shelf.state.pinnedOpen) {
      inShelfArea = true;
    } else if (mode === "side" && shelfAlwaysVisible()) {
      inShelfArea = !!cardHit;
    } else if (mode === "stage" && cardHit) {
      inShelfArea = true;
    }

    if (inShelfArea) {
      e.preventDefault();
      e.stopImmediatePropagation();
      step(e.deltaY > 0 ? 1 : -1);
    }
  }

  // Click handler
  function handleClick(e: MouseEvent) {
    if (!group || !group.parent) return;
    if (getMode() === "off") return;
    if (isPointerOverUi(e)) return;

    const rc = raycasterFromPointerEvent(e);
    const mode = getMode();
    const hit = raycastCards(rc);

    if (hit) {
      const idx = hit.index;
      if (Math.abs(idx - getCenterIdx()) < 0.5) {
        // Center card clicked → play
        playback.setCurrentIdx(hit.item.queueIndex);
      } else {
        // Non-center card clicked → scroll to it
        step(idx - getCenterIdx());
      }
    }
  }

  // Hover handler
  function handleMouseMove(e: MouseEvent) {
    if (!group || !group.parent) return;
    if (getMode() === "off") return;
    if (isPointerOverUi(e)) { clearSelected(); return; }

    const mode = getMode();
    if (mode === "side" && !shelf.state.pinnedOpen && !shelfAlwaysVisible()) {
      clearSelected();
      return;
    }

    const rc = raycasterFromPointerEvent(e);
    const hit = raycastCards(rc);
    if (hit) {
      setSelected(hit.index);
    } else {
      clearSelected();
    }
  }

  function attachListeners() {
    window.addEventListener("wheel", handleWheel, { passive: false, capture: true });
    window.addEventListener("click", handleClick);
    window.addEventListener("mousemove", handleMouseMove);
  }

  function detachListeners() {
    window.removeEventListener("wheel", handleWheel, { capture: true } as any);
    window.removeEventListener("click", handleClick);
    window.removeEventListener("mousemove", handleMouseMove);
  }

  // Watch for mode changes
  let lastMode = getMode();
  function checkModeChange() {
    const mode = getMode();
    if (mode !== lastMode || (!group && mode !== "off")) {
      lastMode = mode;
      if (mode === "off") {
        dispose();
        detachListeners();
      } else if (scene) {
        ensureGroup(scene);
        rebuild();
        attachListeners();
      }
    }
  }

  return {
    ensureGroup,
    rebuild,
    update,
    dispose,
    checkModeChange,
    raycastCards,
    getCards: () => cards,
    getGroup: () => group,
    setCenterTarget: (idx: number) => { centerTarget = idx; },
    getCenterSmooth: () => centerSmooth,
    getCenterIdx,
    step,
    setSelected,
    clearSelected,
    hasOpenContent: () => false,
    getVisibility: () => shelfVisibility,
    canInteract: () => shelf.state.pinnedOpen || shelfAlwaysVisible(),
  };
}
