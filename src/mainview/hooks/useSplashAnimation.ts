// @ts-nocheck
import { onMount, onCleanup } from "solid-js";

let introSoundPlayed = false;

function playIntroSound() {
  if (introSoundPlayed) return;
  try {
    const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextCtor) return;
    const ctx = new AudioContextCtor();
    if (ctx.state === "suspended" && ctx.resume) {
      ctx.resume().then(() => { if (!introSoundPlayed) playIntroSound(); }).catch(() => {});
      if (ctx.state === "suspended") return;
    }
    introSoundPlayed = true;

    const now = ctx.currentTime + 0.02;
    const master = ctx.createGain();
    master.gain.setValueAtTime(0.0001, now);
    master.gain.exponentialRampToValueAtTime(0.062, now + 0.16);
    master.gain.exponentialRampToValueAtTime(0.040, now + 3.35);
    master.gain.exponentialRampToValueAtTime(0.0001, now + 5.28);
    master.connect(ctx.destination);

    const noiseBuffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 2.45), ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      const tail = 1 - i / data.length;
      data[i] = (Math.random() * 2 - 1) * Math.pow(tail, 1.35);
    }
    const noise = ctx.createBufferSource();
    const noiseGain = ctx.createGain();
    const noiseFilter = ctx.createBiquadFilter();
    noise.buffer = noiseBuffer;
    noiseFilter.type = "bandpass";
    noiseFilter.frequency.setValueAtTime(720, now);
    noiseFilter.frequency.exponentialRampToValueAtTime(2400, now + 2.2);
    noiseFilter.Q.setValueAtTime(0.72, now);
    noiseGain.gain.setValueAtTime(0.0001, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.020, now + 0.12);
    noiseGain.gain.exponentialRampToValueAtTime(0.010, now + 1.60);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 2.42);
    noise.connect(noiseFilter); noiseFilter.connect(noiseGain); noiseGain.connect(master);
    noise.start(now); noise.stop(now + 2.46);

    const low = ctx.createOscillator();
    const lowGain = ctx.createGain();
    low.type = "sine";
    low.frequency.setValueAtTime(86, now + 0.18);
    low.frequency.exponentialRampToValueAtTime(43, now + 1.18);
    lowGain.gain.setValueAtTime(0.0001, now + 0.12);
    lowGain.gain.exponentialRampToValueAtTime(0.032, now + 0.30);
    lowGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.34);
    low.connect(lowGain); lowGain.connect(master);
    low.start(now + 0.12); low.stop(now + 1.40);

    function softTone(type: OscillatorType, f0: number, f1: number, startAt: number, dur: number, peak: number) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();
      osc.type = type;
      osc.frequency.setValueAtTime(f0, now + startAt);
      osc.frequency.exponentialRampToValueAtTime(f1, now + startAt + dur * 0.72);
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(3400, now + startAt);
      gain.gain.setValueAtTime(0.0001, now + startAt);
      gain.gain.exponentialRampToValueAtTime(peak, now + startAt + 0.08);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + startAt + dur);
      osc.connect(filter); filter.connect(gain); gain.connect(master);
      osc.start(now + startAt);
      osc.stop(now + startAt + dur + 0.04);
    }
    softTone("triangle", 440, 660, 1.05, 0.72, 0.018);
    softTone("sine", 880, 1320, 2.10, 0.86, 0.013);
    softTone("triangle", 1180, 1760, 2.72, 0.52, 0.010);
    softTone("triangle", 660, 1180, 3.32, 0.82, 0.014);
    softTone("sine", 1760, 1040, 3.64, 0.46, 0.010);
  } catch (_) {}
}

function armSoundFallback() {
  function unlock() {
    if (!introSoundPlayed) playIntroSound();
    document.removeEventListener("pointerdown", unlock, true);
    document.removeEventListener("keydown", unlock, true);
  }
  document.addEventListener("pointerdown", unlock, true);
  document.addEventListener("keydown", unlock, true);
}

export function useSplashAnimation() {
  let animating = true;
  let startedAt = performance.now();
  let canvas: HTMLCanvasElement | null = null;
  let ctx: CanvasRenderingContext2D | null = null;
  let gl: WebGLRenderingContext | null = null;
  let glProgram: WebGLProgram | null = null;
  let glBuffer: WebGLBuffer | null = null;
  let glUniforms: { position: number; resolution: WebGLUniformLocation | null; time: WebGLUniformLocation | null } | null = null;
  let splashW = 0;
  let splashH = 0;
  let pixelRatio = 1;
  let dust: Array<{ x: number; y: number; vx: number; vy: number; r: number; a: number; p: number }> = [];
  let streaks: Array<{ x: number; y: number; len: number; width: number; speed: number; angle: number; phase: number; color: string; delay: number; alpha: number }> = [];
  let shards: Array<{ ox: number; oy: number; w: number; h: number; skew: number; phase: number; color: string; alpha: number }> = [];
  let rafId = 0;
  let resizeHandler: (() => void) | null = null;

  function clamp01(v: number) { return Math.max(0, Math.min(1, v)); }
  function smoothstep(edge0: number, edge1: number, x: number) {
    const t = clamp01((x - edge0) / Math.max(0.0001, edge1 - edge0));
    return t * t * (3 - 2 * t);
  }
  function easeOutCubic(t: number) {
    t = clamp01(t);
    return 1 - Math.pow(1 - t, 3);
  }

  function initWebgl(c: HTMLCanvasElement): boolean {
    let g: WebGLRenderingContext | null = null;
    try {
      g = (c.getContext("webgl", {
        alpha: true, antialias: false, depth: false, stencil: false,
        premultipliedAlpha: false, preserveDrawingBuffer: false,
        powerPreference: "high-performance",
      }) || c.getContext("experimental-webgl")) as WebGLRenderingContext | null;
    } catch (_) { g = null; }
    if (!g) return false;

    const vertexSource = [
      "attribute vec2 aPosition;",
      "varying vec2 vUv;",
      "void main(){",
      "  vUv = aPosition * 0.5 + 0.5;",
      "  gl_Position = vec4(aPosition, 0.0, 1.0);",
      "}",
    ].join("\n");

    const fragmentSource = [
      "precision highp float;",
      "varying vec2 vUv;",
      "uniform vec2 uResolution;",
      "uniform float uTime;",
      "",
      "float saturate(float v){ return clamp(v, 0.0, 1.0); }",
      "float ease(float v){ v = saturate(v); return v * v * (3.0 - 2.0 * v); }",
      "mat2 rot(float a){ float c = cos(a); float s = sin(a); return mat2(c, -s, s, c); }",
      "float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }",
      "float noise(vec2 p){",
      "  vec2 i = floor(p);",
      "  vec2 f = fract(p);",
      "  vec2 u = f * f * (3.0 - 2.0 * f);",
      "  return mix(mix(hash(i), hash(i + vec2(1.0,0.0)), u.x), mix(hash(i + vec2(0.0,1.0)), hash(i + vec2(1.0,1.0)), u.x), u.y);",
      "}",
      "",
      "float animatedLoop(vec2 uv, float t, float channel){",
      "  vec2 q = uv;",
      "  q *= rot(0.28 + sin(t * 0.18) * 0.12);",
      "  q.x += 0.055 * sin(t * 0.30 + channel);",
      "  q.y += 0.040 * cos(t * 0.24 + channel * 1.7);",
      "  float ang = atan(q.y, q.x);",
      "  float angularShift = sin(ang * 3.0 + t * 0.72 + channel * 1.9) * 0.078;",
      "  angularShift += sin(ang * 7.0 - t * 0.54 + channel) * 0.020;",
      "  float neonD = length(q) + angularShift;",
      "  float warpD = length(q * vec2(1.34 + 0.06 * sin(t * 0.25), 0.82 + 0.04 * cos(t * 0.31)));",
      "  warpD += 0.026 * sin(q.x * 4.4 + t * 0.62) + 0.018 * sin(q.y * 5.2 - t * 0.45);",
      "  float diamondD = abs(q.x) * 1.20 + abs(q.y) * 0.84;",
      "  float d = mix(warpD, diamondD, 0.32);",
      "  d = mix(d, neonD, 0.20 + 0.04 * sin(t * 0.18 + channel));",
      "  float pattern = mod((q.x + q.y) * 0.62 + sin(q.x * 5.5 + t) * 0.015 + sin(q.y * 7.0 - t * 0.75) * 0.012, 0.20);",
      "  float acc = 0.0;",
      "  for (int i = 1; i <= 6; i++) {",
      "    float fi = float(i);",
      "    float f = fract(t * 0.152 - channel * 0.018 + 0.011 * fi) * 4.70 - d + pattern;",
      "    acc += 0.00110 * fi * fi / max(abs(f), 0.0065);",
      "  }",
      "  float threadCoord = q.x * 0.92 - q.y * 0.58 + 0.030 * sin(q.x * 5.2 + t * 0.72);",
      "  float threadLines = 0.0065 / max(abs(sin((threadCoord + t * 0.10 + channel * 0.035) * 27.0)), 0.070);",
      "  acc += threadLines * (0.50 + 0.30 * sin(ang * 1.2 + t + channel));",
      "  return min(acc, 1.95);",
      "}",
      "",
      "void main(){",
      "  vec2 p = vUv * 2.0 - 1.0;",
      "  p.x *= uResolution.x / max(uResolution.y, 1.0);",
      "  float t = uTime;",
      "  float intro = ease(t / 0.72);",
      "  float bloomIn = ease((t - 0.10) / 1.10);",
      "  float climax = exp(-pow((t - 3.62) / 0.58, 2.0));",
      "  float preClimax = ease((t - 2.15) / 1.25) * (1.0 - ease((t - 3.86) / 0.72));",
      "  float afterglow = exp(-pow((t - 4.14) / 0.62, 2.0));",
      "  float calm = 1.0 - 0.22 * ease((t - 4.75) / 0.70);",
      "  float settle = 1.0 - 0.34 * ease((t - 5.05) / 0.52);",
      "  vec2 uv = p * (0.98 + 0.05 * sin(t * 0.25));",
      "  uv += vec2(0.0, -0.025);",
      "  vec2 flowAxis = normalize(vec2(0.86, -0.50));",
      "  vec2 crossAxis = vec2(-flowAxis.y, flowAxis.x);",
      "  float lane = dot(p, flowAxis);",
      "  float crossLane = dot(p, crossAxis);",
      "  float syncWave = sin(crossLane * 5.4 + lane * 1.1 - t * 1.85);",
      "  uv += flowAxis * syncWave * 0.055 * climax;",
      "  uv += crossAxis * sin(lane * 7.2 + t * 1.25) * 0.034 * climax;",
      "  uv *= 1.0 + 0.045 * preClimax - 0.020 * climax;",
      "  vec3 ch1 = vec3(1.00, 0.13, 0.31);",
      "  vec3 ch2 = vec3(0.16, 1.00, 0.86);",
      "  vec3 ch3 = vec3(1.00, 0.76, 0.28);",
      "  float a = animatedLoop(uv, t, 0.0);",
      "  float b = animatedLoop(uv * 1.018 + vec2(0.012, -0.008), t + 0.18, 1.0);",
      "  float c = animatedLoop(uv * 0.986 + vec2(-0.010, 0.010), t + 0.35, 2.0);",
      "  vec3 loopCol = ch1 * a + ch2 * b + ch3 * c;",
      "  float tunnel = animatedLoop(uv * 1.42 + vec2(sin(t * 0.2) * 0.08, cos(t * 0.17) * 0.05), t * 1.12 + 1.7, 2.7);",
      "  loopCol += mix(ch2, ch3, 0.35 + 0.25 * sin(t)) * tunnel * (0.30 + 0.24 * preClimax);",
      "  float syncBand = exp(-pow((lane + 0.08 * sin(t * 0.72)) / 0.62, 2.0));",
      "  float phaseThread = pow(0.5 + 0.5 * sin(crossLane * 13.5 + lane * 2.2 - t * 3.1), 8.0);",
      "  float phaseThread2 = pow(0.5 + 0.5 * sin(crossLane * 9.0 - lane * 5.4 + t * 2.4), 10.0);",
      "  vec3 climaxCol = (mix(ch2, ch3, 0.36) * phaseThread + ch1 * phaseThread2 * 0.52) * syncBand * climax;",
      "  float afterBand = exp(-pow((lane - 0.34) / 0.72, 2.0));",
      "  climaxCol += mix(ch1, ch2, vUv.x) * afterBand * afterglow * 0.13;",
      "  float centerBeam = exp(-abs(p.y + 0.005 * sin(t * 3.0)) * 24.0) * (0.14 + 0.52 * exp(-pow((t - 0.74) / 0.34, 2.0)));",
      "  float bladeMask = smoothstep(-1.55, -0.08, p.x) * (1.0 - smoothstep(0.08, 1.55, p.x));",
      "  vec3 blade = mix(ch1, ch2, vUv.x) * centerBeam * bladeMask * (0.40 + 0.28 * climax);",
      "  float flare = exp(-dot(p, p) * 3.6) * exp(-pow((t - 0.88) / 0.40, 2.0));",
      "  vec3 col = vec3(0.002, 0.004, 0.005);",
      "  col += loopCol * (0.56 + 0.46 * bloomIn) * calm * settle;",
      "  col += climaxCol * 0.22;",
      "  float diagonalGlint = exp(-pow(lane * 1.2 + crossLane * 0.10, 2.0) / 0.030) * climax;",
      "  col += blade + vec3(1.0, 0.78, 0.42) * flare * 0.18 + vec3(1.0, 0.86, 0.58) * diagonalGlint * 0.07;",
      "  float scan = 0.92 + 0.08 * sin((vUv.y * uResolution.y + t * 52.0) * 0.72);",
      "  float grain = noise(vUv * uResolution.xy * 0.52 + t * 17.0) - 0.5;",
      "  col *= scan;",
      "  col += grain * 0.018;",
      "  col *= intro;",
      "  col = max(col - vec3(0.010, 0.012, 0.012), 0.0);",
      "  col = vec3(1.0) - exp(-max(col, 0.0) * (0.62 + 0.18 * climax));",
      "  float vignette = smoothstep(1.52, 0.20, length(p * vec2(0.78, 1.04)));",
      "  col *= 0.38 + 0.86 * vignette;",
      "  col += vec3(0.020, 0.010, 0.014) * (1.0 - vignette);",
      "  gl_FragColor = vec4(col, 1.0);",
      "}",
    ].join("\n");

    function compile(type: number, source: string): WebGLShader | null {
      const shader = g!.createShader(type)!;
      g!.shaderSource(shader, source);
      g!.compileShader(shader);
      if (!g!.getShaderParameter(shader, g!.COMPILE_STATUS)) {
        console.warn("Splash shader compile failed:", g!.getShaderInfoLog(shader));
        g!.deleteShader(shader);
        return null;
      }
      return shader;
    }

    const vs = compile(g.VERTEX_SHADER, vertexSource);
    const fs = compile(g.FRAGMENT_SHADER, fragmentSource);
    if (!vs || !fs) return false;

    const program = g.createProgram()!;
    g.attachShader(program, vs);
    g.attachShader(program, fs);
    g.linkProgram(program);
    g.deleteShader(vs);
    g.deleteShader(fs);
    if (!g.getProgramParameter(program, g.LINK_STATUS)) {
      console.warn("Splash shader link failed:", g.getProgramInfoLog(program));
      g.deleteProgram(program);
      return false;
    }

    gl = g;
    glProgram = program;
    glBuffer = g.createBuffer();
    g.bindBuffer(g.ARRAY_BUFFER, glBuffer);
    g.bufferData(g.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), g.STATIC_DRAW);
    glUniforms = {
      position: g.getAttribLocation(program, "aPosition"),
      resolution: g.getUniformLocation(program, "uResolution"),
      time: g.getUniformLocation(program, "uTime"),
    };
    g.disable(g.DEPTH_TEST);
    g.disable(g.CULL_FACE);
    return true;
  }

  function drawWebgl(elapsed: number) {
    if (!gl || !glProgram || !glUniforms || !canvas) return;
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.useProgram(glProgram);
    gl.bindBuffer(gl.ARRAY_BUFFER, glBuffer);
    gl.enableVertexAttribArray(glUniforms.position);
    gl.vertexAttribPointer(glUniforms.position, 2, gl.FLOAT, false, 0, 0);
    gl.uniform2f(glUniforms.resolution, canvas.width, canvas.height);
    gl.uniform1f(glUniforms.time, elapsed);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  function drawCanvas2d(elapsed: number) {
    if (!ctx || !canvas) return;
    ctx.clearRect(0, 0, splashW, splashH);

    const base = ctx.createLinearGradient(0, 0, splashW, splashH);
    base.addColorStop(0, "rgba(1,6,7,0.68)");
    base.addColorStop(0.45, "rgba(10,9,12,0.74)");
    base.addColorStop(1, "rgba(0,0,0,0.84)");
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, splashW, splashH);

    ctx.save();
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = "rgba(255,255,255,0.035)";
    const scanOffset = (elapsed * 28) % 36;
    for (let sy = -scanOffset; sy < splashH; sy += 36) ctx.fillRect(0, sy, splashW, 1);
    ctx.restore();

    for (let i = 0; i < dust.length; i++) {
      const d = dust[i];
      d.x += d.vx;
      d.y += d.vy;
      d.p += 0.018;
      if (d.x < -10) d.x = splashW + 10;
      if (d.x > splashW + 10) d.x = -10;
      if (d.y < -10) d.y = splashH + 10;
      if (d.y > splashH + 10) d.y = -10;
      const alpha = d.a * (0.58 + Math.sin(d.p + elapsed * 0.8) * 0.34);
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255," + Math.max(0, alpha) + ")";
      ctx.fill();
    }

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (let k = 0; k < streaks.length; k++) {
      const st = streaks[k];
      const travel = (elapsed * st.speed * 240 + st.x + Math.sin(elapsed * 0.8 + st.phase) * 28) % (splashW + st.len + 180);
      const px = travel - st.len - 90;
      const py = st.y + Math.sin(elapsed * 0.75 + st.phase) * 18;
      const fade = smoothstep(st.delay * 0.55, st.delay * 0.55 + 0.52, elapsed) * (1 - smoothstep(3.52, 4.12, elapsed));
      if (fade <= 0) continue;
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(st.angle);
      const sg = ctx.createLinearGradient(-st.len * 0.5, 0, st.len * 0.5, 0);
      sg.addColorStop(0, st.color + "0)");
      sg.addColorStop(0.52, st.color + (st.alpha * fade).toFixed(3) + ")");
      sg.addColorStop(1, "rgba(255,255,255,0)");
      ctx.strokeStyle = sg;
      ctx.lineWidth = st.width;
      ctx.shadowColor = st.color + (0.34 * fade).toFixed(3) + ")";
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.moveTo(-st.len * 0.5, 0);
      ctx.lineTo(st.len * 0.5, 0);
      ctx.stroke();
      ctx.restore();
    }

    const lineT = easeOutCubic((elapsed - 0.12) / 1.18);
    const exitFade = 1 - smoothstep(3.58, 4.12, elapsed);
    if (lineT > 0 && exitFade > 0) {
      const centerY = splashH * 0.5 + Math.sin(elapsed * 1.4) * 1.6;
      const slitW = splashW * (0.16 + lineT * 0.72);
      const left = splashW * 0.5 - slitW * 0.5;
      const right = splashW * 0.5 + slitW * 0.5;
      const coreAlpha = (0.34 + lineT * 0.58) * exitFade;
      const slitGrad = ctx.createLinearGradient(left, centerY, right, centerY);
      slitGrad.addColorStop(0, "rgba(255,83,103,0)");
      slitGrad.addColorStop(0.18, "rgba(255,83,103," + (0.18 * exitFade).toFixed(3) + ")");
      slitGrad.addColorStop(0.50, "rgba(255,255,255," + coreAlpha.toFixed(3) + ")");
      slitGrad.addColorStop(0.68, "rgba(244,210,138," + (0.38 * exitFade).toFixed(3) + ")");
      slitGrad.addColorStop(0.84, "rgba(122,215,194," + (0.20 * exitFade).toFixed(3) + ")");
      slitGrad.addColorStop(1, "rgba(122,215,194,0)");
      ctx.shadowColor = "rgba(244,210,138," + (0.48 * exitFade).toFixed(3) + ")";
      ctx.shadowBlur = 42 + lineT * 42;
      ctx.lineCap = "round";
      ctx.strokeStyle = slitGrad;
      ctx.lineWidth = 1.4 + lineT * 2.2;
      ctx.beginPath();
      ctx.moveTo(left, centerY);
      ctx.lineTo(right, centerY);
      ctx.stroke();

      const ignition = Math.exp(-Math.pow((elapsed - 0.72) / 0.26, 2));
      if (ignition > 0.018) {
        const ig = ctx.createLinearGradient(0, centerY, splashW, centerY);
        ig.addColorStop(0, "rgba(122,215,194,0)");
        ig.addColorStop(0.46, "rgba(122,215,194," + (0.07 * ignition).toFixed(3) + ")");
        ig.addColorStop(0.50, "rgba(255,255,255," + (0.16 * ignition).toFixed(3) + ")");
        ig.addColorStop(0.54, "rgba(255,83,103," + (0.08 * ignition).toFixed(3) + ")");
        ig.addColorStop(1, "rgba(244,210,138,0)");
        ctx.fillStyle = ig;
        ctx.fillRect(0, centerY - 48 * ignition, splashW, 96 * ignition);
      }

      const waveAlpha = smoothstep(0.72, 1.95, elapsed) * exitFade;
      if (waveAlpha > 0) {
        ctx.shadowBlur = 20;
        ctx.strokeStyle = "rgba(244,210,138," + (0.22 * waveAlpha).toFixed(3) + ")";
        ctx.lineWidth = 1;
        ctx.beginPath();
        const steps = 82;
        for (let wi = 0; wi <= steps; wi++) {
          const u = wi / steps;
          const x = left + slitW * u;
          const edge = 1 - Math.abs(u - 0.5) * 2;
          const amp = (4 + 18 * lineT) * Math.pow(Math.max(0, edge), 1.4) * waveAlpha;
          const y = centerY + Math.sin(u * 34 + elapsed * 8.2) * amp + Math.sin(u * 87 - elapsed * 5.1) * amp * 0.18;
          if (wi === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      const shardT = smoothstep(0.72, 2.45, elapsed) * exitFade;
      for (let si = 0; si < shards.length; si++) {
        const sh = shards[si];
        const drift = Math.sin(elapsed * 1.7 + sh.phase) * 22;
        const sx = splashW * 0.5 + sh.ox * (0.18 + shardT * 0.82) + drift;
        const sy2 = centerY + sh.oy * (0.20 + shardT * 0.92);
        const localAlpha = sh.alpha * shardT * (0.62 + Math.sin(elapsed * 5 + sh.phase) * 0.38);
        if (localAlpha <= 0) continue;
        ctx.save();
        ctx.translate(sx, sy2);
        ctx.rotate((-6 + sh.skew * 0.10) * Math.PI / 180);
        ctx.fillStyle = sh.color + Math.max(0, localAlpha).toFixed(3) + ")";
        ctx.shadowColor = sh.color + Math.min(0.38, localAlpha * 1.2).toFixed(3) + ")";
        ctx.shadowBlur = 14;
        ctx.beginPath();
        ctx.moveTo(-sh.w * 0.5, -sh.h * 0.5);
        ctx.lineTo(sh.w * 0.5, -sh.h * 0.5);
        ctx.lineTo(sh.w * 0.5 + sh.skew, sh.h * 0.5);
        ctx.lineTo(-sh.w * 0.5 + sh.skew, sh.h * 0.5);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }

      const flash = Math.exp(-Math.pow((elapsed - 2.52) / 0.38, 2));
      if (flash > 0.015) {
        const fg = ctx.createLinearGradient(0, centerY, splashW, centerY);
        fg.addColorStop(0, "rgba(255,83,103,0)");
        fg.addColorStop(0.48, "rgba(255,255,255," + (0.20 * flash).toFixed(3) + ")");
        fg.addColorStop(0.52, "rgba(244,210,138," + (0.24 * flash).toFixed(3) + ")");
        fg.addColorStop(1, "rgba(122,215,194,0)");
        ctx.fillStyle = fg;
        ctx.fillRect(0, centerY - 46 * flash, splashW, 92 * flash);
      }
    }
    ctx.restore();
  }

  function drawFrame() {
    if (!animating || (!ctx && !gl)) return;
    rafId = requestAnimationFrame(drawFrame);
    const elapsed = (performance.now() - startedAt) / 1000;
    if (gl && glProgram) {
      drawWebgl(elapsed);
      return;
    }
    drawCanvas2d(elapsed);
  }

  function resize() {
    pixelRatio = Math.min(1.6, Math.max(1, window.devicePixelRatio || 1));
    splashW = window.innerWidth;
    splashH = window.innerHeight;
    if (!canvas) return;
    canvas.width = Math.max(1, Math.floor(splashW * pixelRatio));
    canvas.height = Math.max(1, Math.floor(splashH * pixelRatio));
    if (ctx) ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    if (gl) gl.viewport(0, 0, canvas.width, canvas.height);

    dust = [];
    streaks = [];
    shards = [];
    const count = 84;
    for (let i = 0; i < count; i++) {
      dust.push({
        x: Math.random() * splashW,
        y: Math.random() * splashH,
        vx: (Math.random() - 0.5) * 0.18,
        vy: (Math.random() - 0.5) * 0.11,
        r: Math.random() * 1.35 + 0.28,
        a: Math.random() * 0.105 + 0.025,
        p: Math.random() * Math.PI * 2,
      });
    }
    const streakColors = ["rgba(244,210,138,", "rgba(122,215,194,", "rgba(255,83,103,", "rgba(157,184,207,"];
    for (let s = 0; s < 22; s++) {
      streaks.push({
        x: Math.random() * splashW,
        y: splashH * (0.20 + Math.random() * 0.62),
        len: splashW * (0.12 + Math.random() * 0.24),
        width: 0.75 + Math.random() * 2.1,
        speed: splashW * (0.00028 + Math.random() * 0.00042),
        angle: (-10 + Math.random() * 20) * Math.PI / 180,
        phase: Math.random() * Math.PI * 2,
        color: streakColors[s % streakColors.length],
        delay: Math.random() * 1.1,
        alpha: 0.18 + Math.random() * 0.36,
      });
    }
    for (let h = 0; h < 34; h++) {
      shards.push({
        ox: (Math.random() - 0.5) * splashW * 0.92,
        oy: (Math.random() - 0.5) * splashH * 0.22,
        w: 18 + Math.random() * 86,
        h: 1 + Math.random() * 5,
        skew: (Math.random() - 0.5) * 20,
        phase: Math.random() * Math.PI * 2,
        color: streakColors[h % streakColors.length],
        alpha: 0.10 + Math.random() * 0.24,
      });
    }
  }

  onMount(() => {
    canvas = document.getElementById("splash-canvas") as HTMLCanvasElement | null;
    if (!canvas) return;
    if (initWebgl(canvas)) {
      ctx = null;
    } else {
      ctx = canvas.getContext("2d");
    }
    resize();
    resizeHandler = resize;
    window.addEventListener("resize", resize);
    drawFrame();
    armSoundFallback();
    playIntroSound();
  });

  onCleanup(() => {
    animating = false;
    if (rafId) cancelAnimationFrame(rafId);
    if (resizeHandler) window.removeEventListener("resize", resizeHandler);
    if (gl) {
      gl.getExtension("WEBGL_lose_context")?.loseContext();
      gl = null;
    }
  });
}
