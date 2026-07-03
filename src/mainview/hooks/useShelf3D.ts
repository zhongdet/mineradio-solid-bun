// @ts-nocheck
import * as THREE from "three";
import { useFx } from "../stores/fxStore";
import { useShelf } from "../stores/shelfStore";
import { usePlayback } from "../stores/playbackStore";
import { useVisual } from "../stores/visualStore";

const VISIBLE_RADIUS = 5;
const MAX_RENDER = VISIBLE_RADIUS * 2 + 1;
const CARD_W = 2.05;
const CARD_H = 1.025;
const CANVAS_W = 720;
const CANVAS_H = 360;

const coverCache: Record<string, { loaded: boolean; loading: boolean; img: HTMLImageElement | null; failed: boolean }> = {};

function loadCover(url: string): Promise<HTMLImageElement | null> {
  if (!url) return Promise.resolve(null);
  const rec = coverCache[url];
  if (rec?.loaded && rec.img) return Promise.resolve(rec.img);
  if (rec?.loading) return new Promise((res) => { /* wait */ });
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
  accentColor: string
) {
  const { canvas, ctx, texture, item, isCenter } = card;
  const W = canvas.width;
  const H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  const pad = 18;

  // Background
  roundRect(ctx, pad, pad, W - pad * 2, H - pad * 2, 32);
  ctx.fillStyle = "rgba(0,0,0,0.82)";
  ctx.fill();
  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, "rgba(255,255,255,0.10)");
  grad.addColorStop(1, "rgba(255,255,255,0.018)");
  ctx.fillStyle = grad;
  ctx.fill();

  // Border
  const isNow = item.isCurrent;
  ctx.strokeStyle = isNow ? accentColor + "b8" : "rgba(255,255,255,0.14)";
  ctx.lineWidth = isNow ? 1.8 + bass * 1.2 : 1.1;
  ctx.stroke();

  // Cover image
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

  // Tag
  const tx = pad + coverSize + 32;
  ctx.font = "700 17px Inter, Arial";
  ctx.fillStyle = isNow ? accentColor : "rgba(255,255,255,0.92)";
  ctx.fillText(item.tag || "", tx, pad + 36);

  // Title
  ctx.font = "700 30px Inter, Arial";
  ctx.fillStyle = "rgba(255,255,255,0.96)";
  wrapText(ctx, item.title || "", tx, pad + 78, W - tx - pad - 14, 36, 2);

  // Subtitle
  ctx.font = "400 17px Inter, Arial";
  ctx.fillStyle = "rgba(255,255,255,0.52)";
  wrapText(ctx, item.sub || "", tx, pad + 156, W - tx - pad - 14, 24, 2);

  // Accent bar
  ctx.strokeStyle = isNow ? accentColor + "e6" : "rgba(255,255,255,0.30)";
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.moveTo(tx, H - pad - 22);
  ctx.lineTo(tx + Math.min(260, 80 + bass * 320), H - pad - 22);
  ctx.stroke();

  // Center card action hint
  if (isCenter) {
    ctx.font = "600 14px Inter, Arial";
    ctx.fillStyle = accentColor + "d6";
    ctx.fillText("点击播放", tx, H - pad - 50);
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
    floatMix: number;
    drawKey: string;
  }> = [];
  let centerSmooth = 0;
  let centerTarget = 0;
  let lastRebuildTime = 0;
  let lastDrawTime = 0;

  function getMode(): string {
    return fx.state.shelf;
  }

  function rebuild() {
    if (!group) return;

    // Dispose old cards
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
        tag: i === currentIdx ? "正在播放" : `#${i + 1}`,
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

    // DOF blur on distant cards
    const nextDof = Math.max(0, Math.min(1, (absD - 0.45) / 3.2));
    if (Math.abs(nextDof - (card.lastDof || 0)) > 0.12) {
      card.lastDof = nextDof;
      drawCard(card, bass, fx.state.shelfAccentColor);
    }

    // Lift for center card
    const liftTarget = card.isCenter ? 1 : 0;
    const liftRate = liftTarget > card.floatMix ? 0.20 : 0.13;
    card.floatMix += (liftTarget - card.floatMix) * liftRate;
    const lift = card.floatMix;

    if (mode === "side") {
      const sideX = 3.18 + fx.state.shelfOffsetX;
      const sideYStep = 0.68;
      const sideZ = 0.86 + fx.state.shelfOffsetZ;
      const sideZStep = 0.170;
      const sideScale = fx.state.shelfSize;

      const px = sideX + absD * 0.040 + parX * 0.060 * parWeight - lift * 0.145;
      const py = fx.state.shelfOffsetY - delta * sideYStep + lift * 0.105;
      const pz = sideZ - absD * sideZStep + lift * 0.220;
      const scale = (absD < 0.5 ? 1.12 : Math.max(0.55, 1.04 - absD * 0.14)) * (1 + lift * 0.075) * sideScale;

      card.mesh.position.set(px, py, pz);
      card.mesh.rotation.y = fx.state.shelfAngleY * (Math.PI / 180) + parX * 0.038 * parWeight;
      card.mesh.rotation.x = -delta * 0.042 - parY * 0.024 * parWeight;
      card.mesh.scale.setScalar(scale);
    } else {
      // stage mode
      const stageXStep = 1.55;
      const stageY = -2.20 + fx.state.shelfOffsetY;
      const stageZ = 1.0 + fx.state.shelfOffsetZ;
      const stageScale = fx.state.shelfSize;

      const px = fx.state.shelfOffsetX + delta * stageXStep + parX * 0.110 * parWeight;
      const py = stageY + parY * 0.060 * parWeight;
      const pz = (absD < 0.5 ? stageZ : stageZ - Math.min(2.0, absD) * 0.55) + (parY * 0.040 - parX * 0.035) * parWeight;
      const scale = (absD < 0.5 ? 1.20 : Math.max(0.45, 1.0 - absD * 0.22)) * stageScale;

      card.mesh.position.set(px, py, pz);
      card.mesh.rotation.y = -delta * 0.22 + parX * 0.050 * parWeight;
      card.mesh.rotation.x = 0.10 - absD * 0.04 - parY * 0.028 * parWeight;
      card.mesh.scale.setScalar(scale);
    }

    // Opacity
    const opBase = absD < 0.5 ? 1.0 : Math.max(0.22, 1.0 - absD * 0.30);
    card.mesh.material.opacity = opBase * fx.state.shelfOpacity;
  }

  function update(dt: number) {
    if (!group || !scene) return;

    const mode = getMode();
    if (mode === "off") {
      if (group.parent) scene.remove(group);
      return;
    }

    if (!group.parent) scene.add(group);

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

    // Group transform
    if (mode === "side") {
      group.renderOrder = 50;
      group.position.set(0, 0, 0);
      group.rotation.y += (parX * 0.018 - group.rotation.y) * 0.045;
      group.rotation.x += (-parY * 0.010 - group.rotation.x) * 0.045;
      group.rotation.z *= 0.955;
    } else {
      group.renderOrder = 50;
      const t = visual.state.time || 0;
      group.position.y = Math.sin(t * 0.3) * 0.04;
      group.position.x = parX * 0.10;
      group.rotation.y = parX * 0.025;
      group.rotation.x = -parY * 0.012;
    }

    // Place cards
    for (const card of cards) {
      placeCard(card, mode, parX, parY, bass);
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

  // Watch for mode changes
  let lastMode = getMode();
  function checkModeChange() {
    const mode = getMode();
    if (mode !== lastMode) {
      lastMode = mode;
      if (mode === "off") {
        dispose();
      } else if (scene) {
        ensureGroup(scene);
        rebuild();
      }
    }
  }

  // Raycast for click
  function raycastCards(raycaster: THREE.Raycaster): { card: any; point: THREE.Vector3 } | null {
    const meshes = cards.map((c) => c.mesh);
    const intersects = raycaster.intersectObjects(meshes);
    if (intersects.length > 0) {
      const hit = intersects[0];
      const card = cards.find((c) => c.mesh === hit.object);
      if (card) return { card, point: hit.point };
    }
    return null;
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
  };
}
