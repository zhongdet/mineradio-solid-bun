// @ts-nocheck
import { createSignal } from "solid-js";
import { useFx } from "../stores/fxStore";
import { useVisual } from "../stores/visualStore";

declare const THREE: any;

interface HandLandmark {
  x: number;
  y: number;
  z: number;
}

const PLANE_SIZE = 4.2;

function palmCenter(landmarks: HandLandmark[]): { x: number; y: number } {
  const wrist = landmarks[0];
  const mcp3 = landmarks[5];
  const mcp9 = landmarks[9];
  const mcp13 = landmarks[13];
  const mcp17 = landmarks[17];
  return {
    x: (wrist.x + mcp3.x + mcp9.x + mcp13.x + mcp17.x) / 5,
    y: (wrist.y + mcp3.y + mcp9.y + mcp13.y + mcp17.y) / 5,
  };
}

function pinchDistance(lm: HandLandmark[]): number {
  const thumb = lm[4];
  const index = lm[8];
  return Math.sqrt(
    (thumb.x - index.x) ** 2 +
    (thumb.y - index.y) ** 2 +
    (thumb.z - index.z) ** 2
  );
}

function handOpenness(lm: HandLandmark[]): number {
  const fingerTips = [8, 12, 16, 20];
  const fingerMcps = [5, 9, 13, 17];
  let totalDist = 0;
  for (let i = 0; i < 4; i++) {
    const tip = lm[fingerTips[i]];
    const mcp = lm[fingerMcps[i]];
    totalDist += Math.sqrt((tip.x - mcp.x) ** 2 + (tip.y - mcp.y) ** 2);
  }
  return Math.min(1, totalDist / 0.35);
}

function gripStrength(lm: HandLandmark[]): number {
  const tips = [4, 8, 12, 16, 20];
  const mcps = [2, 5, 9, 13, 17];
  let totalDist = 0;
  const palm = palmCenter(lm);
  for (let i = 0; i < 5; i++) {
    const tip = lm[tips[i]];
    const mcp = lm[mcps[i]];
    const tipDist = Math.sqrt((tip.x - palm.x) ** 2 + (tip.y - palm.y) ** 2);
    const mcpDist = Math.sqrt((mcp.x - palm.x) ** 2 + (mcp.y - palm.y) ** 2);
    if (mcpDist > 0.01) totalDist += tipDist / mcpDist;
  }
  return Math.max(0, Math.min(1, 1 - totalDist / 3));
}

export function useGesture() {
  const fx = useFx();
  const visual = useVisual();

  const [gestureLabel, setGestureLabel] = createSignal("待命");
  const [handActive, setHandActive] = createSignal(false);
  const [palmX, setPalmX] = createSignal(0);
  const [palmY, setPalmY] = createSignal(0);
  const [gripVal, setGripVal] = createSignal(0);
  const [pinchVal, setPinchVal] = createSignal(0);

  let videoEl: HTMLVideoElement | null = null;
  let handsLib: any = null;
  let cameraLib: any = null;
  let stream: MediaStream | null = null;
  let running = false;
  let smoothX = 0;
  let smoothY = 0;
  let smoothActive = 0;
  let smoothGrip = 0;

  function loadScript(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${url}"]`)) { resolve(); return; }
      const s = document.createElement("script");
      s.src = url;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error(`Failed to load ${url}`));
      document.head.appendChild(s);
    });
  }

  async function start() {
    if (running) return;
    running = true;

    try {
      // Load MediaPipe scripts
      await loadScript("https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js");
      await loadScript("https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js");

      const Hands = (window as any).Hands;
      const Camera = (window as any).Camera;

      if (!Hands || !Camera) {
        console.warn("[Gesture] MediaPipe not available");
        running = false;
        return;
      }

      // Create hidden video element
      videoEl = document.createElement("video");
      videoEl.playsInline = true;
      videoEl.muted = true;
      videoEl.style.display = "none";
      document.body.appendChild(videoEl);

      // Init MediaPipe Hands
      handsLib = new Hands({
        locateFile: (f: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}`,
      });
      handsLib.setOptions({
        maxNumHands: 1,
        modelComplexity: 1,
        minDetectionConfidence: 0.7,
        minTrackingConfidence: 0.7,
      });
      handsLib.onResults(onHandResults);

      // Start camera
      cameraLib = new Camera(videoEl, {
        onFrame: async () => {
          if (handsLib && videoEl) await handsLib.send({ image: videoEl });
        },
        width: 480,
        height: 360,
      });
      await cameraLib.start();
    } catch (e) {
      console.warn("[Gesture] Failed to start:", e);
      running = false;
    }
  }

  function stop() {
    running = false;
    if (cameraLib) { try { cameraLib.stop(); } catch {} }
    if (stream) { stream.getTracks().forEach((t) => t.stop()); stream = null; }
    if (videoEl && videoEl.parentNode) videoEl.parentNode.removeChild(videoEl);
    videoEl = null;
    handsLib = null;
    cameraLib = null;
  }

  function onHandResults(results: any) {
    if (!results.multiHandLandmarks || !results.multiHandLandmarks.length) {
      setHandActive(false);
      setGestureLabel("未检测到");
      return;
    }

    const lm = results.multiHandLandmarks[0];
    const palm = palmCenter(lm);
    const ndcX = palm.x * 2 - 1;
    const ndcY = -(palm.y * 2 - 1);
    const handLocalX = ndcX * PLANE_SIZE * 0.62;
    const handLocalY = ndcY * PLANE_SIZE * 0.62;

    // Smooth position
    smoothX += (handLocalX - smoothX) * 0.48;
    smoothY += (handLocalY - smoothY) * 0.48;
    setPalmX(smoothX);
    setPalmY(smoothY);
    setHandActive(true);

    // Detect gesture
    const pinch = pinchDistance(lm);
    const openness = handOpenness(lm);
    const grip = gripStrength(lm);

    smoothGrip += (grip - smoothGrip) * 0.3;
    setGripVal(smoothGrip);
    setPinchVal(pinch);

    if (pinch < 0.075 && openness > 0.28) {
      setGestureLabel("捏合拖动");
    } else if (grip > 0.68) {
      setGestureLabel("握拳收束");
    } else if (openness > 0.62) {
      setGestureLabel("张开推送");
    } else {
      setGestureLabel("悬停");
    }
  }

  // Expose hand state for shader uniforms
  function getHandState() {
    return {
      active: handActive(),
      x: palmX(),
      y: palmY(),
      grip: gripVal(),
      pinch: pinchVal(),
      label: gestureLabel(),
    };
  }

  return {
    start,
    stop,
    getHandState,
    gestureLabel,
    handActive,
    palmX,
    palmY,
    gripVal,
    pinchVal,
  };
}

export type GestureHook = ReturnType<typeof useGesture>;
