import { createStore } from "solid-js/store";

export interface AudioStore {
  audio: HTMLAudioElement | null;
  audioCtx: AudioContext | null;
  source: MediaElementAudioSourceNode | null;
  analyser: AnalyserNode | null;
  beatAnalyser: AnalyserNode | null;
  gainNode: GainNode | null;
  fftSize: number;
  audioReady: boolean;
  volume: number;
  targetVolume: number;
  lastNonZeroVolume: number;
  volumeCloseTimer: ReturnType<typeof setTimeout> | null;
  audioFadeSerial: number;
  // FFT data
  frequencyData: Uint8Array | null;
  timeDomainData: Uint8Array | null;
  beatFrequencyData: Uint8Array | null;
  beatTimeDomainData: Uint8Array | null;
}

const FFT_SIZE = 2048;
const BEAT_FFT_SIZE = 2048;

const [audio, setAudio] = createStore<AudioStore>({
  audio: null,
  audioCtx: null,
  source: null,
  analyser: null,
  beatAnalyser: null,
  gainNode: null,
  fftSize: FFT_SIZE,
  audioReady: false,
  volume: 1.0,
  targetVolume: 1.0,
  lastNonZeroVolume: 0.8,
  volumeCloseTimer: null,
  audioFadeSerial: 0,
  frequencyData: null,
  timeDomainData: null,
  beatFrequencyData: null,
  beatTimeDomainData: null,
});

export function useAudio() {
  return {
    state: audio,
    set: (key: keyof AudioStore, value: any) => {
      setAudio(key, value);
    },
    initAudioContext: () => {
      if (audio.audioCtx) return;
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = FFT_SIZE;
      analyser.smoothingTimeConstant = 0.58;
      const beatAnalyser = ctx.createAnalyser();
      beatAnalyser.fftSize = BEAT_FFT_SIZE;
      beatAnalyser.smoothingTimeConstant = 0.10;
      const gainNode = ctx.createGain();
      gainNode.connect(ctx.destination);
      analyser.connect(gainNode);

      if (audio.audio) {
        try {
          const source = ctx.createMediaElementSource(audio.audio);
          source.connect(analyser);
          source.connect(beatAnalyser);
          setAudio("source", source);
        } catch { /* already connected */ }
      }

      setAudio({
        audioCtx: ctx,
        analyser,
        beatAnalyser,
        gainNode,
        frequencyData: new Uint8Array(FFT_SIZE / 2),
        timeDomainData: new Uint8Array(FFT_SIZE),
        beatFrequencyData: new Uint8Array(BEAT_FFT_SIZE / 2),
        beatTimeDomainData: new Uint8Array(BEAT_FFT_SIZE),
      });
    },
    createAudioElement: () => {
      const el = new Audio();
      el.crossOrigin = 'anonymous';
      setAudio("audio", el);
      if (audio.audioCtx) {
        try {
          const source = audio.audioCtx.createMediaElementSource(el);
          setAudio("source", source);
          source.connect(audio.analyser!);
          source.connect(audio.beatAnalyser!);
        } catch { /* already connected or not supported */ }
      }
      return el;
    },
    setVolume: (v: number, silent?: boolean) => {
      const clamped = Math.max(0, Math.min(1, v));
      setAudio({
        volume: clamped,
        targetVolume: clamped,
      });
      if (clamped > 0.01) {
        setAudio("lastNonZeroVolume", clamped);
      }
      if (audio.audio) {
        if (audio.gainNode) {
          const now = audio.audioCtx?.currentTime || 0;
          audio.gainNode.gain.cancelScheduledValues(now);
          audio.gainNode.gain.setTargetAtTime(clamped, now, 0.025);
          audio.audio.volume = 1;
        } else {
          audio.audio.volume = clamped;
        }
      }
      if (!silent) {
        try {
          localStorage.setItem('apex-player-volume', String(clamped));
        } catch { /* ignore */ }
      }
    },
    reset: () => {
      setAudio({
        audioReady: false,
        volume: audio.targetVolume,
        audioFadeSerial: (audio.audioFadeSerial || 0) + 1,
      });
    },
  };
}

export type AudioStoreType = typeof audio;
