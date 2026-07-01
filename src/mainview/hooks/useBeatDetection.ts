import { useVisual } from "../stores/visualStore";
import { useAudio } from "../stores/audioStore";

export function useBeatDetection() {
  const visual = useVisual();
  const audio = useAudio();

  // Process real-time beat engine each frame
  // This would be called from the animate() render loop
  function processRealtimeBeatEngine(_dt: number) {
    if (!audio.state.analyser || !audio.state.frequencyData) return;

    const analyser = audio.state.analyser;
    const freqData = audio.state.frequencyData!;

    analyser.getByteFrequencyData(freqData as Uint8Array<ArrayBuffer>);

    // Band-split analysis: sub, kick, body, vocal, snap
    const sampleRate = audio.state.audioCtx?.sampleRate || 44100;
    const binSize = sampleRate / (audio.state.fftSize || 2048);

    let sub = 0, low = 0, body = 0, vocal = 0, snap = 0;
    let rms = 0;

    for (let i = 0; i < freqData.length; i++) {
      const freq = i * binSize;
      const val = freqData[i] / 255;
      const weighted = val * val;
      rms += weighted;

      if (freq < 60) sub += weighted;
      else if (freq < 200) low += weighted;
      else if (freq < 2000) body += weighted;
      else if (freq < 6000) vocal += weighted;
      else snap += weighted;
    }

    rms = Math.sqrt(rms / freqData.length);

    // Smooth values with exponential moving average
    const alpha = 0.15;
    const smoothSub = sub * alpha + visual.state.rtBeat.subSlow * (1 - alpha);
    const smoothLow = low * alpha + visual.state.rtBeat.lowSlow * (1 - alpha);
    const smoothBody = body * alpha + visual.state.rtBeat.bodySlow * (1 - alpha);
    const smoothVocal = vocal * alpha + visual.state.rtBeat.vocalSlow * (1 - alpha);
    const smoothSnap = snap * alpha + visual.state.rtBeat.snapSlow * (1 - alpha);

    // Update beatCam
    const beatCam = visual.state.beatCam;
    const now = performance.now() / 1000;

    // Onset detection: energy spikes in sub/kick bands
    const onset = smoothSub > visual.state.rtBeat.subPeak * 1.3 ||
                  smoothLow > visual.state.rtBeat.lowPeak * 1.2;

    if (onset && now - beatCam.lastTriggerAt > beatCam.minInterval) {
      beatCam.pulse = Math.max(beatCam.pulse, 0.5);
      beatCam.lastTriggerAt = now;
    }

    // Decay pulse
    if (beatCam.pulse > 0) {
      beatCam.pulse *= 0.92;
      if (beatCam.pulse < 0.01) beatCam.pulse = 0;
    }

    // Update state
    visual.set("bass", smoothSub * 4);
    visual.set("mid", smoothBody * 3);
    visual.set("treble", smoothSnap * 3);
    visual.set("audioEnergy", rms * 5);
    visual.set("beatPulse", beatCam.pulse);
    visual.set("smoothBass", smoothSub);
    visual.set("smoothMid", smoothBody);
    visual.set("smoothTreb", smoothSnap);
    visual.set("smoothEnergy", rms);

    // Update rtBeat
    visual.set("rtBeat", {
      subFast: smoothSub,
      subSlow: visual.state.rtBeat.subSlow * 0.95 + smoothSub * 0.05,
      lowFast: smoothLow,
      lowSlow: visual.state.rtBeat.lowSlow * 0.95 + smoothLow * 0.05,
      bodyFast: smoothBody,
      bodySlow: visual.state.rtBeat.bodySlow * 0.95 + smoothBody * 0.05,
      vocalFast: smoothVocal,
      vocalSlow: visual.state.rtBeat.vocalSlow * 0.95 + smoothVocal * 0.05,
      snapFast: smoothSnap,
      snapSlow: visual.state.rtBeat.snapSlow * 0.95 + smoothSnap * 0.05,
      prevSub: visual.state.rtBeat.subSlow,
      prevLow: visual.state.rtBeat.lowSlow,
      prevBody: visual.state.rtBeat.bodySlow,
      prevVocal: visual.state.rtBeat.vocalSlow,
      prevSnap: visual.state.rtBeat.snapSlow,
      prevRms: rms,
      pulse: beatCam.pulse,
      lastHitAt: onset ? now : visual.state.rtBeat.lastHitAt,
      beatCount: onset ? visual.state.rtBeat.beatCount + 1 : visual.state.rtBeat.beatCount,
    });

    // Cinema dynamics
    const cd = visual.state.cinemaDynamics;
    cd.avg = cd.avg * 0.97 + rms * 3 * 0.03;
    cd.lowAvg = cd.lowAvg * 0.97 + smoothLow * 4 * 0.03;
    cd.peak = Math.max(cd.peak * 0.98, smoothSub * 4);

    // Lyric sun energy
    const ls = visual.state;
    ls.lyricSunTarget = Math.min(1, rms * 4 + smoothSub * 2);
    ls.lyricSunEnergy = ls.lyricSunEnergy * 0.9 + ls.lyricSunTarget * 0.1;
  }

  function scheduleBeatAnalysis(songId: string, _audioUrl: string) {
    // Offline beat analysis would go here
    // For now, just mark as busy
    visual.set("beatMapBusy", true);
    console.log(`Beat analysis scheduled for ${songId}`);
    // In production: fetch audio → OfflineAudioContext → kick detection
  }

  function tickBeatMap(_dt: number) {
    if (!visual.state.currentBeatMap) return;
    const beatMap = visual.state.currentBeatMap;
    const audioEl = audio.state.audio;
    if (!audioEl) return;

    const currentTime = audioEl.currentTime;
    const kicks = beatMap.kicks || [];

    // Advance through kick events
    while (
      visual.state.beatMapNextIdx < kicks.length &&
      kicks[visual.state.beatMapNextIdx] <= currentTime + visual.state.beatCam.lookahead
    ) {
      const kickTime = kicks[visual.state.beatMapNextIdx];
      const timeDiff = Math.abs(currentTime - kickTime);
      if (timeDiff < 0.1) {
        visual.setBeatPulse(0.6);
      }
      visual.set("beatMapNextIdx", visual.state.beatMapNextIdx + 1);
    }
  }

  function applyCinemaProfileFromBeatMap(beatMap: any) {
    if (!beatMap) return;
    const kicks = beatMap.kicks || [];
    const density = kicks.length / (beatMap.duration || 1);
    visual.set("cinemaTrackProfile", {
      scale: Math.min(1.5, 0.8 + density * 0.3),
      target: Math.min(1.5, 0.8 + density * 0.3),
      density: Math.min(1, density * 2),
    });
  }

  function resetBeatCameraSync() {
    visual.set("beatCam", {
      punch: 0,
      nextIdx: 0,
      lastTriggerAt: -10,
      lastRealtimeAt: -10,
    });
    visual.set("beatMapNextIdx", 0);
    visual.set("currentBeatMap", null);
  }

  return {
    processRealtimeBeatEngine,
    scheduleBeatAnalysis,
    tickBeatMap,
    applyCinemaProfileFromBeatMap,
    resetBeatCameraSync,
  };
}

export type BeatDetectionHook = ReturnType<typeof useBeatDetection>;
