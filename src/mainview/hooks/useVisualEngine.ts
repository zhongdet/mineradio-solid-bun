import { createEffect, onCleanup } from "solid-js";
import { useVisual } from "../stores/visualStore";
import { useAudio } from "../stores/audioStore";
import { useFx } from "../stores/fxStore";
import { usePerformance } from "./usePerformance";

declare const THREE: any;

const FFT_SIZE = 2048;
const BEAT_FFT_SIZE = 2048;
const SKULL_PRESET_INDEX = 6;

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

export function useVisualEngine() {
  const visual = useVisual();
  const audio = useAudio();
  const fx = useFx();
  const perf = usePerformance();

  // Three.js objects
  let scene: any = null;
  let camera: any = null;
  let renderer: any = null;
  let particles: any = null;
  let bloomParticles: any = null;
  let floatGroup: any = null;
  let backCoverGroup: any = null;
  let uniforms: any = null;
  let animFrameId: number | null = null;
  let initialized = false;
  let prevTime = 0;

  // Local audio analysis buffers (not in store for perf)
  let localFrequencyData: Uint8Array | null = null;
  let localTimeDomainData: Uint8Array | null = null;
  let localBeatFrequencyData: Uint8Array | null = null;
  let localBeatTimeDomainData: Uint8Array | null = null;

  // Peak tracking (private, per-frame, not in store)
  let bassPeak = 0.12;
  let midPeak = 0.10;
  let treblePeak = 0.08;
  let energyPeak = 0.030;
  let prevEnergy = 0;
  let beatOnsetFlag = false;
  let scheduledBeatPulse = 0;
  let scheduledBeatFlag = false;
  let beatPulseLocal = 0;

  // Mouse world
  let mouseWorld = { x: 0, y: 0 };
  let mouseActive = false;

  function initThreeJs(canvas: HTMLCanvasElement) {
    if (initialized) return;
    initialized = true;

    // Allocate local FFT buffers
    localFrequencyData = new Uint8Array(FFT_SIZE / 2);
    localTimeDomainData = new Uint8Array(FFT_SIZE);
    localBeatFrequencyData = new Uint8Array(BEAT_FFT_SIZE / 2);
    localBeatTimeDomainData = new Uint8Array(BEAT_FFT_SIZE);

    // Scene
    scene = new THREE.Scene();
    scene.background = null;

    // Camera
    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.z = 6.6;

    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true, powerPreference: "high-performance" });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(perf.getRenderPixelRatio());
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.domElement.style.background = "transparent";
    renderer.domElement.style.display = "block";
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.tabIndex = 0;

    const container = document.getElementById("canvas-container");
    if (container) {
      container.appendChild(renderer.domElement);
    }

    // Uniforms
    uniforms = {
      uTime: { value: 0 },
      uBass: { value: 0 },
      uMid: { value: 0 },
      uTreble: { value: 0 },
      uBeat: { value: 0 },
      uEnergy: { value: 0 },
      uMouseXY: { value: new THREE.Vector2(0, 0) },
      uMouseActive: { value: 0 },
      uAlpha: { value: 1.0 },
      uIntensity: { value: fx.state.intensity },
      uPixel: { value: renderer.getPixelRatio() },
      uPresetTransition: { value: 0 },
      uBurstAmt: { value: 0 },
      uParticleDim: { value: 1.0 },
      uVinylSpin: { value: 0 },
      uRipples: { value: new Float32Array(12 * 4) },
    };

    createParticles(canvas);
    createBloomParticles();

    // Resize
    const handleResize = () => {
      if (!camera || !renderer) return;
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
      if (uniforms) uniforms.uPixel.value = renderer.getPixelRatio();
    };
    window.addEventListener("resize", handleResize);

    // Pointer tracking
    const handlePointerMove = (e: MouseEvent) => {
      if (uniforms) {
        uniforms.uMouseXY.value.set(
          (e.clientX / window.innerWidth) * 2 - 1,
          -(e.clientY / window.innerHeight) * 2 + 1,
        );
      }
      mouseWorld.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouseWorld.y = -(e.clientY / window.innerHeight) * 2 + 1;
      mouseActive = true;

      // Update pointer parallax in store
      visual.set("pointerTarget", { x: mouseWorld.x * 0.3, y: mouseWorld.y * 0.2 });
    };
    const handlePointerLeave = () => { mouseActive = false; };
    window.addEventListener("mousemove", handlePointerMove);
    window.addEventListener("mouseleave", handlePointerLeave);

    // Orbit controls
    let isDragging = false;
    let lastX = 0, lastY = 0;
    const handleMouseDown = (e: MouseEvent) => {
      if (e.target === renderer.domElement) {
        isDragging = true;
        lastX = e.clientX;
        lastY = e.clientY;
      }
    };
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      visual.set("orbit", {
        userTheta: visual.state.orbit.userTheta + dx * 0.005,
        userPhi: Math.max(
          -Math.PI * 0.45,
          Math.min(Math.PI * 0.45, visual.state.orbit.userPhi - dy * 0.005),
        ),
      });
      lastX = e.clientX;
      lastY = e.clientY;
    };
    const handleMouseUp = () => { isDragging = false; };
    renderer.domElement.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    // Wheel zoom
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const newRadius = Math.max(
        2.4,
        Math.min(14.0, visual.state.orbit.userRadius + e.deltaY * 0.01),
      );
      visual.set("orbit", { userRadius: newRadius });
    };
    renderer.domElement.addEventListener("wheel", handleWheel, { passive: false });

    // Double click to recenter
    const handleDblClick = () => {
      visual.set("orbit", {
        userTheta: 0,
        userPhi: 0.08,
        userRadius: 6.6,
        recentering: true,
      });
    };
    renderer.domElement.addEventListener("dblclick", handleDblClick);

    startRenderLoop();
    console.log("[Mineradio] Three.js initialized");
  }

  function createParticles(_canvas: HTMLCanvasElement) {
    if (!scene) return;
    const particleCount = 2000;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const uvs = new Float32Array(particleCount * 2);
    const aRand = new Float32Array(particleCount);

    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 10;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 10;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 5;
      uvs[i * 2] = Math.random();
      uvs[i * 2 + 1] = Math.random();
      aRand[i] = Math.random();
    }

    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
    geometry.setAttribute("aRand", new THREE.BufferAttribute(aRand, 1));

    const material = new THREE.ShaderMaterial({
      uniforms: uniforms,
      vertexShader: `
        attribute float aRand;
        varying vec2 vUv;
        varying float vRand;
        uniform float uTime;
        uniform float uBass;
        uniform float uMid;
        uniform float uTreble;
        uniform float uEnergy;

        void main() {
          vUv = uv;
          vRand = aRand;
          vec3 pos = position;
          pos.x += sin(uTime * 0.5 + aRand * 6.28) * uMid * 0.5;
          pos.y += cos(uTime * 0.3 + aRand * 6.28) * uBass * 0.3;
          pos.z += sin(uTime * 0.7 + aRand * 3.14) * uTreble * 0.2;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
          gl_PointSize = 2.0 + uEnergy * 8.0;
        }
      `,
      fragmentShader: `
        varying vec2 vUv;
        varying float vRand;
        uniform float uTime;
        uniform float uAlpha;
        uniform float uBeat;

        void main() {
          float dist = length(vUv - 0.5) * 2.0;
          float alpha = smoothstep(1.0, 0.0, dist) * uAlpha;
          alpha *= 0.6 + uBeat * 0.4;
          gl_FragColor = vec4(1.0, 1.0, 1.0, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    particles = new THREE.Points(geometry, material);
    scene.add(particles);
  }

  function createBloomParticles() {
    if (!scene) return;
    const bloomCount = 500;
    const bloomGeo = new THREE.BufferGeometry();
    const bloomPos = new Float32Array(bloomCount * 3);
    for (let i = 0; i < bloomCount; i++) {
      bloomPos[i * 3] = (Math.random() - 0.5) * 8;
      bloomPos[i * 3 + 1] = (Math.random() - 0.5) * 8;
      bloomPos[i * 3 + 2] = Math.random() * 3;
    }
    bloomGeo.setAttribute("position", new THREE.BufferAttribute(bloomPos, 3));

    const bloomMat = new THREE.ShaderMaterial({
      uniforms: uniforms,
      vertexShader: `
        uniform float uTime;
        uniform float uEnergy;
        void main() {
          vec3 pos = position;
          pos.y += sin(uTime * 0.5 + position.x) * 0.1;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
          gl_PointSize = 1.0 + uEnergy * 3.0;
        }
      `,
      fragmentShader: `
        uniform float uAlpha;
        void main() {
          float d = length(gl_PointCoord - 0.5) * 2.0;
          float a = smoothstep(1.0, 0.0, d) * uAlpha * 0.3;
          gl_FragColor = vec4(0.8, 0.9, 1.0, a);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    bloomParticles = new THREE.Points(bloomGeo, bloomMat);
    scene.add(bloomParticles);
  }

  // ── Audio analysis helpers ──

  function beatBandRms(data: Uint8Array, sampleRate: number, fftSize: number, hz0: number, hz1: number): number {
    const binSize = sampleRate / fftSize;
    const startBin = Math.max(0, Math.floor(hz0 / binSize));
    const endBin = Math.min(data.length, Math.ceil(hz1 / binSize));
    if (endBin <= startBin) return 0;
    let sum = 0;
    for (let i = startBin; i < endBin; i++) {
      const v = data[i] / 255;
      sum += v * v;
    }
    return Math.sqrt(sum / (endBin - startBin));
  }

  function follow(cur: number, next: number, upTau: number, downTau: number, dt: number): number {
    const tau = next > cur ? upTau : downTau;
    return cur + (next - cur) * (1 - Math.exp(-dt / Math.max(0.001, tau)));
  }

  // ── processRealtimeBeatEngine (ported from app.js:1680-1863) ──

  function processRealtimeBeatEngine(dt: number): any {
    const beatAnalyser = audio.state.beatAnalyser;
    const audioCtx = audio.state.audioCtx;
    const audioEl = audio.state.audio;
    if (!beatAnalyser || !audioCtx || !audioEl || audioEl.paused) return null;
    if (!localBeatFrequencyData || !localBeatTimeDomainData) return null;

    dt = Math.max(0.001, Math.min(0.080, dt || 0.016));
    const dj = visual.state.djMode.active;

    beatAnalyser.getByteFrequencyData(localBeatFrequencyData as Uint8Array<ArrayBuffer>);
    beatAnalyser.getByteTimeDomainData(localBeatTimeDomainData as Uint8Array<ArrayBuffer>);
    const sr = audioCtx.sampleRate || 44100;
    const fftSize = beatAnalyser.fftSize;

    const sub = beatBandRms(localBeatFrequencyData, sr, fftSize, 38, 74);
    const kick = beatBandRms(localBeatFrequencyData, sr, fftSize, 52, 165);
    const body = beatBandRms(localBeatFrequencyData, sr, fftSize, 165, 420);
    const vocal = beatBandRms(localBeatFrequencyData, sr, fftSize, 420, 2600);
    const snap = beatBandRms(localBeatFrequencyData, sr, fftSize, 1800, 9200);
    const low = Math.min(1, kick * 0.86 + sub * 0.42);

    let rms = 0;
    for (let i = 0; i < localBeatTimeDomainData.length; i++) {
      const tv = (localBeatTimeDomainData[i] - 128) / 128;
      rms += tv * tv;
    }
    rms = Math.sqrt(rms / localBeatTimeDomainData.length);

    const rtBeat = visual.state.rtBeat;
    const fastMul = dj ? 0.86 : 1;
    const downMul = dj ? 0.94 : 1;
    const slowMul = dj ? 1.06 : 1;

    const subFast = follow(rtBeat.subFast, sub, 0.018 * fastMul, 0.064 * downMul, dt);
    const subSlow = follow(rtBeat.subSlow, sub, 0.320 * slowMul, 0.520 * slowMul, dt);
    const lowFast = follow(rtBeat.lowFast, low, 0.016 * fastMul, 0.070 * downMul, dt);
    const lowSlow = follow(rtBeat.lowSlow, low, 0.300 * slowMul, 0.540 * slowMul, dt);
    const bodyFast = follow(rtBeat.bodyFast, body, 0.020 * fastMul, 0.082 * downMul, dt);
    const bodySlow = follow(rtBeat.bodySlow, body, 0.360 * slowMul, 0.600 * slowMul, dt);
    const vocalFast = follow(rtBeat.vocalFast, vocal, 0.026 * fastMul, 0.090 * downMul, dt);
    const vocalSlow = follow(rtBeat.vocalSlow, vocal, 0.340 * slowMul, 0.580 * slowMul, dt);
    const snapFast = follow(rtBeat.snapFast, snap, 0.012 * fastMul, 0.060 * downMul, dt);
    const snapSlow = follow(rtBeat.snapSlow, snap, 0.300 * slowMul, 0.520 * slowMul, dt);

    const peakDecay = dj ? 0.988 : 0.990;
    const subPeak = Math.max(rtBeat.subPeak * Math.pow(peakDecay, dt * 60), sub, 0.045);
    const lowPeak = Math.max(rtBeat.lowPeak * Math.pow(dj ? 0.987 : 0.989, dt * 60), low, 0.060);
    const bodyPeak = Math.max(rtBeat.bodyPeak * Math.pow(peakDecay, dt * 60), body, 0.040);
    const vocalPeak = Math.max(rtBeat.vocalPeak * Math.pow(peakDecay, dt * 60), vocal, 0.040);
    const snapPeak = Math.max(rtBeat.snapPeak * Math.pow(peakDecay, dt * 60), snap, 0.035);

    const subFlux = Math.max(0, sub - rtBeat.prevSub);
    const lowFlux = Math.max(0, low - rtBeat.prevLow);
    const bodyFlux = Math.max(0, body - rtBeat.prevBody);
    const vocalFlux = Math.max(0, vocal - rtBeat.prevVocal);
    const snapFlux = Math.max(0, snap - rtBeat.prevSnap);
    const rmsFlux = Math.max(0, rms - rtBeat.prevRms);

    const subRise = Math.max(0, subFast - subSlow);
    const lowRise = Math.max(0, lowFast - lowSlow);
    const bodyRise = Math.max(0, bodyFast - bodySlow);
    const vocalRise = Math.max(0, vocalFast - vocalSlow);
    const snapRise = Math.max(0, snapFast - snapSlow);

    const drumOnset = subRise * 0.88 + subFlux * 0.66 + lowRise * 1.62 + lowFlux * 1.34;
    const musicalOnset = bodyRise * 0.34 + bodyFlux * 0.24 + vocalRise * 0.52 + vocalFlux * 0.36 + snapRise * 0.08 + snapFlux * 0.06 + rmsFlux * 0.20;
    const onset = dj ? drumOnset * 1.05 + musicalOnset * 0.07 : drumOnset + musicalOnset * 0.16;

    const avgTau = onset > rtBeat.onsetAvg ? (dj ? 0.88 : 1.10) : (dj ? 0.30 : 0.34);
    const onsetAvg = follow(rtBeat.onsetAvg, onset, avgTau, avgTau, dt);
    const onsetPeak = Math.max(rtBeat.onsetPeak * Math.pow(dj ? 0.986 : 0.988, dt * 60), onset, 0.032);

    const floor = onsetAvg * (dj ? 0.88 : 0.84);
    const score = clamp01((onset - floor) / Math.max(dj ? 0.013 : 0.014, onsetPeak - floor));

    const subNorm = clamp01(sub / Math.max(0.045, subPeak * (dj ? 0.72 : 0.70)));
    const lowNorm = clamp01(low / Math.max(0.060, lowPeak * (dj ? 0.74 : 0.72)));
    const bodyNorm = clamp01(body / Math.max(0.045, bodyPeak * (dj ? 0.74 : 0.72)));
    const vocalNorm = clamp01(vocal / Math.max(0.045, vocalPeak * 0.72));
    const snapNorm = clamp01(snap / Math.max(0.040, snapPeak * (dj ? 0.78 : 0.72)));

    const nowT = audioEl.currentTime || 0;
    const primedFrames = rtBeat.primedFrames + 1;
    const warmingUp = nowT < rtBeat.warmupUntil || primedFrames < (dj ? 8 : 18);
    const gapFromLast = nowT - rtBeat.lastHitAt;
    const expectedGap = rtBeat.tempoGap > 0 ? rtBeat.tempoGap : 0;
    const phaseWindow = expectedGap > 0 ? Math.max(0.055, Math.min(0.105, expectedGap * 0.16)) : 0;
    const tempoDue = expectedGap > 0 && gapFromLast > expectedGap - phaseWindow && gapFromLast < expectedGap + phaseWindow;

    const lowPresence = Math.max(lowNorm, subNorm * 0.74);
    const lowAttack = lowRise + lowFlux * 0.72 + subRise * 0.58 + subFlux * 0.40;
    const lowDominance = low / Math.max(0.001, vocal * 0.84 + body * 0.36 + snap * 0.10);
    const lowFluxDominance = (lowFlux + subFlux * 0.58) / Math.max(0.001, vocalFlux * 0.72 + bodyFlux * 0.42 + snapFlux * 0.16);

    const voiceMask = dj
      ? (vocalNorm > 0.62 && lowDominance < 0.92 && lowFluxDominance < 1.06 && subNorm < 0.54)
      : (vocalNorm > 0.58 && lowDominance < 0.86 && lowFluxDominance < 1.10);

    let drumGate = lowPresence > (dj ? 0.42 : 0.38) && lowAttack > Math.max(dj ? 0.015 : 0.014, onsetAvg * (dj ? 0.38 : 0.34)) && !voiceMask;
    drumGate = drumGate && (lowDominance > (dj ? 0.86 : 0.72) || lowFluxDominance > (dj ? 1.14 : 1.02) || subNorm > (dj ? 0.62 : 0.56));

    const strongTransient = drumGate && score > (dj ? 0.55 : 0.54) && drumOnset > onsetAvg * (dj ? 0.92 : 0.84);
    const kickTransient = drumGate && score > (dj ? 0.43 : 0.40) && lowAttack > Math.max(dj ? 0.020 : 0.018, onsetAvg * (dj ? 0.54 : 0.46));
    const tempoAssist = tempoDue && rtBeat.tempoConfidence > (dj ? 0.40 : 0.42) && drumGate && lowPresence > (dj ? 0.48 : 0) && score > (dj ? 0.30 : 0.22) && lowAttack > Math.max(0.016, onsetAvg * (dj ? 0.44 : 0.34));

    let candidateHit = strongTransient || kickTransient || tempoAssist;
    if (warmingUp) candidateHit = false;

    const hasTempoLock = expectedGap >= (dj ? 0.32 : 0.42) && expectedGap <= (dj ? 0.92 : 0.88) && rtBeat.tempoConfidence > (dj ? 0.36 : 0.38);
    const lockedWindow = hasTempoLock ? Math.max(0.070, Math.min(0.110, expectedGap * 0.16)) : 0;
    const gapRaw = nowT - rtBeat.lastHitAt;

    let rhythmAccept = false;
    if (candidateHit) {
      if (rtBeat.lastHitAt < 0) {
        rhythmAccept = strongTransient && score > (dj ? 0.58 : 0.62) && lowPresence > (dj ? 0.50 : 0.48);
      } else if (hasTempoLock) {
        const oneBeatErr = Math.abs(gapRaw - expectedGap);
        const twoBeatErr = Math.abs(gapRaw - expectedGap * 2);
        rhythmAccept = oneBeatErr <= lockedWindow && (kickTransient || strongTransient);
        rhythmAccept = rhythmAccept || (twoBeatErr <= lockedWindow * 1.35 && strongTransient && score > (dj ? 0.54 : 0.58));
        rhythmAccept = rhythmAccept || (gapRaw > expectedGap * 1.55 && strongTransient && lowPresence > (dj ? 0.50 : 0.44));
        if (dj) {
          rhythmAccept = rhythmAccept || (gapRaw > expectedGap * 1.24 && strongTransient && score > 0.56 && lowDominance > 0.92);
        }
      } else {
        rhythmAccept = gapRaw >= (dj ? 0.340 : 0.460) && strongTransient && score > (dj ? 0.56 : 0.58) && lowPresence > (dj ? 0.50 : 0.44);
      }
    }

    let hit = candidateHit && rhythmAccept;

    const minGap = hasTempoLock ? Math.max(dj ? 0.315 : 0.400, Math.min(dj ? 0.500 : 0.540, expectedGap * (dj ? 0.64 : 0.72))) : (dj ? 0.340 : 0.460);
    if (hit && gapRaw < minGap) {
      hit = false;
    }

    let tempoGap = rtBeat.tempoGap;
    let tempoConfidence = rtBeat.tempoConfidence;

    if (!hit) {
      if (dj) {
        visual.set("djMode", { ...visual.state.djMode, tempoGap, tempoConfidence });
      }
      return { hit: false, score, low: lowNorm, body: bodyNorm, vocal: vocalNorm, snap: snapNorm, tempoConfidence };
    }

    // Tempo tracking
    if (rtBeat.lastHitAt > 0) {
      let gap = nowT - rtBeat.lastHitAt;
      while (gap > (dj ? 0.96 : 0.88)) gap *= 0.5;
      while (gap < (dj ? 0.32 : 0.42)) gap *= 2.0;
      if (gap >= (dj ? 0.32 : 0.42) && gap <= (dj ? 0.96 : 0.88)) {
        const tempoEase = hasTempoLock ? (dj ? 0.12 : 0.10) : (dj ? 0.24 : 0.22);
        tempoGap = tempoGap ? tempoGap * (1 - tempoEase) + gap * tempoEase : gap;
        tempoConfidence = Math.min(1, tempoConfidence + (tempoAssist ? 0.04 : 0.18));
      }
    }

    const beatCount = rtBeat.beatCount + 1;
    const strength = dj
      ? clamp01(0.18 + score * 0.38 + lowPresence * 0.34 + Math.min(1.35, lowDominance) * 0.08 + rmsFlux * 0.72)
      : clamp01(0.24 + score * 0.36 + lowPresence * 0.34 + Math.min(1.25, lowDominance) * 0.07 + rmsFlux * 0.95);

    const comboSlot = (beatCount - 1) % 4;
    let combo = comboSlot === 0 ? "downbeat" : comboSlot === 1 ? "push" : comboSlot === 2 ? "drop" : "rebound";
    if (strength > 0.84 && comboSlot !== 0) combo = "accent";

    // Update store
    visual.set("rtBeat", {
      ...rtBeat,
      subFast, subSlow, lowFast, lowSlow, bodyFast, bodySlow,
      vocalFast, vocalSlow, snapFast, snapSlow,
      prevSub: sub, prevLow: low, prevBody: body, prevVocal: vocal, prevSnap: snap, prevRms: rms,
      subPeak, lowPeak, bodyPeak, vocalPeak, snapPeak,
      onsetAvg, onsetPeak,
      lastHitAt: nowT,
      beatCount,
      primedFrames,
      tempoGap,
      tempoConfidence,
      pulse: Math.max(rtBeat.pulse, strength),
      score,
      stats: {
        ...rtBeat.stats,
        hits: rtBeat.stats.hits + 1,
        strong: rtBeat.stats.strong + (strongTransient || kickTransient ? 1 : 0),
        assisted: rtBeat.stats.assisted + (tempoAssist ? 1 : 0),
      },
    });

    if (dj) {
      visual.set("djMode", {
        ...visual.state.djMode,
        tempoGap,
        tempoConfidence,
        lastBeatAt: nowT,
      });
    }

    return {
      hit: true,
      time: dj ? Math.max(0, nowT - 0.026) : nowT,
      strength,
      confidence: dj ? clamp01(score * 0.58 + lowPresence * 0.30 + tempoConfidence * 0.12) : clamp01(score * 0.62 + lowPresence * 0.26 + tempoConfidence * 0.12),
      low: Math.max(0.05, lowPresence),
      body: Math.max(0.02, bodyNorm * (dj ? 0.50 : 0.62)),
      snap: Math.max(0.02, snapNorm * (dj ? 0.86 : 1)),
      mass: dj ? clamp01(lowPresence * 0.84 + bodyNorm * 0.10) : clamp01(lowPresence * 0.76 + bodyNorm * 0.20),
      sharpness: dj ? clamp01(snapNorm * 0.58 + bodyNorm * 0.10) : clamp01(snapNorm * 0.70 + bodyNorm * 0.12),
      tempoAssist,
      tempoGap,
      combo,
      score,
      lowDominance,
      lowDominanceRaw: low / Math.max(0.001, vocal * 0.84 + body * 0.36 + snap * 0.10),
      dj,
    };
  }

  // ── Main render loop (ported from app.js:23383-23624) ──

  function startRenderLoop() {
    prevTime = performance.now();

    function animate() {
      animFrameId = requestAnimationFrame(animate);

      const now = performance.now();
      if (perf.shouldSkipFrame()) return;
      const dt = Math.min((now - prevTime) / 1000, 0.05);
      prevTime = now;
      perf.markRenderFrame();

      uniforms.uTime.value += dt;

      // Pointer parallax smoothing
      const pTarget = visual.state.pointerTarget;
      const pCurrent = visual.state.pointerParallax;
      visual.set("pointerParallax", {
        x: pCurrent.x + (pTarget.x - pCurrent.x) * 0.040,
        y: pCurrent.y + (pTarget.y - pCurrent.y) * 0.040,
      });

      beatOnsetFlag = false;

      const analyser = audio.state.analyser;
      const audioEl = audio.state.audio;

      if (analyser && audio.state.audioReady && audioEl && !audioEl.paused && localFrequencyData && localTimeDomainData) {
        if (audio.state.audioCtx && audio.state.audioCtx.state === "suspended") {
          audio.state.audioCtx.resume().catch(() => {});
        }

        analyser.getByteFrequencyData(localFrequencyData as Uint8Array<ArrayBuffer>);
        analyser.getByteTimeDomainData(localTimeDomainData as Uint8Array<ArrayBuffer>);
        const len = localFrequencyData.length;

        const kickEnd = 7;
        const vocalEnd = Math.min(len, 140);
        const midEnd = Math.min(len, 280);

        let bKick = 0, mInst = 0, tHigh = 0, voc = 0, rms = 0;
        for (let i = 0; i < kickEnd; i++) bKick += localFrequencyData[i] / 255;
        for (let i = kickEnd; i < vocalEnd; i++) voc += localFrequencyData[i] / 255;
        for (let i = vocalEnd; i < midEnd; i++) mInst += localFrequencyData[i] / 255;
        for (let i = midEnd; i < len; i++) tHigh += localFrequencyData[i] / 255;
        for (let j = 0; j < localTimeDomainData.length; j++) {
          const tv = (localTimeDomainData[j] - 128) / 128;
          rms += tv * tv;
        }

        bKick /= kickEnd;
        voc /= (vocalEnd - kickEnd);
        mInst /= Math.max(1, midEnd - vocalEnd);
        tHigh /= Math.max(1, len - midEnd);
        rms = Math.sqrt(rms / localTimeDomainData.length);

        bassPeak = Math.max(bassPeak * 0.994, bKick, 0.030);
        midPeak = Math.max(midPeak * 0.993, mInst, 0.026);
        treblePeak = Math.max(treblePeak * 0.992, tHigh, 0.018);
        energyPeak = Math.max(energyPeak * 0.995, rms, 0.030);

        const rb = Math.min(1, Math.pow(bKick / Math.max(0.038, bassPeak * 0.66), 0.78));
        const rm = Math.min(1, Math.pow(mInst / Math.max(0.025, midPeak * 0.70), 0.86));
        const rt = Math.min(1, Math.pow(tHigh / Math.max(0.020, treblePeak * 0.74), 0.92));
        const re = Math.min(1, Math.pow(rms / Math.max(0.034, energyPeak * 0.68), 0.82));
        const bassOnset = Math.max(0, rb - visual.state.smoothBass);
        const energyOnset = Math.max(0, re - prevEnergy);
        prevEnergy = prevEnergy * 0.88 + re * 0.12;

        const realtimeBeat = processRealtimeBeatEngine(dt);

        if (realtimeBeat && realtimeBeat.hit) {
          const waitingForBeatMap = !visual.state.currentBeatMap && (visual.state.beatMapBusy || (audioEl.currentTime || 0) < 18);
          const liveKickFrame = realtimeBeat.low > 0.50 && rb > 0.42 && bassOnset > 0.070 && energyOnset > 0.016;
          const liveStrongHit = realtimeBeat.confidence > 0.76 && realtimeBeat.strength > 0.70 && realtimeBeat.score > 0.56 && liveKickFrame;
          const liveTempoHit = realtimeBeat.tempoAssist && realtimeBeat.confidence > 0.80 && realtimeBeat.strength > 0.66 && realtimeBeat.low > 0.50 && bassOnset > 0.052;
          const liveFallbackOk = waitingForBeatMap ? (liveStrongHit || liveTempoHit) : (realtimeBeat.confidence > 0.84 && realtimeBeat.strength > 0.80 && realtimeBeat.low > 0.54 && (liveKickFrame || realtimeBeat.score > 0.68));

          if (liveFallbackOk) {
            const previewPulseScale = waitingForBeatMap ? 0.68 : 1;
            const rtPulse = Math.min(waitingForBeatMap ? 0.46 : 0.62, realtimeBeat.strength * (realtimeBeat.tempoAssist ? 0.62 : 0.68) * previewPulseScale);
            if (rtPulse > beatPulseLocal + 0.09) beatOnsetFlag = true;
            beatPulseLocal = Math.max(beatPulseLocal, rtPulse);
          }
        } else if (bassOnset > 0.075 && rb > 0.32 && energyOnset > 0.020) {
          beatPulseLocal = Math.max(beatPulseLocal, Math.min(0.12, bassOnset * 0.18));
        }

        beatPulseLocal *= Math.pow(0.36, dt);

        if (scheduledBeatFlag) {
          beatOnsetFlag = true;
          scheduledBeatFlag = false;
        }
        if (scheduledBeatPulse > beatPulseLocal) beatPulseLocal = scheduledBeatPulse;
        scheduledBeatPulse *= Math.pow(0.32, dt);

        function env(prev: number, next: number, attack: number, release: number): number {
          const k = next > prev ? attack : release;
          return prev + (next - prev) * k;
        }

        const smoothBass = env(visual.state.smoothBass, Math.min(0.82, rb * 0.78 + re * 0.025), 0.28, 0.075);
        const smoothMid = env(visual.state.smoothMid, Math.min(0.68, rm * 0.64 + re * 0.025), 0.18, 0.060);
        const smoothTreb = env(visual.state.smoothTreb, Math.min(0.56, rt * 0.54), 0.18, 0.055);
        const smoothEnergy = env(visual.state.smoothEnergy, Math.min(0.72, re), 0.16, 0.055);

        visual.set({
          smoothBass, smoothMid, smoothTreb, smoothEnergy,
          beatPulse: beatPulseLocal,
          beatOnsetFlag,
        });

        // Lyric sun energy
        const sunEnergy = clamp01((smoothEnergy - 0.18) / 0.38);
        const sunVoice = clamp01((voc - 0.11) / 0.34);
        const sunMelody = clamp01((smoothMid - 0.16) / 0.27);
        const sunAir = clamp01((smoothTreb - 0.105) / 0.17);
        let sunRaw = clamp01(sunEnergy * 0.36 + sunVoice * 0.18 + sunMelody * 0.26 + sunAir * 0.20);
        sunRaw = sunRaw * sunRaw * (3 - 2 * sunRaw);
        let lyricSunAvg = visual.state.lyricSunAvg + (sunRaw - visual.state.lyricSunAvg) * 0.006;
        const lyricSunPeak = Math.max(0.48, visual.state.lyricSunPeak * 0.9985, sunRaw);
        const sunThreshold = Math.max(0.78, lyricSunAvg + 0.20, lyricSunPeak * 0.74);
        let sunGate = clamp01((sunRaw - sunThreshold) / Math.max(0.08, 1.0 - sunThreshold));
        sunGate = sunGate * sunGate * (3 - 2 * sunGate);
        let lyricSunHold = visual.state.lyricSunHold + (sunGate - visual.state.lyricSunHold) * (sunGate > visual.state.lyricSunHold ? 0.035 : 0.014);
        const lyricSunTarget = lyricSunHold > 0.16 ? clamp01((lyricSunHold - 0.16) / 0.84) : 0;
        const lyricSunEnergy = visual.state.lyricSunEnergy + (lyricSunTarget - visual.state.lyricSunEnergy) * (lyricSunTarget > visual.state.lyricSunEnergy ? 0.075 : 0.030);

        visual.set({ lyricSunAvg, lyricSunPeak, lyricSunHold, lyricSunTarget, lyricSunEnergy });
      } else {
        // Not playing — decay
        visual.set({
          smoothBass: visual.state.smoothBass * 0.91,
          smoothMid: visual.state.smoothMid * 0.91,
          smoothTreb: visual.state.smoothTreb * 0.91,
          smoothEnergy: visual.state.smoothEnergy * 0.91,
          beatPulse: visual.state.beatPulse * 0.82,
          lyricSunTarget: 0,
          lyricSunHold: visual.state.lyricSunHold * 0.90,
          lyricSunEnergy: visual.state.lyricSunEnergy * 0.92,
          lyricSunAvg: visual.state.lyricSunAvg * 0.995,
          lyricSunPeak: Math.max(0.48, visual.state.lyricSunPeak * 0.997),
        });
      }

      // Final bass/mid/treble with intensity scaling
      const fxBass = Math.min(0.90, visual.state.smoothBass * 1.05 + visual.state.beatPulse * 0.18) * fx.state.intensity;
      const fxMid = Math.min(0.72, visual.state.smoothMid * 1.12) * fx.state.intensity;
      const fxTreble = Math.min(0.62, visual.state.smoothTreb * 1.20) * fx.state.intensity;
      const fxAudioEnergy = Math.max(visual.state.smoothEnergy, visual.state.beatPulse * 0.30);

      visual.set({
        bass: fxBass,
        mid: fxMid,
        treble: fxTreble,
        audioEnergy: fxAudioEnergy,
      });

      // Uniforms
      uniforms.uBass.value = fxBass;
      uniforms.uMid.value = fxMid;
      uniforms.uTreble.value = fxTreble;
      uniforms.uBeat.value = visual.state.beatPulse;
      uniforms.uEnergy.value = fxAudioEnergy;
      uniforms.uMouseActive.value = mouseActive ? 1 : 0;

      // Particle dim
      const skullBackdropDim = fx.state.preset === SKULL_PRESET_INDEX ? 0.58 : 1;
      const shelfDimTarget = skullBackdropDim;
      const shelfDimEase = shelfDimTarget < uniforms.uParticleDim.value ? 0.18 : 0.10;
      uniforms.uParticleDim.value += (shelfDimTarget - uniforms.uParticleDim.value) * Math.min(1, shelfDimEase * Math.max(1, dt * 60));
      uniforms.uBurstAmt.value *= 0.90;

      // Vinyl spin
      const vinylSpeedMul = isFinite(fx.state.speed) ? Math.max(0.05, fx.state.speed) : 1;
      const vinylSpinSpeed = (0.40 + visual.state.smoothBass * 0.09) * vinylSpeedMul;
      uniforms.uVinylSpin.value = (uniforms.uVinylSpin.value + dt * vinylSpinSpeed) % (Math.PI * 2);

      // Particle visibility
      const skullPresetActive = fx.state.preset === SKULL_PRESET_INDEX;
      if (particles) {
        particles.visible = !skullPresetActive;
        const targetRotY = (visual.state.headParallax.active ? visual.state.headParallax.x * 0.5 : 0) + visual.state.gestureRotation.y;
        const targetRotX = (visual.state.headParallax.active ? -visual.state.headParallax.y * 0.35 : 0) + visual.state.gestureRotation.x;
        particles.rotation.y += (targetRotY - particles.rotation.y) * 0.055;
        particles.rotation.x += (targetRotX - particles.rotation.x) * 0.055;
      }
      if (bloomParticles) {
        bloomParticles.visible = !skullPresetActive && fx.state.bloom && fx.state.bloomStrength > 0.01;
        if (particles) bloomParticles.rotation.copy(particles.rotation);
      }
      if (floatGroup) {
        floatGroup.visible = !skullPresetActive;
        if (particles) floatGroup.rotation.copy(particles.rotation);
      }
      if (backCoverGroup) {
        backCoverGroup.visible = !skullPresetActive;
        if (particles) backCoverGroup.rotation.copy(particles.rotation);
      }

      // Orbit camera
      const orbit = visual.state.orbit;
      const theta = orbit.userTheta;
      const phi = orbit.userPhi;
      const radius = orbit.userRadius;
      if (camera) {
        camera.position.x = radius * Math.sin(theta) * Math.cos(phi);
        camera.position.y = radius * Math.sin(phi);
        camera.position.z = radius * Math.cos(theta) * Math.cos(phi);
        camera.lookAt(orbit.lookAt.x, orbit.lookAt.y, orbit.lookAt.z);
      }

      // Thumbnail pulse
      if (visual.state.currentBeatMap || beatPulseLocal > 0.01) {
        const s = 1 + fxBass * 0.08;
        const thumbCoverEl = document.getElementById("thumb-cover");
        if (thumbCoverEl) thumbCoverEl.style.transform = "scale(" + s + ")";
      }

      renderer.render(scene, camera);
    }

    animate();
  }

  function dispose() {
    if (animFrameId) cancelAnimationFrame(animFrameId);
    if (renderer) {
      renderer.dispose();
      const container = document.getElementById("canvas-container");
      if (container && renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    }
    initialized = false;
    console.log("[Mineradio] Three.js disposed");
  }

  // Auto-init when canvas container is ready
  createEffect(() => {
    const container = document.getElementById("canvas-container");
    if (container && !initialized) {
      initThreeJs(document.createElement("canvas"));
    }
  });

  onCleanup(() => {
    dispose();
  });

  return { dispose };
}

export type VisualEngineHook = ReturnType<typeof useVisualEngine>;
