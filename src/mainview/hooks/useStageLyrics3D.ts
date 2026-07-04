declare const THREE: any;

import { useLyrics } from "../stores/lyricsStore";
import { useFx } from "../stores/fxStore";
import { useVisual } from "../stores/visualStore";
import { useAudio } from "../stores/audioStore";
import { usePlayback } from "../stores/playbackStore";

// ── 3D Stage Lyrics System ──
// Ported from legacy app.js. Creates glowing, shader-driven 3D lyrics
// that float in the Three.js scene, following album art particles or
// camera lock mode.

interface LyricMeshData {
  mask: any;
  textMesh: any;
  readability: any;
  glow: any;
  sparks: any;
  sun: any;
  textMat: any;
  readabilityMat: any;
  glowMat: any;
  sparkMat: any;
  sunMat: any;
  basePositions: Float32Array;
  textWorldW: number;
  textWorldH: number;
  worldW: number;
  worldH: number;
}

interface StageLyricsState {
  group: any;
  current: any;
  outgoing: any[];
  currentIdx: number;
  currentText: string;
  highBloom: number;
  beatGlow: number;
  glowFollowX: number;
  glowFollowY: number;
  glowFollowRoll: number;
  starRiver: any;
  starRiverWidth: number;
  starRiverHeight: number;
  lockFitScale: number;
  snapCameraLockFrames: number;
  palette: {
    primary: string;
    secondary: string;
    highlight: string;
    shadow: string;
    glow: string;
  };
  coverPalette: {
    primary: string;
    secondary: string;
    highlight: string;
    shadow: string;
    glow: string;
  };
}

const STAGE_LYRIC_MAX_LINES = 1;

function clampRange(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function cssColorToThreeColor(css: string, fallback: string): any {
  const c = new THREE.Color(css);
  if (c.getHex() === 0x000000) {
    return new THREE.Color(fallback);
  }
  return c;
}

function lyricThreeColor(css: string, fallback: string, minLum: number = 0.34): any {
  const c = cssColorToThreeColor(css, fallback);
  const lum = c.r * 0.299 + c.g * 0.587 + c.b * 0.114;
  if (lum < minLum) {
    const lift = minLum - lum;
    c.r = Math.min(1, c.r + lift);
    c.g = Math.min(1, c.g + lift);
    c.b = Math.min(1, c.b + lift);
  }
  return c;
}

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
  }
  return { h, s, l };
}

function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  function hue2rgb(p: number, q: number, t: number): number {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  }
  let r: number, g: number, b2: number;
  if (s === 0) { r = g = b2 = l; }
  else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b2 = hue2rgb(p, q, h - 1 / 3);
  }
  return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b2 * 255) };
}

function rgbCss(c: { r: number; g: number; b: number }, a?: number): string {
  if (a == null) return `rgb(${c.r},${c.g},${c.b})`;
  return `rgba(${c.r},${c.g},${c.b},${a})`;
}

function _hexToRgb(hex: string): { r: number; g: number; b: number } {
  hex = hex.replace(/^#/, "");
  if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  return {
    r: parseInt(hex.slice(0, 2), 16),
    g: parseInt(hex.slice(2, 4), 16),
    b: parseInt(hex.slice(4, 6), 16),
  };
}

function silverBlueLyricPalette() {
  return {
    primary: "#d8f1ff",
    secondary: "#9db8cf",
    highlight: "#eef7ff",
    shadow: "rgba(0,7,12,0.48)",
    glow: "rgba(138,190,255,0.26)",
  };
}

function lyricTextPaletteFromHsl(hsl: { h: number; s: number; l: number }, avgL: number, chroma: number) {
  if (avgL < 0.16 || chroma < 0.08) return silverBlueLyricPalette();
  const hue = hsl.h;
  if (avgL < 0.30 && (hue < 0.06 || hue > 0.86 || (hue > 0.75 && hue < 0.86))) return silverBlueLyricPalette();
  if (avgL > 0.82 && chroma < 0.12) {
    return {
      primary: "#064b5b",
      secondary: "#168c88",
      highlight: "#315f68",
      shadow: "rgba(255,255,255,0.48)",
      glow: "rgba(143,233,255,0.14)",
    };
  }
  const lightText = avgL < 0.52;
  const s = Math.max(0.42, Math.min(0.78, hsl.s + 0.16));
  const c1 = hslToRgb(hsl.h, s, lightText ? 0.74 : 0.34);
  const c2 = hslToRgb((hsl.h + 0.08) % 1, Math.max(0.36, s - 0.10), lightText ? 0.62 : 0.46);
  return {
    primary: rgbCss(c1),
    secondary: rgbCss(c2),
    highlight: rgbCss(hslToRgb((hsl.h + 0.03) % 1, Math.max(0.28, s - 0.18), lightText ? 0.86 : 0.58)),
    shadow: lightText ? "rgba(0,6,10,0.44)" : "rgba(248,253,255,0.40)",
    glow: rgbCss(c1, lightText ? 0.24 : 0.14),
  };
}

function setStageLyricPalette(pal: any) {
  state.palette = {
    primary: pal.primary || "#d6f8ff",
    secondary: pal.secondary || "#9cffdf",
    highlight: pal.highlight || "#eef7ff",
    shadow: pal.shadow || "rgba(2,8,12,0.42)",
    glow: pal.glow || "rgba(143,233,255,0.34)",
  };
  // Update existing mesh materials
  applyLyricPaletteToMesh(state.current);
  if (state.outgoing) state.outgoing.forEach(applyLyricPaletteToMesh);
}

function applyLyricPaletteToMesh(mesh: any) {
  if (!mesh || !mesh.userData?.lyric) return;
  const pal = state.palette;
  const data = mesh.userData.lyric;
  if (data.textMat?.uniforms) {
    const u = data.textMat.uniforms;
    if (u.uBaseColor) u.uBaseColor.value.copy(lyricThreeColor(pal.primary, "#d6f8ff", 0.38));
    if (u.uHiColor) u.uHiColor.value.copy(lyricThreeColor(pal.highlight || pal.primary, "#fff0b8", 0.48));
    if (u.uGlowColor) u.uGlowColor.value.copy(lyricThreeColor(pal.glow || pal.secondary || pal.primary, "#9cffdf", 0.36));
    if (u.uSolarColor) u.uSolarColor.value.copy(lyricThreeColor(pal.highlight || pal.secondary || pal.primary, "#fff0b8", 0.50));
    data.textMat.needsUpdate = true;
  }
  if (data.glowMat) data.glowMat.color.copy(lyricThreeColor(pal.glow || pal.secondary || pal.primary, "#9cffdf", 0.36));
  if (data.sunMat) data.sunMat.color.copy(lyricThreeColor(pal.highlight || pal.secondary || pal.primary, "#fff0b8", 0.50));
}

export function updateLyricPaletteFromCover(coverCanvas: HTMLCanvasElement) {
  if (!coverCanvas) return;
  try {
    const ctx = coverCanvas.getContext("2d");
    if (!ctx) return;
    const img = ctx.getImageData(0, 0, coverCanvas.width, coverCanvas.height).data;
    const w = coverCanvas.width;
    let sumR = 0, sumG = 0, sumB = 0, count = 0;
    let best = { score: -1, r: 143, g: 233, b: 255 };
    for (let y = 0; y < coverCanvas.height; y += 8) {
      for (let x = 0; x < w; x += 8) {
        const di = (y * w + x) * 4;
        const r = img[di], g = img[di + 1], b = img[di + 2], a = img[di + 3] / 255;
        if (a < 0.5) continue;
        const lum = (r * 0.299 + g * 0.587 + b * 0.114) / 255;
        const maxC = Math.max(r, g, b), minC = Math.min(r, g, b);
        const chroma = (maxC - minC) / 255;
        const edgePenalty = Math.abs(lum - 0.5);
        const score = chroma * 1.6 + (0.5 - edgePenalty) * 0.45;
        sumR += r; sumG += g; sumB += b; count++;
        if (lum > 0.08 && lum < 0.92 && score > best.score) best = { score, r, g, b };
      }
    }
    if (!count) return;
    const avgL = ((sumR / count) * 0.299 + (sumG / count) * 0.587 + (sumB / count) * 0.114) / 255;
    const hsl = rgbToHsl(best.r, best.g, best.b);
    const palette = lyricTextPaletteFromHsl(hsl, avgL, Math.max(0, best.score));
    state.coverPalette = palette;
    setStageLyricPalette(palette);
  } catch { /* ignore */ }
}

let dotTexture: any = null;
function getDotTexture(): any {
  if (!dotTexture) {
    const cv = document.createElement("canvas");
    cv.width = cv.height = 64;
    const ctx = cv.getContext("2d")!;
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 31);
    g.addColorStop(0.0, "rgba(255,255,255,0.96)");
    g.addColorStop(0.42, "rgba(255,255,255,0.78)");
    g.addColorStop(0.72, "rgba(255,255,255,0.22)");
    g.addColorStop(1.0, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    dotTexture = new THREE.CanvasTexture(cv);
    dotTexture.minFilter = THREE.LinearFilter;
    dotTexture.magFilter = THREE.LinearFilter;
  }
  return dotTexture;
}

let lyricSunBloomTexture: any = null;
function getLyricSunBloomTexture(): any {
  if (lyricSunBloomTexture) return lyricSunBloomTexture;
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const cx = canvas.width * 0.5;
  const cy = canvas.height * 0.5;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(2.05, 1);
  const radial = ctx.createRadialGradient(0, 0, 0, 0, 0, canvas.height * 0.43);
  radial.addColorStop(0.0, "rgba(255,246,186,0.92)");
  radial.addColorStop(0.18, "rgba(255,219,126,0.44)");
  radial.addColorStop(0.46, "rgba(255,186,82,0.15)");
  radial.addColorStop(1.0, "rgba(255,186,82,0)");
  ctx.fillStyle = radial;
  ctx.fillRect(-canvas.width, -canvas.height, canvas.width * 2, canvas.height * 2);
  ctx.restore();
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.filter = "blur(34px)";
  ctx.fillStyle = "rgba(255,235,168,0.18)";
  ctx.beginPath();
  ctx.ellipse(cx, cy, canvas.width * 0.33, canvas.height * 0.14, -0.06, 0, Math.PI * 2);
  ctx.fill();
  ctx.filter = "blur(58px)";
  ctx.fillStyle = "rgba(255,214,122,0.11)";
  ctx.beginPath();
  ctx.ellipse(cx, cy, canvas.width * 0.45, canvas.height * 0.19, -0.05, 0, Math.PI * 2);
  ctx.fill();
  ctx.filter = "blur(18px)";
  const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, canvas.width * 0.16);
  core.addColorStop(0.0, "rgba(255,252,220,0.38)");
  core.addColorStop(0.34, "rgba(255,230,158,0.20)");
  core.addColorStop(1.0, "rgba(255,210,116,0)");
  ctx.fillStyle = core;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.restore();
  ctx.save();
  ctx.globalCompositeOperation = "destination-in";
  const xMask = ctx.createLinearGradient(0, 0, canvas.width, 0);
  xMask.addColorStop(0.0, "rgba(255,255,255,0)");
  xMask.addColorStop(0.11, "rgba(255,255,255,1)");
  xMask.addColorStop(0.89, "rgba(255,255,255,1)");
  xMask.addColorStop(1.0, "rgba(255,255,255,0)");
  ctx.fillStyle = xMask;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const yMask = ctx.createLinearGradient(0, 0, 0, canvas.height);
  yMask.addColorStop(0.0, "rgba(255,255,255,0)");
  yMask.addColorStop(0.18, "rgba(255,255,255,1)");
  yMask.addColorStop(0.82, "rgba(255,255,255,1)");
  yMask.addColorStop(1.0, "rgba(255,255,255,0)");
  ctx.fillStyle = yMask;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.restore();
  lyricSunBloomTexture = new THREE.CanvasTexture(canvas);
  lyricSunBloomTexture.minFilter = THREE.LinearFilter;
  lyricSunBloomTexture.magFilter = THREE.LinearFilter;
  lyricSunBloomTexture.generateMipmaps = false;
  return lyricSunBloomTexture;
}

function lyricFontCss(fontSize: number, font: string, weight: number): string {
  const stacks: Record<string, string> = {
    hei: 'system-ui, -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif',
    song: '"SimSun", "Noto Serif CJK SC", serif',
    kaiti: '"KaiTi", "STKaiti", serif',
    "stone-song": '"SimSun", "Noto Serif CJK SC", serif',
  };
  const stack = stacks[font] || stacks.hei;
  return `${weight} ${fontSize}px ${stack}`;
}

function lyricLineHeightFactor(_fx?: any): number {
  return clampRange(Number(getFx()?.state?.lyricLineHeight) || 1, 0.86, 1.35);
}

function lyricMeasureText(ctx: CanvasRenderingContext2D, text: string, fontSize: number, letterSpacing: number): number {
  ctx.font = lyricFontCss(fontSize, getFx()?.state?.lyricFont || "hei", getFx()?.state?.lyricWeight || 900);
  const m = ctx.measureText(text);
  return m.width + (text.length - 1) * letterSpacing;
}

function lyricFontWeightValue(_fx?: any): number {
  return clampRange(Number(getFx()?.state?.lyricWeight) || 900, 100, 900);
}

function lyricLetterSpacingPx(_fontSize: number, letterSpacing: number): number {
  return letterSpacing;
}

function drawTextWithLetterSpacing(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  letterSpacing: number,
  stroke: boolean,
) {
  if (letterSpacing === 0) {
    if (stroke) ctx.strokeText(text, x, y);
    else ctx.fillText(text, x, y);
    return;
  }
  const chars = text.split("");
  let curX = x;
  for (const ch of chars) {
    if (stroke) ctx.strokeText(ch, curX, y);
    else ctx.fillText(ch, curX, y);
    const m = ctx.measureText(ch);
    curX += m.width + letterSpacing;
  }
}

function lyricFillText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, fontSize: number) {
  drawTextWithLetterSpacing(ctx, text, x, y, lyricLetterSpacingPx(fontSize, getFx()?.state?.lyricLetterSpacing || 0), false);
}

function lyricStrokeText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, fontSize: number) {
  drawTextWithLetterSpacing(ctx, text, x, y, lyricLetterSpacingPx(fontSize, getFx()?.state?.lyricLetterSpacing || 0), true);
}

function wrapLyricText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number, fontSize: number): string[] {
  text = String(text || "").trim();
  const useWords = /\s/.test(text) && /[A-Za-z0-9]/.test(text);
  const units = useWords ? text.split(/(\s+)/).filter(Boolean) : text.split("");
  const lines: string[] = [];
  let line = "";
  for (let i = 0; i < units.length; i++) {
    const test = line + units[i];
    if (lyricMeasureText(ctx, test, fontSize, getFx()?.state?.lyricLetterSpacing || 0) > maxWidth && line) {
      lines.push(line.trim());
      line = units[i].trimStart() ?? units[i].replace(/^\s+/, "");
      if (lines.length >= maxLines) {
        const rest = units.slice(i).join("").trim();
        if (rest) lines[lines.length - 1] = lines[lines.length - 1].replace(/[.。,…，、\s]*$/, "") + "...";
        return lines;
      }
    } else {
      line = test;
    }
  }
  if (line && lines.length < maxLines) lines.push(line.trim());
  return lines.length ? lines : [""];
}

function applyStonePrintTexture(ctx: CanvasRenderingContext2D, W: number, H: number, _fontSize: number) {
  const font = getFx()?.state?.lyricFont || "hei";
  if (font !== "stone-song") return;
  const bandTop = H * 0.1;
  const bandH = H * 0.8;
  ctx.save();
  ctx.globalCompositeOperation = "destination-out";
  const noiseW = 300, noiseH = 110;
  const noise = document.createElement("canvas");
  noise.width = noiseW;
  noise.height = noiseH;
  const nctx = noise.getContext("2d")!;
  const img = nctx.createImageData(noiseW, noiseH);
  for (let p = 0; p < noiseW * noiseH; p++) {
    const x0 = p % noiseW;
    const y0 = Math.floor(p / noiseW);
    const vein = Math.sin(x0 * 0.19 + y0 * 0.043) * 0.1 + Math.sin(y0 * 0.31) * 0.06;
    const r = Math.random() + vein;
    let a = 0;
    if (r > 0.82) a = 78 + Math.random() * 92;
    else if (r > 0.62) a = 22 + Math.random() * 54;
    else if (r > 0.48) a = 4 + Math.random() * 24;
    img.data[p * 4] = 255;
    img.data[p * 4 + 1] = 255;
    img.data[p * 4 + 2] = 255;
    img.data[p * 4 + 3] = a;
  }
  nctx.putImageData(img, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.globalAlpha = 0.34;
  ctx.drawImage(noise, 0, bandTop, W, bandH);
  ctx.restore();
}

// ── Lyric Mask Generation ──

function makeLyricMask(text: string): any {
  const canvas = document.createElement("canvas");
  const W = 2048, H = 384;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  const maxWidth = W - 190;
  const maxLines = STAGE_LYRIC_MAX_LINES;
  const letterSpacing = getFx()?.state?.lyricLetterSpacing || 0;

  text = String(text || "").replace(/\s+/g, " ").trim();
  const fontSize = 128;
  let widest = 1;
  let finalFontSize = fontSize;
  let fitScaleX = 1;

  // Auto-scale font to fit
  for (let fs = 128; fs >= 42; fs -= 4) {
    ctx.font = lyricFontCss(fs, getFx()?.state?.lyricFont || "hei", lyricFontWeightValue());
    const measured = lyricMeasureText(ctx, text, fs, letterSpacing);
    if (measured <= maxWidth) {
      finalFontSize = fs;
      break;
    }
  }

  // Wrap if needed
  let actualLines: string[];
  ctx.font = lyricFontCss(finalFontSize, getFx()?.state?.lyricFont || "hei", lyricFontWeightValue());
  const wrapped = wrapLyricText(ctx, text, maxWidth, maxLines, finalFontSize);
  actualLines = wrapped;

  widest = 0;
  for (let i = 0; i < actualLines.length; i++) {
    const w = lyricMeasureText(ctx, actualLines[i], finalFontSize, letterSpacing);
    widest = Math.max(widest, w);
  }
  if (widest <= maxWidth) {
    fitScaleX = 1;
  } else {
    fitScaleX = Math.max(0.68, maxWidth / widest);
  }

  const finalWidth = Math.min(maxWidth, widest * fitScaleX);
  const lhFactor = lyricLineHeightFactor();
  const lineHeight = finalFontSize * (actualLines.length > 1 ? 1.02 : 1.0) * lhFactor;
  const blockH = finalFontSize + (actualLines.length - 1) * lineHeight;
  const x = W / 2;
  const y0 = H / 2 - blockH / 2 + finalFontSize * 0.82;

  ctx.clearRect(0, 0, W, H);
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#fff";

  for (let di = 0; di < actualLines.length; di++) {
    if (fitScaleX < 1) {
      ctx.save();
      ctx.translate(x, 0);
      ctx.scale(fitScaleX, 1);
      lyricFillText(ctx, actualLines[di], 0, y0 + di * lineHeight, finalFontSize);
      ctx.restore();
    } else {
      lyricFillText(ctx, actualLines[di], x, y0 + di * lineHeight, finalFontSize);
    }
  }

  applyStonePrintTexture(ctx, W, H, finalFontSize);

  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.anisotropy = Math.min(8, (renderer?.capabilities?.getMaxAnisotropy() ?? 1));

  const textMin = (W / 2 - finalWidth / 2) / W;
  const textMax = (W / 2 + finalWidth / 2) / W;

  return {
    texture: tex,
    width: W,
    height: H,
    textWidth: finalWidth,
    textHeight: blockH,
    fontSize: finalFontSize,
    lineHeight,
    lineCount: actualLines.length,
    lines: actualLines,
    fitScaleX,
    textMin,
    textMax,
  };
}

// ── Readability Texture ──

function makeLyricReadabilityTexture(mask: any): any {
  const canvas = document.createElement("canvas");
  const W = mask.width || 2048;
  const H = mask.height || 384;
  const fontSize = mask.fontSize || 128;
  const lines = Array.isArray(mask.lines) && mask.lines.length ? mask.lines : [""];
  const lh = mask.lineHeight || fontSize * lyricLineHeightFactor();
  const fitScaleX = mask.fitScaleX || 1;

  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, W, H);
  ctx.font = lyricFontCss(fontSize, getFx()?.state?.lyricFont || "hei", lyricFontWeightValue());
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.miterLimit = 2;

  const blockH = fontSize + (lines.length - 1) * lh;
  const y0 = H / 2 - blockH / 2 + fontSize * 0.82;

  function strokeLines(dx: number, dy: number) {
    for (let i = 0; i < lines.length; i++) {
      const y = y0 + i * lh + (dy || 0);
      if (fitScaleX < 1) {
        ctx.save();
        ctx.translate(W / 2 + (dx || 0), 0);
        ctx.scale(fitScaleX, 1);
        lyricStrokeText(ctx, lines[i], 0, y, fontSize);
        ctx.restore();
      } else {
        lyricStrokeText(ctx, lines[i], W / 2 + (dx || 0), y, fontSize);
      }
    }
  }

  // Black/white readability layer
  ctx.save();
  ctx.filter = "blur(14px)";
  ctx.globalAlpha = 0.18;
  ctx.lineWidth = Math.max(18, fontSize * 0.16);
  ctx.strokeStyle = "rgba(0,0,0,1)";
  strokeLines(0, fontSize * 0.018);
  ctx.restore();

  ctx.save();
  ctx.filter = "blur(5px)";
  ctx.globalAlpha = 0.32;
  ctx.lineWidth = Math.max(9, fontSize * 0.075);
  ctx.strokeStyle = "rgba(0,0,0,1)";
  strokeLines(0, fontSize * 0.012);
  ctx.restore();

  ctx.save();
  ctx.filter = "blur(4px)";
  ctx.globalAlpha = 0.15;
  ctx.lineWidth = Math.max(9, fontSize * 0.07);
  ctx.strokeStyle = "rgba(255,255,255,1)";
  strokeLines(0, 0);
  ctx.restore();

  ctx.save();
  ctx.filter = "blur(1.2px)";
  ctx.globalAlpha = 0.26;
  ctx.lineWidth = Math.max(3.2, fontSize * 0.03);
  ctx.strokeStyle = "rgba(255,255,255,1)";
  strokeLines(0, 0);
  ctx.restore();

  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.anisotropy = Math.min(8, (renderer?.capabilities?.getMaxAnisotropy() ?? 1));
  return tex;
}

// ── Glow Texture ──

function makeLyricGlowTexture(text: string, fontSize: number, textWidth: number, lines: string[], lineHeight: number, fitScaleX: number): any {
  text = String(text || "").replace(/\s+/g, " ").trim();
  const drawLines = Array.isArray(lines) && lines.length ? lines : [text];
  const canvas = document.createElement("canvas");
  const measureCanvas = document.createElement("canvas");
  const measureCtx = measureCanvas.getContext("2d")!;
  measureCtx.font = lyricFontCss(fontSize, getFx()?.state?.lyricFont || "hei", lyricFontWeightValue());
  fitScaleX = fitScaleX || 1;
  let measuredWidth = Math.max(1, textWidth || lyricMeasureText(measureCtx, text, fontSize, getFx()?.state?.lyricLetterSpacing || 0) * fitScaleX);
  for (const dl of drawLines) measuredWidth = Math.max(measuredWidth, lyricMeasureText(measureCtx, dl, fontSize, getFx()?.state?.lyricLetterSpacing || 0) * fitScaleX);
  const padX = Math.max(160, fontSize * 1.45);
  const padY = Math.max(86, fontSize * 0.78);
  const lh = lineHeight || fontSize * 1.04;
  const blockH = fontSize + (drawLines.length - 1) * lh;
  const W = Math.ceil(measuredWidth + padX * 2);
  const H = Math.ceil(blockH + padY * 2);

  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, W, H);
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.font = lyricFontCss(fontSize, getFx()?.state?.lyricFont || "hei", lyricFontWeightValue());
  const y0 = H / 2 - blockH / 2 + fontSize * 0.82;

  function drawGlowText(dx: number, dy: number) {
    for (let i = 0; i < drawLines.length; i++) {
      const y = y0 + i * lh + (dy || 0);
      if (fitScaleX < 1) {
        ctx.save();
        ctx.translate(W / 2 + (dx || 0), 0);
        ctx.scale(fitScaleX, 1);
        lyricFillText(ctx, drawLines[i], 0, y, fontSize);
        ctx.restore();
      } else {
        lyricFillText(ctx, drawLines[i], W / 2 + (dx || 0), y, fontSize);
      }
    }
  }

  // Multi-layered glow
  ctx.save();
  ctx.filter = "blur(14px)";
  ctx.globalAlpha = 0.46;
  ctx.fillStyle = "#fff";
  drawGlowText(0, 0);
  ctx.restore();

  ctx.save();
  ctx.filter = "blur(34px)";
  ctx.globalAlpha = 0.34;
  ctx.fillStyle = "#fff";
  drawGlowText(0, 0);
  ctx.restore();

  ctx.save();
  ctx.filter = "blur(78px)";
  ctx.globalAlpha = 0.22;
  ctx.fillStyle = "#fff";
  drawGlowText(0, 0);
  ctx.restore();

  ctx.save();
  ctx.filter = "blur(116px)";
  ctx.globalAlpha = 0.13;
  ctx.fillStyle = "#fff";
  drawGlowText(0, 0);
  ctx.restore();

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.filter = "blur(8px)";
  ctx.globalAlpha = 0.26;
  ctx.fillStyle = "#fff";
  for (let ri = 0; ri < 8; ri++) {
    const ang = (ri / 8) * Math.PI * 2;
    drawGlowText(Math.cos(ang) * 7, Math.sin(ang) * 4);
  }
  ctx.restore();

  ctx.save();
  ctx.globalCompositeOperation = "destination-in";
  const xMask = ctx.createLinearGradient(0, 0, W, 0);
  xMask.addColorStop(0, "rgba(255,255,255,0)");
  xMask.addColorStop(0.1, "rgba(255,255,255,1)");
  xMask.addColorStop(0.9, "rgba(255,255,255,1)");
  xMask.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = xMask;
  ctx.fillRect(0, 0, W, H);
  const yMask = ctx.createLinearGradient(0, 0, 0, H);
  yMask.addColorStop(0, "rgba(255,255,255,0)");
  yMask.addColorStop(0.16, "rgba(255,255,255,1)");
  yMask.addColorStop(0.84, "rgba(255,255,255,1)");
  yMask.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = yMask;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();

  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  (tex as any).userData = { width: W, height: H, textWidth: measuredWidth };
  return tex;
}

// ── Shader Materials ──

function makeLyricShaderMaterial(mask: any, pal: any): any {
  const hasNativeKaraoke = getLyrics()?.state?.hasNativeKaraoke ?? false;
  return new THREE.ShaderMaterial({
    uniforms: {
      uMap: { value: mask.texture },
      uProgress: { value: 0 },
      uTextMin: { value: mask.textMin },
      uTextMax: { value: mask.textMax },
      uOpacity: { value: 0 },
      uBaseColor: { value: lyricThreeColor(pal.primary, "#d6f8ff", 0.38) },
      uHiColor: { value: lyricThreeColor(pal.highlight || pal.primary, "#fff0b8", 0.48) },
      uGlowColor: { value: lyricThreeColor(pal.secondary, "#9cffdf", 0.36) },
      uSolarColor: { value: lyricThreeColor(pal.highlight || pal.secondary || pal.primary, "#fff0b8", 0.50) },
      uFeather: { value: hasNativeKaraoke ? 0.030 : 0.055 },
      uSolar: { value: 0 },
    },
    vertexShader: `varying vec2 vUv;
      void main(){
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: [
      "precision highp float;",
      "uniform sampler2D uMap;",
      "uniform float uProgress,uTextMin,uTextMax,uOpacity,uFeather,uSolar;",
      "uniform vec3 uBaseColor,uHiColor,uGlowColor,uSolarColor;",
      "varying vec2 vUv;",
      "void main(){",
      "  vec2 uv = gl_FrontFacing ? vUv : vec2(1.0 - vUv.x, vUv.y);",
      "  float mask = texture2D(uMap, uv).a;",
      "  if(mask < 0.01) discard;",
      "  float denom = max(0.001, uTextMax - uTextMin);",
      "  float p = clamp((uv.x - uTextMin) / denom, 0.0, 1.0);",
      "  float filled = 1.0 - smoothstep(uProgress, uProgress + uFeather, p);",
      "  float edge = 1.0 - smoothstep(0.0, uFeather * 2.8, abs(p - uProgress));",
      "  vec3 color = mix(uBaseColor, uHiColor, filled * 0.88);",
      "  color += uGlowColor * edge * 0.14;",
      "  vec3 solar = uSolarColor;",
      "  color = mix(color, color + solar * 0.34, uSolar * (0.25 + filled * 0.45));",
      "  color += solar * edge * uSolar * 0.22;",
      "  float lum = dot(color, vec3(0.299, 0.587, 0.114));",
      "  color += vec3(max(0.0, 0.30 - lum));",
      "  gl_FragColor = vec4(color, mask * uOpacity);",
      "}",
    ].join("\n"),
    transparent: true,
    depthWrite: false,
    depthTest: false,
    side: THREE.DoubleSide,
  });
}

// ── Star River ──

function ensureLyricStarRiver() {
  if (!state.group || state.starRiver) return state.starRiver;
  const count = 420;
  const geo = new THREE.BufferGeometry();
  const seeds = new Float32Array(count);
  const lanes = new Float32Array(count);
  const depths = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    seeds[i] = Math.random() * 1000;
    lanes[i] = Math.random();
    depths[i] = Math.random();
  }
  geo.setAttribute("seed", new THREE.BufferAttribute(seeds, 1));
  geo.setAttribute("lane", new THREE.BufferAttribute(lanes, 1));
  geo.setAttribute("depthSeed", new THREE.BufferAttribute(depths, 1));

  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uMap: { value: getDotTexture() },
      uTime: { value: 0 },
      uPixel: { value: renderer?.getPixelRatio() ?? 1 },
      uBass: { value: 0 },
      uBeat: { value: 0 },
      uWidth: { value: state.starRiverWidth || 4.2 },
      uHeight: { value: state.starRiverHeight || 0.58 },
      uOpacity: { value: 0 },
      uColorA: { value: lyricThreeColor(state.palette.secondary, "#9cffdf", 0.42) },
      uColorB: { value: lyricThreeColor(state.palette.highlight, "#fff7d2", 0.44) },
    },
    vertexShader: [
      "precision highp float;",
      "attribute float seed,lane,depthSeed;",
      "uniform float uTime,uPixel,uBass,uBeat,uWidth,uHeight;",
      "varying float vSeed,vLane,vGlow;",
      "float hash(float n){return fract(sin(n)*43758.5453123);}",
      "void main(){",
      "  float laneBand = floor(lane * 5.0);",
      "  float laneLocal = fract(lane * 5.0);",
      "  float speed = 0.030 + hash(seed * 1.71) * 0.055 + laneBand * 0.005;",
      "  float flow = fract(hash(seed * 2.13) + uTime * speed);",
      "  float x = (flow - 0.5) * uWidth * (1.08 + hash(seed * 5.1) * 0.18);",
      "  float curve = sin(flow * 6.2831853 * (0.92 + hash(seed * 4.0) * 0.46) + seed * 0.071 + uTime * 0.34);",
      "  float breath = sin(uTime * (0.42 + hash(seed * 6.9) * 0.42) + seed * 0.093);",
      "  float y = (laneBand - 2.0) * uHeight * 0.135 + curve * uHeight * (0.20 + hash(seed * 9.0) * 0.18) + (laneLocal - 0.5) * uHeight * 0.16 + breath * uHeight * 0.10;",
      "  float z = -0.08 + (depthSeed - 0.5) * 0.44 + sin(uTime * (0.18 + hash(seed) * 0.24) + seed) * 0.08;",
      "  vec3 pos = vec3(x, y, z);",
      "  float edge = smoothstep(0.0, 0.18, flow) * (1.0 - smoothstep(0.82, 1.0, flow));",
      "  vSeed = seed;",
      "  vLane = lane;",
      "  vGlow = edge * (0.62 + 0.38 * sin(uTime * (0.9 + hash(seed * 8.0) * 0.7) + seed));",
      "  vec4 mv = modelViewMatrix * vec4(pos, 1.0);",
      "  float dist = max(0.45, -mv.z);",
      "  float size = (0.030 + hash(seed * 12.0) * 0.040 + vGlow * 0.024 + uBeat * 0.010) * (1.0 + uBass * 0.18);",
      "  gl_PointSize = clamp(size * uPixel * 120.0 / dist, 1.0, 7.2);",
      "  gl_Position = projectionMatrix * mv;",
      "}",
    ].join("\n"),
    fragmentShader: [
      "precision highp float;",
      "uniform sampler2D uMap;",
      "uniform vec3 uColorA,uColorB;",
      "uniform float uOpacity,uTime,uBeat;",
      "varying float vSeed,vLane,vGlow;",
      "void main(){",
      "  vec4 tex = texture2D(uMap, gl_PointCoord);",
      "  if(tex.a < 0.02) discard;",
      "  float tw = pow(0.5 + 0.5 * sin(uTime * (0.55 + fract(vSeed) * 0.35) + vSeed), 4.0);",
      "  vec3 col = mix(uColorA, uColorB, smoothstep(0.12, 0.92, vLane) * 0.45 + tw * 0.42 + vGlow * 0.26);",
      "  float alpha = tex.a * uOpacity * (0.20 + vGlow * 0.78 + tw * 0.32 + uBeat * 0.10);",
      "  gl_FragColor = vec4(col * (0.82 + vGlow * 0.72 + tw * 0.32), alpha);",
      "}",
    ].join("\n"),
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
  });

  const points = new THREE.Points(geo, mat);
  points.renderOrder = 45;
  points.frustumCulled = false;
  points.position.set(0, 0.2, 1.53);
  state.group.add(points);
  state.starRiver = points;
  return points;
}

// ── Build Lyric Mesh ──

function buildLyricMesh(text: string): any {
  text = String(text || "").replace(/\s+/g, " ").trim();
  const mask = makeLyricMask(text);
  const pal = state.palette;
  const worldW = 6.1;
  const worldH = worldW * (mask.height / mask.width);
  const geo = new THREE.PlaneGeometry(worldW, worldH, 1, 1);
  const textWorldW = worldW * (mask.textWidth / mask.width);
  const textWorldH = worldH * ((mask.textHeight || mask.fontSize) / mask.height);

  const group = new THREE.Group();
  group.renderOrder = 42;
  group.position.set((Math.random() - 0.5) * 0.08, 0.2, 1.46);
  group.scale.setScalar(0.96);
  group.userData.age = 0;
  group.userData.state = "in";
  group.userData.lastLyricProgress = -1;
  group.userData.floatSeed = Math.random() * 100;

  // Sun bloom
  const sunMat = new THREE.MeshBasicMaterial({
    map: getLyricSunBloomTexture(),
    transparent: true,
    opacity: 0,
    depthWrite: false,
    depthTest: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    color: lyricThreeColor(pal.highlight || pal.secondary || pal.primary, "#ffe7a6", 0.5),
  });
  const sunWorldW = Math.max(textWorldW + worldH * 1.1, textWorldW * 1.18);
  const sunWorldWClamped = Math.min(worldW * 1.16, Math.max(worldH * 1.35, sunWorldW));
  const sunWorldH = Math.max(worldH * 1.02, Math.min(worldH * 1.54, worldH + textWorldW * 0.07));
  const sun = new THREE.Mesh(new THREE.PlaneGeometry(sunWorldWClamped, sunWorldH, 1, 1), sunMat);
  sun.renderOrder = 40;
  sun.position.set(0, 0.02, -0.03);
  sun.scale.set(0.78, 0.58, 1);
  group.add(sun);

  // Glow
  const glowTex = makeLyricGlowTexture(text, mask.fontSize, mask.textWidth, mask.lines, mask.lineHeight, mask.fitScaleX);
  const glowMeta = (glowTex as any).userData || {};
  const glowMat = new THREE.MeshBasicMaterial({
    map: glowTex,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    depthTest: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    color: lyricThreeColor(pal.secondary, "#9cffdf", 0.36),
  });
  const glowWorldW = textWorldW * ((glowMeta.width || mask.width) / Math.max(1, glowMeta.textWidth || mask.textWidth));
  const glowWorldWClamped = Math.min(worldW * 1.1, Math.max(textWorldW + worldH * 0.38, glowWorldW));
  const glowWorldH = worldH * ((glowMeta.height || mask.height) / mask.height);
  const glowWorldHClamped = Math.min(worldH * 1.42, Math.max(worldH * 0.92, glowWorldH));
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(glowWorldWClamped, glowWorldHClamped, 1, 1), glowMat);
  glow.renderOrder = 41;
  glow.scale.set(1.0, 1.06, 1);
  group.add(glow);

  // Readability
  const readabilityTex = makeLyricReadabilityTexture(mask);
  const readabilityMat = new THREE.MeshBasicMaterial({
    map: readabilityTex,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    depthTest: false,
    side: THREE.DoubleSide,
  });
  const readability = new THREE.Mesh(new THREE.PlaneGeometry(worldW, worldH, 1, 1), readabilityMat);
  readability.renderOrder = 42;
  readability.position.set(0, 0, -0.012);
  group.add(readability);

  // Text mesh with shader
  const textMat = makeLyricShaderMaterial(mask, pal);
  const textMesh = new THREE.Mesh(geo, textMat);
  textMesh.renderOrder = 43;
  group.add(textMesh);

  // Spark particles
  const sparkCount = 132;
  const pgeo = new THREE.BufferGeometry();
  const ppos = new Float32Array(sparkCount * 3);
  const pseed = new Float32Array(sparkCount);
  for (let i = 0; i < sparkCount; i++) {
    const angle = Math.random() * Math.PI * 2;
    const ring = 0.78 + Math.pow(Math.random(), 1.45) * 0.58;
    const rx = textWorldW * (0.5 + Math.random() * 0.22) + 0.1;
    const ry = worldH * (0.42 + Math.random() * 0.22) + 0.08;
    ppos[i * 3] = Math.cos(angle) * rx * ring + (Math.random() - 0.5) * textWorldW * 0.12;
    ppos[i * 3 + 1] = Math.sin(angle) * ry * ring + (Math.random() - 0.5) * worldH * 0.14;
    ppos[i * 3 + 2] = (Math.random() - 0.5) * 0.24;
    pseed[i] = Math.random() * 1000;
  }
  pgeo.setAttribute("position", new THREE.BufferAttribute(ppos, 3));
  pgeo.setAttribute("seed", new THREE.BufferAttribute(pseed, 1));
  const pmat = new THREE.ShaderMaterial({
    uniforms: {
      uMap: { value: getDotTexture() },
      uSize: { value: 0.052 },
      uOpacity: { value: 0 },
      uColor: { value: lyricThreeColor(pal.highlight || pal.secondary || pal.primary, "#fff7d2", 0.30) },
      uPixel: { value: renderer?.getPixelRatio() ?? 1 },
    },
    vertexShader: [
      "attribute float seed;",
      "uniform float uSize,uPixel;",
      "varying float vSeed;",
      "void main(){",
      "  vSeed = seed;",
      "  vec4 mv = modelViewMatrix * vec4(position, 1.0);",
      "  float jitter = 0.58 + fract(sin(seed * 19.17) * 43758.5453) * 1.18;",
      "  float depth = clamp(2.2 / max(0.35, -mv.z), 0.54, 1.55);",
      "  gl_PointSize = uSize * jitter * depth * uPixel * 120.0;",
      "  gl_Position = projectionMatrix * mv;",
      "}",
    ].join("\n"),
    fragmentShader: [
      "precision highp float;",
      "uniform sampler2D uMap,uOpacity;",
      "uniform vec3 uColor;",
      "uniform float uOpacity;",
      "varying float vSeed;",
      "void main(){",
      "  vec4 tex = texture2D(uMap, gl_PointCoord);",
      "  float twinkle = 0.72 + fract(sin(vSeed * 7.31) * 91.7) * 0.28;",
      "  gl_FragColor = vec4(uColor * twinkle, tex.a * uOpacity);",
      "}",
    ].join("\n"),
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
  });
  const sparks = new THREE.Points(pgeo, pmat);
  sparks.renderOrder = 44;
  sparks.visible = !!(getFx()?.state?.lyricGlowParticles);
  group.add(sparks);

  // Store references
  const lyric: LyricMeshData = {
    mask,
    textMesh,
    readability,
    glow,
    sparks,
    sun,
    textMat,
    readabilityMat,
    glowMat,
    sparkMat: pmat,
    sunMat,
    basePositions: ppos.slice(),
    textWorldW,
    textWorldH,
    worldW,
    worldH,
  };
  group.userData.lyric = lyric;

  updateLyricMeshProgress(group, 0);
  return group;
}

// ── Helpers ──

function updateLyricMeshProgress(mesh: any, progress: number) {
  if (!mesh || !mesh.userData?.lyric) return;
  progress = Math.max(0, Math.min(1, progress || 0));
  const d = mesh.userData.lyric as LyricMeshData;
  d.textMat.uniforms.uProgress.value = progress;
  mesh.userData.lastLyricProgress = progress;
}

function disposeLyricMesh(mesh: any) {
  if (!mesh) return;
  if (mesh.parent) mesh.parent.remove(mesh);
  mesh.traverse((obj: any) => {
    if (obj.material) {
      if (Array.isArray(obj.material)) {
        obj.material.forEach((m: any) => {
          if (m.map) m.map.dispose();
          m.dispose();
        });
      } else {
        if (obj.material.map) obj.material.map.dispose();
        if (obj.material.uniforms?.uMap?.value) obj.material.uniforms.uMap.value.dispose();
        obj.material.dispose();
      }
    }
    if (obj.geometry) obj.geometry.dispose();
  });
}

function clearStageLyrics() {
  disposeLyricMesh(state.current);
  state.current = null;
  state.currentIdx = -1;
  state.currentText = "";
  while (state.outgoing.length) disposeLyricMesh(state.outgoing.pop()!);
}

function createLyricsParticles() {
  if (state.group) {
    ensureLyricStarRiver();
    return;
  }
  state.group = new THREE.Group();
  state.group.renderOrder = 38;
  scene.add(state.group);
  ensureLyricStarRiver();
}

function getLyricLineProgress(line: any, nextLine: any, now: number): number {
  if (!line) return 0;
  now += line.words && line.words.length ? 0.03 : 0.02;
  if (line.words && line.words.length && (line as any).charCount > 0) {
    let lastP = 0;
    for (let i = 0; i < line.words.length; i++) {
      const w = line.words[i];
      const ws = (w as any).t ?? (w as any).time;
      const we = ws + Math.max(0.08, (w as any).d || (w as any).duration || 0.24);
      if (now < ws) return lastP;
      const local = now >= we ? 1 : (now - ws) / Math.max(0.08, we - ws);
      const clamped = Math.max(0, Math.min(1, local));
      const p = (w.c0 + (w.c1 - w.c0) * clamped) / (line as any).charCount;
      lastP = Math.max(lastP, p);
      if (now < we) return lastP;
    }
    return 1;
  }
  const nextT = nextLine && (nextLine as any).time > (line as any).time ? (nextLine as any).time : ((getAudio()?.state?.audio?.duration as number) ?? now + 4);
  const span = Math.max(0.75, nextT - (line as any).time);
  const prog = Math.max(0, Math.min(1, (now - (line as any).time) / span));
  return prog * prog * (3 - 2 * prog);
}

function getCurrentLyricFallbackText(): string {
  const song = getPlayback()?.state?.currentSong;
  const title = (song?.name || "").trim();
  const artist = (song?.artist || "").trim();
  if (!title) return "♪";
  return artist ? `${title} - ${artist}` : title;
}

// ── State & References ──

let _lyrics: any = null;
let _fx: any = null;
let _visual: any = null;
let _audio: any = null;
let _playback: any = null;

function getLyrics() { return _lyrics ??= useLyrics(); }
function getFx() { return _fx ??= useFx(); }
function getVisual() { return _visual ??= useVisual(); }
function getAudio() { return _audio ??= useAudio(); }
function getPlayback() { return _playback ??= usePlayback(); }

let scene: any = null;
let camera: any = null;
let renderer: any = null;
let uniforms: any = null;
let particles: any = null;
let beatPulse: number = 0;

const state: StageLyricsState = {
  group: null,
  current: null,
  outgoing: [],
  currentIdx: -1,
  currentText: "",
  highBloom: 0,
  beatGlow: 0,
  glowFollowX: 0,
  glowFollowY: 0,
  glowFollowRoll: 0,
  starRiver: null,
  starRiverWidth: 4.2,
  starRiverHeight: 0.58,
  lockFitScale: 1,
  snapCameraLockFrames: 0,
  palette: {
    primary: "#d6f8ff",
    secondary: "#9cffdf",
    highlight: "#eef7ff",
    shadow: "rgba(2,8,12,0.42)",
    glow: "rgba(143,233,255,0.34)",
  },
  coverPalette: {
    primary: "#d6f8ff",
    secondary: "#9cffdf",
    highlight: "#eef7ff",
    shadow: "rgba(2,8,12,0.42)",
    glow: "rgba(143,233,255,0.34)",
  },
};

// ── Star River Update ──

function updateLyricStarRiver(dt: number) {
  const river = ensureLyricStarRiver();
  if (!river || !(river as any).material?.uniforms) return;

  const u = (river as any).material.uniforms;
  const data = state.current?.userData?.lyric;
  const targetW = data
    ? clampRange((data.textWorldW || data.worldW || 4.2) * 1.12 + 0.8, 2.25, 7.2)
    : 3.4;
  const targetH = data
    ? clampRange((data.textWorldH || data.worldH || 0.58) * 1.85 + 0.18, 0.52, 1.35)
    : 0.58;

  state.starRiverWidth += (targetW - state.starRiverWidth) * Math.min(1, dt * 5.2);
  state.starRiverHeight += (targetH - state.starRiverHeight) * Math.min(1, dt * 4.6);
  u.uWidth.value = state.starRiverWidth;
  u.uHeight.value = state.starRiverHeight;

  const lyricGlowStrength = getFx()?.state?.lyricGlow ? Math.min(0.85, Math.max(0, getFx()?.state?.lyricGlowStrength)) : 0;
  const targetOpacity =
    state.current && getFx()?.state?.lyricGlowParticles
      ? clampRange(0.22 + lyricGlowStrength * 0.58 + state.highBloom * 0.16 + state.beatGlow * 0.12, 0.16, 0.86)
      : 0;
  u.uOpacity.value += (targetOpacity - u.uOpacity.value) * (targetOpacity > u.uOpacity.value ? 0.1 : 0.055);

  u.uColorA.value.copy(lyricThreeColor(state.palette.secondary || state.palette.primary, "#9cffdf", 0.42));
  u.uColorB.value.copy(lyricThreeColor(state.palette.highlight || state.palette.primary, "#fff7d2", 0.46));

  river.visible = u.uOpacity.value > 0.01 || !!state.current;

  const t = uniforms?.uTime?.value ?? 0;
  river.position.y += ((0.18 + Math.sin(t * 0.44) * 0.035 + Math.sin(t * 0.91 + 1.7) * 0.018) - river.position.y) * 0.08;
  river.position.z += ((1.54 + Math.cos(t * 0.31) * 0.06) - river.position.z) * 0.08;
  river.rotation.z = Math.sin(t * 0.22) * 0.012;

  // Update shader uniforms
  if (u.uTime) u.uTime.value = t;
  if (u.uBass) u.uBass.value = getVisual()?.state?.smoothBass ?? 0;
  if (u.uBeat) u.uBeat.value = getVisual()?.state?.beatPulse ?? 0;
}

// ── 3D Positioning ──

function tickLyricsParticles(_dt: number) {
  if (!state._tickDebug) {
    state._tickDebug = true;
    console.log("[Lyrics3D] tickLyricsParticles called", { particleLyrics: getFx()?.state?.particleLyrics, hasAudio: !!getAudio()?.state?.audio, lineCount: getLyrics()?.state?.lines?.length, hasScene: !!scene, hasGroup: !!state.group, currentIdx: getLyrics()?.state?.currentIdx });
  }
  if (!getFx()?.state?.particleLyrics) {
    if (state.current || state.currentText || (state.outgoing && state.outgoing.length)) clearStageLyrics();
    return;
  }
  if (!getAudio()?.state?.audio) {
    if (state.current) {
      state.current.userData.state = "out";
      state.current.userData.age = 0;
      state.outgoing.push(state.current);
      state.current = null;
      state.currentIdx = -1;
      state.currentText = "";
    }
    return;
  }

  // No lyrics lines but audio is playing — show fallback (song title/artist)
  if (!getLyrics()?.state?.lines?.length) {
    const fallbackText = getCurrentLyricFallbackText();
    if (!fallbackText) {
      if (state.current) {
        state.current.userData.state = "out";
        state.current.userData.age = 0;
        state.outgoing.push(state.current);
        state.current = null;
        state.currentIdx = -1;
        state.currentText = "";
      }
      return;
    }
    if (state.currentIdx !== -2 || state.currentText !== fallbackText) {
      state.currentIdx = -2;
      showStageLine(fallbackText);
    }
    return;
  }

  const audioEl = audio.state.audio;
  const t = audioEl.currentTime;
  const lines = getLyrics().state.lines;

  // Find current line index
  let newIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].time <= t + 0.05) newIdx = i;
    else break;
  }

  if (newIdx < 0) {
    // Before first lyric - show fallback
    const introText = getCurrentLyricFallbackText();
    if (!introText) {
      clearStageLyrics();
      return;
    }
    if (state.currentIdx !== -2 || state.currentText !== introText) {
      state.currentIdx = -2;
      showStageLine(introText);
    }
    if (state.current) {
      const firstLine = lines[0];
      const introEnd = firstLine?.time ?? 4.8;
      const introLine = { t: 0, text: introText, duration: Math.max(0.8, introEnd), charCount: Math.max(1, introText.length), fallback: true };
      updateLyricMeshProgress(state.current, getLyricLineProgress(introLine, null, t));
    }
    return;
  }

  if (newIdx !== state.currentIdx) {
    console.log("[Lyrics3D] Line changed", { from: state.currentIdx, to: newIdx, text: lines[newIdx]?.text, time: t });
    state.currentIdx = newIdx;
    showStageLine(lines[newIdx]?.text || "");
  }

  if (state.current) {
    const curLine = lines[newIdx] || { t };
    const nextLine = lines[newIdx + 1];
    const progress = getLyricLineProgress(curLine, nextLine, t);
    updateLyricMeshProgress(state.current, progress);
  }
}

function showStageLine(text: string, _redrawOnly?: boolean) {
  console.log("[Lyrics3D] showStageLine", { text, hasGroup: !!state.group });
  try {
    createLyricsParticles();
  } catch (e) {
    console.error("[Lyrics3D] createLyricsParticles failed:", e);
  }
  if (!state.group) {
    console.warn("[Lyrics3D] showStageLine: no group, will not show");
    return;
  }
  if (!text) {
    clearStageLyrics();
    return;
  }
  if (state.current) {
    state.current.userData.state = "out";
    state.current.userData.age = 0;
    state.outgoing.push(state.current);
  }
  state.currentText = text;
  try {
    const mesh = buildLyricMesh(text);
    console.log("[Lyrics3D] buildLyricMesh result", { hasMesh: !!mesh, children: mesh.children?.length, userData: !!mesh?.userData?.lyric, textMat: !!mesh?.userData?.lyric?.textMat });
    state.group.add(mesh);
    state.current = mesh;
  } catch (e) {
    console.error("[Lyrics3D] buildLyricMesh failed:", e);
  }
}

function updateStageLyrics3D(dt: number) {
  if (!state.group) return;
  if (!getFx()?.state?.particleLyrics && !state.current && !state.outgoing.length) return;
  if (!isFinite(state.highBloom)) state.highBloom = 0;
  if (!isFinite(state.beatGlow)) state.beatGlow = 0;
  if (!isFinite(state.glowFollowX)) state.glowFollowX = 0;
  if (!isFinite(state.glowFollowY)) state.glowFollowY = 0;
  if (!isFinite(state.glowFollowRoll)) state.glowFollowRoll = 0;
  if (!state._updateDebug) {
    state._updateDebug = true;
    console.log("[Lyrics3D] updateStageLyrics3D first call", { hasCurrent: !!state.current, outgoingLen: state.outgoing.length, particleLyrics: getFx()?.state?.particleLyrics, groupChildren: state.group.children?.length, groupPos: state.group.position?.toArray() });
  }

  const t = uniforms?.uTime?.value ?? 0;
  const lyricGlowStrength = getFx()?.state?.lyricGlow ? Math.min(0.85, Math.max(0, getFx()?.state?.lyricGlowStrength)) : 0;
  const glowDrive = Math.min(1.7, Math.max(0, lyricGlowStrength / 0.5));
  const glowBreath = lyricGlowStrength > 0 ? (0.5 + 0.5 * Math.sin(t * 1.05)) : 0;
  const musicBloom = Math.max(getVisual()?.state?.lyricSunEnergy ?? 0, (beatPulse || 0) * 0.1);
  const beatPulseVal = beatPulse || 0;
  const beatGlowRaw = getFx()?.state?.lyricGlowBeat && lyricGlowStrength > 0
    ? Math.max(beatPulseVal * 1.22, 0)
    : 0;
  state.beatGlow += (beatGlowRaw - state.beatGlow) * (beatGlowRaw > state.beatGlow ? 0.32 : 0.1);
  if (!isFinite(state.beatGlow)) state.beatGlow = 0;

  const solarBloom = lyricGlowStrength > 0
    ? (0.18 + glowBreath * 0.16 + musicBloom * 0.9 + state.beatGlow * 1.18 + Math.sin(t * 0.37 + 1.2) * 0.035) * glowDrive
    : 0;
  state.highBloom += (solarBloom - state.highBloom) * (solarBloom > state.highBloom ? 0.075 : 0.05);
  if (!isFinite(state.highBloom)) state.highBloom = 0;

  updateLyricStarRiver(dt);

  // Glow follow
  const followDrive = getFx()?.state?.lyricGlowBeat && lyricGlowStrength > 0 ? Math.min(1.35, state.beatGlow) : 0;
  state.glowFollowX += (followDrive * 0 - state.glowFollowX) * 0.26;
  state.glowFollowY += (followDrive * 0 - state.glowFollowY) * 0.24;
  state.glowFollowRoll += (followDrive * 0 - state.glowFollowRoll) * 0.22;
  state.glowFollowX *= 0.92;
  state.glowFollowY *= 0.92;
  state.glowFollowRoll *= 0.9;

  // Layout transforms
  const layoutScale = clampRange(Number(getFx()?.state?.lyricScale) || 1, 0.35, 1.65);
  const layoutX = clampRange(Number(getFx()?.state?.lyricOffsetX) || 0, -2.0, 2.0);
  const layoutY = clampRange(Number(getFx()?.state?.lyricOffsetY) || 0, -1.2, 1.35);
  const layoutZ = clampRange(Number(getFx()?.state?.lyricOffsetZ) || 0, -1.6, 1.6);
  const layoutTiltX = clampRange(Number(getFx()?.state?.lyricTiltX) || 0, -42, 42);
  const layoutTiltY = clampRange(Number(getFx()?.state?.lyricTiltY) || 0, -42, 42);

  const cameraLockedLyrics = getFx()?.state?.lyricCameraLock && camera;
  const lockDistance = 4.85 + layoutZ;

  // Fit scale for camera lock
  let lockFit = 1;
  if (cameraLockedLyrics || false) {
    lockFit = lyricCameraLockFit(layoutScale, layoutX, layoutY, lockDistance);
  }
  if (!isFinite(state.lockFitScale)) state.lockFitScale = 1;
  state.lockFitScale += (lockFit - state.lockFitScale) * (lockFit < state.lockFitScale ? 0.18 : 0.1);
  state.group.scale.setScalar(layoutScale * state.lockFitScale);

  // Positioning mode: camera lock or cover-follow
  if (cameraLockedLyrics) {
    const lockBaseDistance = 4.85;
    const lyricLayoutBase = new THREE.Vector3().copy(camera.position).addScaledVector(
      new THREE.Vector3(0, 0, 1).applyQuaternion(camera.quaternion),
      lockBaseDistance
    );
    const lyricCameraTarget = lyricLayoutBase;
    // Apply offset
    const offset = new THREE.Vector3(layoutX, layoutY, layoutZ).applyQuaternion(camera.quaternion);
    lyricCameraTarget.add(offset);

    if (state.snapCameraLockFrames > 0) {
      state.group.position.copy(lyricCameraTarget);
      state.group.quaternion.copy(camera.quaternion);
      state.snapCameraLockFrames--;
    } else {
      state.group.position.lerp(lyricCameraTarget, 0.24);
      state.group.quaternion.slerp(camera.quaternion, 0.22);
    }
    state.snapCameraLockFrames = 6;
  } else {
    state.snapCameraLockFrames = 0;
    if (particles) {
      particles.updateMatrixWorld(true);
      particles.getWorldPosition(lyricCoverWorldPos);
      particles.getWorldQuaternion(lyricCoverWorldQuat);
    } else {
      lyricCoverWorldPos.set(0, 0, 0);
      lyricCoverWorldQuat.identity();
    }
    state.group.position.copy(lyricCoverWorldPos);
    state.group.position.x += layoutX;
    state.group.position.y += layoutY;
    state.group.position.z += layoutZ;
    state.group.quaternion.copy(lyricCoverWorldQuat);
  }

  // Apply tilt
  state.group.rotation.x += ((layoutTiltX / 180 * Math.PI) - state.group.rotation.x) * 0.15;
  state.group.rotation.y += ((layoutTiltY / 180 * Math.PI) - state.group.rotation.y) * 0.15;

  // Tick individual meshes
  if (!state._tickDebug) {
    state._tickDebug = true;
    console.log("[Lyrics3D] tick individual meshes", { currentHasLyric: !!(state.current?.userData?.lyric), outgoingCount: state.outgoing.length });
  }
  tickMesh(state.current, true);
  for (let i = state.outgoing.length - 1; i >= 0; i--) {
    if (!tickMesh(state.outgoing[i], false)) {
      disposeLyricMesh(state.outgoing[i]);
      state.outgoing.splice(i, 1);
    }
  }
  if (!state._endDebug) {
    state._endDebug = true;
    const hasCurrent = !!state.current;
    const currentUserData = hasCurrent ? state.current.userData : null;
    const currentLyricData = currentUserData?.lyric;
    console.log("[Lyrics3D] updateStageLyrics3D end", {
      groupChildren: state.group.children?.length,
      currentPos: state.current?.position?.toArray(),
      groupPos: state.group.position?.toArray(),
      groupVisible: state.group.visible,
      groupScale: state.group.scale?.toArray(),
      hasCurrent,
      currentAge: currentUserData?.age,
      currentProgress: currentUserData?.lastLyricProgress,
      lyricTextMat: currentLyricData?.textMat,
      lyricTextMatUniforms: currentLyricData?.textMat?.uniforms,
    });
  }
}

// ── Mesh Tick ──

const lyricSunHotColor = new THREE.Color("#fff0b8");
const lyricSunColor = new THREE.Color("#d6f8ff");
const lyricCoverWorldPos = new THREE.Vector3();
const lyricCoverWorldQuat = new THREE.Quaternion();

function lyricCameraLockFit(layoutScale: number, _layoutX: number, _layoutY: number, _distance: number): number {
  // Simplified fit: just return layout scale
  return Math.min(1.0, layoutScale);
}

function tickMesh(mesh: any, isCurrent: boolean): boolean {
  if (!mesh || !mesh.userData.lyric) return false;
  mesh.userData.age = (mesh.userData.age || 0) + (dt_global || 0.016);
  if (!state._tickMeshDebug) {
    state._tickMeshDebug = true;
    console.log("[Lyrics3D] tickMesh first call", { isCurrent, meshPos: mesh.position?.toArray(), meshScale: mesh.scale?.toArray(), age: mesh.userData.age, hasUserData: !!mesh.userData, hasLyricData: !!mesh.userData.lyric });
  }
  const a = Math.min(1, mesh.userData.age / (isCurrent ? 0.52 : 0.38));
  const easeA = a * a * (3 - 2 * a);
  const data = mesh.userData.lyric as LyricMeshData;
  const glowMix = isCurrent ? 1.0 : 0.64;
  const glowX = state.glowFollowX * glowMix;
  const glowY = state.glowFollowY * glowMix;
  const glowRoll = state.glowFollowRoll * glowMix;

  if (data.glow) {
    data.glow.position.set(glowX * 0.14, glowY * 0.12, -0.006);
    data.glow.rotation.z = glowRoll * 0.3;
  }
  if (data.sun) {
    data.sun.position.set(glowX * 0.42, 0.02 + glowY * 0.34, -0.035);
    data.sun.rotation.z = glowRoll * 0.36;
  }
  if (data.sparks) {
    data.sparks.position.set(glowX * 0.24, glowY * 0.22, 0.01);
    data.sparks.rotation.z = glowRoll * 0.22;
  }

  if (!isCurrent) {
    // Outgoing fade
    const opacity = (1 - a) * 0.72;
    if (data.textMat) data.textMat.uniforms.uOpacity.value = opacity;
    if (data.readabilityMat) data.readabilityMat.opacity = opacity * 0.58;
    if (data.textMat && data.textMat.uniforms.uSolar) data.textMat.uniforms.uSolar.value *= 0.86;
    if (data.glowMat) data.glowMat.opacity = lyricThreeColor("#9cffdf", "", 0).r > 0 ? opacity * 0.08 * (getFx()?.state?.lyricGlowStrength ?? 0) : 0;
    if (data.sunMat) data.sunMat.opacity = 0;
    mesh.position.z -= 0.26 * (dt_global || 0.016);
    mesh.position.y += 0.08 * (dt_global || 0.016);
    mesh.scale.setScalar(0.98 - a * 0.06);
    return a < 1;
  }

  // Current lyric
  const lyricGlowStrength = getFx()?.state?.lyricGlow ? Math.min(0.85, Math.max(0, getFx()?.state?.lyricGlowStrength)) : 0;
  const solarTarget = state.highBloom;
  const beatGlowVal = state.beatGlow;

  // Opacity
  const currentOpacity = data.textMat?.uniforms?.uOpacity?.value ?? 0;
  const opacity = currentOpacity + (0.96 - currentOpacity) * 0.16;
  if (data.textMat) data.textMat.uniforms.uOpacity.value = Math.min(1, opacity);

  // Readability
  if (data.readabilityMat) {
    const readabilityTarget = Math.min(1, opacity) * 0.86;
    data.readabilityMat.opacity += (readabilityTarget - data.readabilityMat.opacity) * 0.16;
  }

  // Solar (bloom)
  if (data.textMat?.uniforms?.uSolar) {
    const solarEase = solarTarget > (data.textMat.uniforms.uSolar.value ?? 0) ? 0.12 : 0.05;
    data.textMat.uniforms.uSolar.value += (solarTarget - (data.textMat.uniforms.uSolar.value ?? 0)) * solarEase;
  }

  // Glow
  if (data.glowMat) {
    const glowTarget = lyricGlowStrength > 0 ? Math.min(1, 0.075 + state.highBloom * 0.34 + beatGlowVal * 0.16) * Math.min(3, glowDrive ?? 1) : 0;
    data.glowMat.opacity += (glowTarget - data.glowMat.opacity) * 0.095;
    const warmth = Math.min(1, solarTarget * 1.1);
    data.glowMat.color.copy(lyricThreeColor(state.palette.glow || state.palette.secondary, "#9cffdf", 0.36));
    data.glowMat.color.lerp(lyricSunHotColor, warmth * 0.55);
  }

  // Sparks
  if (data.sparkMat) {
    const sparkTarget = lyricGlowStrength > 0 && getFx()?.state?.lyricGlowParticles
      ? Math.min(0.42, (0.1 + state.highBloom * 0.14 + beatGlowVal * 0.1) * Math.min(1.6, glowDrive ?? 1))
      : 0;
    const currentSpark = data.sparkMat.uniforms?.uOpacity?.value ?? 0;
    data.sparkMat.uniforms.uOpacity.value += (sparkTarget - currentSpark) * 0.13;
    data.sparks.visible = getFx()?.state?.lyricGlowParticles || (data.sparkMat.uniforms?.uOpacity?.value ?? 0) > 0.015;
  }

  // Sun
  if (data.sunMat) {
    const sunTarget = lyricGlowStrength > 0
      ? Math.min(0.88, (Math.pow(Math.min(1.35, solarTarget), 1.08) * 0.28 + beatGlowVal * 0.2) * Math.min(2.4, glowDrive ?? 1))
      : 0;
    data.sunMat.opacity += (sunTarget - data.sunMat.opacity) * 0.055;
    data.sunMat.color.copy(lyricSunColor);
    data.sunMat.color.lerp(lyricSunHotColor, solarTarget * 0.55);
  }

  // Sun scale/pulse
  if (data.sun) {
    const sunPulse = solarTarget;
    const beatScale = getFx()?.state?.lyricGlowBeat ? beatGlowVal * 0.24 : 0;
    const seed = mesh.userData.floatSeed || 0;
    data.sun.scale.set(
      0.82 + sunPulse * 0.36 + beatScale + Math.sin(t_global!) * sunPulse * 0.018,
      0.60 + sunPulse * 0.34 + beatScale * 0.72 + Math.cos(t_global! * 1.25) * sunPulse * 0.02,
      1
    );
    data.sun.rotation.z += Math.sin(t_global! * 0.32 + seed) * 0.01 * sunPulse;
  }

  // Main mesh animation
  const seed = mesh.userData.floatSeed || 0;
  const breathe = Math.sin(t_global! * 0.92 + seed) * 0.05 + Math.sin(t_global! * 0.41 + seed * 0.7) * 0.028;
  const bassVal = getVisual()?.state?.smoothBass ?? 0;
  const beatPulseV = getVisual()?.state?.beatPulse ?? 0;
  mesh.scale.setScalar(0.96 + easeA * 0.055 + breathe + bassVal * 0.038 + beatPulseV * 0.014);

  const targetY = 0.18 + Math.sin(t_global! * 0.55 + seed) * 0.055 + Math.sin(t_global! * 1.35 + seed) * 0.014;
  mesh.position.y += (targetY - mesh.position.y) * 0.075;

  const targetZ = 1.48 + Math.cos(t_global! * 0.48 + seed) * 0.08;
  mesh.position.z += (targetZ - mesh.position.z) * 0.08;

  mesh.rotation.z = Math.sin(t_global! * 0.34 + seed) * 0.018;

  // Spark particles animation
  if (data.sparks && data.basePositions) {
    const pos = data.sparks.geometry.attributes.position;
    const arr = pos.array;
    const base = data.basePositions;
    const dtG = dt_global || 0.016;
    data.sparks.rotation.z += ((getFx()?.state?.lyricGlowParticles ? 0.0009 : 0.00025) + beatGlowVal * 0.0007) * (dtG * 60);
    data.sparks.rotation.x = Math.sin(t_global! * 0.12 + seed) * 0.012;

    const midVal = getVisual()?.state?.smoothMid ?? 0;
    for (let si = 0; si < arr.length / 3; si++) {
      const s = si * 12.989 + seed;
      const drift = getFx()?.state?.lyricGlowParticles ? 1 : 0.3;
      arr[si * 3] =
        base[si * 3] +
        Math.sin(t_global! * (0.18 + (si % 5) * 0.025) + s) * (0.045 + bassVal * 0.03 + beatGlowVal * 0.052) * drift +
        Math.cos(t_global! * 0.11 + s) * 0.018 * 0.18;
      arr[si * 3 + 1] =
        base[si * 3 + 1] +
        Math.cos(t_global! * (0.16 + (si % 6) * 0.024) + s) * (0.042 + midVal * 0.026 + beatGlowVal * 0.046) * drift +
        Math.sin(t_global! * 0.13 + s) * 0.016 * 0.18;
      arr[si * 3 + 2] =
        base[si * 3 + 2] +
        Math.sin(t_global! * (0.24 + (si % 4) * 0.035) + s) * (0.036 + beatGlowVal * 0.028) * drift;
    }
    pos.needsUpdate = true;
  }

  return true;
}

// Global refs for tickMesh
let dt_global = 0.016;
let t_global = 0;
let glowDrive: number = 0;

// ── Initialize ──

export function initStageLyrics3D(
  s: any,
  c: any,
  r: any,
  u: any,
  p: any,
  _bc: any,
  bp: number,
) {
  console.log("[Lyrics3D] initStageLyrics3D called", { scene: !!s, camera: !!c, renderer: !!r, uniforms: !!u, particles: !!p, beatPulse: bp });
  scene = s;
  camera = c;
  renderer = r;
  uniforms = u;
  particles = p;
  beatPulse = bp;

  if (!scene) {
    console.warn("[Lyrics3D] scene is null, lyrics will not render");
    return;
  }
  if (!state.group) {
    state.group = new THREE.Group();
    state.group.name = "stageLyrics3D";
    scene.add(state.group);
    console.log("[Lyrics3D] Created and added group to scene");
  }
}

export {
  tickLyricsParticles,
  updateStageLyrics3D,
  showStageLine,
  clearStageLyrics,
  createLyricsParticles,
  buildLyricMesh,
  disposeLyricMesh,
  state,
};
