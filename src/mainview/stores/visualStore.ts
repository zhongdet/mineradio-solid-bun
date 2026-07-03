import { createStore } from "solid-js/store";

// Beat camera / beat detection state from app.js
export interface BeatCam {
  nextIdx: number;
  events: any[];
  punch: number;
  lookahead: number;
  lastTriggerAt: number;
  lastRealtimeAt: number;
  minInterval: number;
  fallbackMinInterval: number;
  realtimeMinInterval: number;
  realtimeMergeWindow: number;
  attack: number;
  hold: number;
  release: number;
  thetaKick: number;
  phiKick: number;
  radiusKick: number;
  rollKick: number;
  prevAudioTime: number;
  pulse: number;
  stats: { map: number; live: number; merged: number; liveBlocked: number };
}

export interface RtBeat {
  subFast: number;
  subSlow: number;
  lowFast: number;
  lowSlow: number;
  bodyFast: number;
  bodySlow: number;
  vocalFast: number;
  vocalSlow: number;
  snapFast: number;
  snapSlow: number;
  prevSub: number;
  prevLow: number;
  prevBody: number;
  prevVocal: number;
  prevSnap: number;
  prevRms: number;
  onsetAvg: number;
  onsetPeak: number;
  subPeak: number;
  lowPeak: number;
  bodyPeak: number;
  vocalPeak: number;
  snapPeak: number;
  lastHitAt: number;
  tempoGap: number;
  tempoConfidence: number;
  beatCount: number;
  primedFrames: number;
  warmupUntil: number;
  pulse: number;
  score: number;
  stats: { hits: number; blocked: number; assisted: number; strong: number; rejected: number };
}

export interface CinemaDynamics {
  avg: number;
  lowAvg: number;
  peak: number;
  scale: number;
}

export interface CinemaTrackProfile {
  scale: number;
  target: number;
  nameHint: number;
  frames: number;
  energyAvg: number;
  lowAvg: number;
  vocalAvg: number;
  melodyAvg: number;
  punchPeak: number;
  density: number;
}

export interface DjMode {
  active: boolean;
  songKey: string;
  startedAt: number;
  lastNoticeAt: number;
  tempoGap: number;
  tempoConfidence: number;
  sectionEnergy: number;
  sectionLow: number;
  sectionChange: number;
  visualPulse: number;
  lastBeatAt: number;
}

export interface VisualStore {
  // FFT energy values
  bass: number;
  mid: number;
  treble: number;
  audioEnergy: number;
  beatPulse: number;
  // Smoothed values
  smoothBass: number;
  smoothMid: number;
  smoothTreb: number;
  smoothEnergy: number;
  // Beat detection
  beatOnsetFlag: boolean;
  lastStrongDrop: number;
  beatCam: BeatCam;
  rtBeat: RtBeat;
  cinemaDynamics: CinemaDynamics;
  cinemaTrackProfile: CinemaTrackProfile;
  djMode: DjMode;
  // Lyric sun
  lyricSunEnergy: number;
  lyricSunTarget: number;
  lyricSunHold: number;
  lyricSunAvg: number;
  lyricSunPeak: number;
  // Mouse / parallax
  pointerParallax: { x: number; y: number };
  pointerTarget: { x: number; y: number };
  headParallax: { x: number; y: number; active: boolean };
  // Particles rotation (exposed for shelf binding)
  particlesRotation: { x: number; y: number; z: number };
  // Particle alpha target for homepage wallpaper fade-in
  particleAlphaTarget: number;
  // Gesture rotation
  gestureRotation: { x: number; y: number; inertia: number };
  // Cover texture for Three.js
  coverTextureUrl: string;
  coverTextureCanvas: HTMLCanvasElement | null;
  // Beat map
  beatMapNextIdx: number;
  beatMapToken: number;
  beatMapBusy: boolean;
  beatMapCache: Record<string, any>;
  currentBeatMap: any;
  djBeatMapCache: Record<string, any>;
  currentDjBeatMap: any;
  djBeatMapNextIdx: number;
  djBeatPulseNextIdx: number;
  // Camera
  orbit: {
    userTheta: number;
    userPhi: number;
    userRadius: number;
    theta: number;
    phi: number;
    radius: number;
    rotating: boolean;
    recentering: boolean;
    lookAt: { x: number; y: number; z: number };
    focus: { active: boolean; type: string | null; theta: number; phi: number; radius: number; lookAt: { x: number; y: number; z: number } };
    glowFollowX: number;
    glowFollowY: number;
    glowFollowRoll: number;
    beatGlow: number;
  };
  camPunch: number;
  cinemaT: number;
}

const [visual, setVisual] = createStore<VisualStore>({
  bass: 0,
  mid: 0,
  treble: 0,
  audioEnergy: 0,
  beatPulse: 0,
  smoothBass: 0,
  smoothMid: 0,
  smoothTreb: 0,
  smoothEnergy: 0,
  beatOnsetFlag: false,
  lastStrongDrop: 0,
  beatCam: {
    nextIdx: 0,
    events: [],
    punch: 0,
    lookahead: 0.075,
    lastTriggerAt: -10,
    lastRealtimeAt: -10,
    minInterval: 0.500,
    fallbackMinInterval: 0.320,
    realtimeMinInterval: 0.460,
    realtimeMergeWindow: 0.135,
    attack: 0.028,
    hold: 0.030,
    release: 0.185,
    thetaKick: 0,
    phiKick: 0,
    radiusKick: 0,
    rollKick: 0,
    prevAudioTime: -1,
    pulse: 0,
    stats: { map: 0, live: 0, merged: 0, liveBlocked: 0 },
  },
  rtBeat: {
    subFast: 0, subSlow: 0, lowFast: 0, lowSlow: 0,
    bodyFast: 0, bodySlow: 0, vocalFast: 0, vocalSlow: 0,
    snapFast: 0, snapSlow: 0,
    prevSub: 0, prevLow: 0, prevBody: 0, prevVocal: 0, prevSnap: 0, prevRms: 0,
    onsetAvg: 0.012, onsetPeak: 0.060,
    subPeak: 0.14, lowPeak: 0.18, bodyPeak: 0.16, vocalPeak: 0.16, snapPeak: 0.14,
    lastHitAt: -10, tempoGap: 0, tempoConfidence: 0, beatCount: 0,
    primedFrames: 0, warmupUntil: 0, pulse: 0, score: 0,
    stats: { hits: 0, blocked: 0, assisted: 0, strong: 0, rejected: 0 },
  },
  cinemaDynamics: { avg: 0, lowAvg: 0, peak: 0.30, scale: 0.82 },
  cinemaTrackProfile: {
    scale: 1.0, target: 1.0, nameHint: 1.0, frames: 0,
    energyAvg: 0, lowAvg: 0, vocalAvg: 0, melodyAvg: 0, punchPeak: 0.10, density: 0,
  },
  djMode: {
    active: false, songKey: '', startedAt: 0, lastNoticeAt: -100000,
    tempoGap: 0, tempoConfidence: 0, sectionEnergy: 0, sectionLow: 0,
    sectionChange: 0, visualPulse: 0, lastBeatAt: -10,
  },
  lyricSunEnergy: 0,
  lyricSunTarget: 0,
  lyricSunHold: 0,
  lyricSunAvg: 0,
  lyricSunPeak: 0.55,
  pointerParallax: { x: 0, y: 0 },
  particlesRotation: { x: 0, y: 0, z: 0 },
  particleAlphaTarget: 0,
  pointerTarget: { x: 0, y: 0 },
  headParallax: { x: 0, y: 0, active: false },
  gestureRotation: { x: 0, y: 0, inertia: 0 },
  coverTextureUrl: '',
  coverTextureCanvas: null,
  beatMapNextIdx: 0,
  beatMapToken: 0,
  beatMapBusy: false,
  beatMapCache: {},
  currentBeatMap: null,
  djBeatMapCache: {},
  currentDjBeatMap: null,
  djBeatMapNextIdx: 0,
  djBeatPulseNextIdx: 0,
  orbit: {
    userTheta: 0.0, userPhi: 0.08, userRadius: 6.6,
    theta: 0.0, phi: 0.08, radius: 6.6,
    rotating: false, recentering: false,
    lookAt: { x: 0, y: 0, z: 0 },
    focus: { active: false, type: null, theta: 0.0, phi: 0.08, radius: 6.6, lookAt: { x: 0, y: 0, z: 0 } },
    glowFollowX: 0, glowFollowY: 0, glowFollowRoll: 0, beatGlow: 0,
  },
  camPunch: 0,
  cinemaT: 0,
});

export function useVisual() {
  return {
    state: visual,
    set: (keyOrPartial: keyof VisualStore | Partial<VisualStore>, value?: any) => {
      if (typeof keyOrPartial === "string") {
        setVisual(keyOrPartial, value);
      } else {
        setVisual(keyOrPartial);
      }
    },
    resetAudioVisualState: () => {
      setVisual({
        bass: 0, mid: 0, treble: 0, audioEnergy: 0, beatPulse: 0,
        smoothBass: 0, smoothMid: 0, smoothTreb: 0, smoothEnergy: 0,
        beatOnsetFlag: false,
        beatCam: { ...visual.beatCam, punch: 0, nextIdx: 0, events: [] },
        rtBeat: {
          subFast: 0, subSlow: 0, lowFast: 0, lowSlow: 0,
          bodyFast: 0, bodySlow: 0, vocalFast: 0, vocalSlow: 0,
          snapFast: 0, snapSlow: 0,
          prevSub: 0, prevLow: 0, prevBody: 0, prevVocal: 0, prevSnap: 0, prevRms: 0,
          onsetAvg: 0, onsetPeak: 0,
          subPeak: 0, lowPeak: 0, bodyPeak: 0, vocalPeak: 0, snapPeak: 0,
          lastHitAt: -10, tempoGap: 0, tempoConfidence: 0, beatCount: 0,
          primedFrames: 0, warmupUntil: 0,
          pulse: 0, score: 0,
          stats: { hits: 0, blocked: 0, assisted: 0, strong: 0, rejected: 0 },
        },
        cinemaDynamics: { avg: 0, lowAvg: 0, peak: 0.30, scale: 0.82 },
        lyricSunEnergy: 0, lyricSunTarget: 0, lyricSunHold: 0, lyricSunAvg: 0,
      });
    },
    setBeatPulse: (value: number) => {
      setVisual("beatPulse", value);
      setVisual("beatCam", { punch: Math.max(visual.beatCam.punch, value) });
    },
  };
}

export type VisualStoreType = typeof visual;
