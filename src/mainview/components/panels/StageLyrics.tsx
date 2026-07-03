// @ts-nocheck
import { Component, createSignal, onCleanup, onMount, createEffect } from "solid-js";
import { useLyrics } from "../../stores/lyricsStore";
import { useFx } from "../../stores/fxStore";
import { useVisual } from "../../stores/visualStore";

const StageLyrics: Component = () => {
  const lyrics = useLyrics();
  const fx = useFx();
  const visual = useVisual();
  const [lineText, setLineText] = createSignal("");
  const [lineKey, setLineKey] = createSignal(0);
  const [glowIntensity, setGlowIntensity] = createSignal(0);
  const [scale, setScale] = createSignal(1);
  let containerRef: HTMLDivElement | undefined;
  let animFrame = 0;
  let lastIdx = -1;

  createEffect(() => {
    const idx = lyrics.state.currentLyricIdx;
    const lines = lyrics.state.lines;
    if (idx >= 0 && idx < lines.length && idx !== lastIdx) {
      lastIdx = idx;
      setLineText(lines[idx].text);
      setLineKey((k) => k + 1);
    }
  });

  onMount(() => {
    let prevSun = 0;
    const tick = () => {
      const sun = visual.state.lyricSunEnergy || 0;
      const target = sun > prevSun ? sun * 1.3 : sun * 0.85;
      prevSun = sun;
      setGlowIntensity((g) => g + (target - g) * 0.18);
      setScale((s) => {
        const ts = 1 + glowIntensity() * 0.04;
        return s + (ts - s) * 0.12;
      });
      animFrame = requestAnimationFrame(tick);
    };
    animFrame = requestAnimationFrame(tick);
  });

  onCleanup(() => cancelAnimationFrame(animFrame));

  const show = () => lineText() && fx.state.particleLyrics;

  return (
    <div id="stage-lyrics" ref={containerRef}
      style={{
        display: show() ? "block" : "none",
        position: "fixed",
        inset: "0",
        "pointer-events": "none",
        "z-index": "15",
      }}>
      <Show when={show()}>
        <div
          key={lineKey()}
          class="stage-lyric-line in"
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            transform: `translate3d(calc(-50% + ${fx.state.lyricOffsetX * 40}px), calc(-50% + ${fx.state.lyricOffsetY * 40}px), ${fx.state.lyricOffsetZ * 60}px) rotateX(${fx.state.lyricTiltX}deg) rotateY(${fx.state.lyricTiltY}deg) scale(${scale()})`,
            "font-size": `clamp(34px, ${5.6 * fx.state.lyricScale}vw, 76px)`,
            "font-weight": String(fx.state.lyricWeight),
            "letter-spacing": `${fx.state.lyricLetterSpacing * 100}px`,
            "line-height": String(fx.state.lyricLineHeight),
            "text-shadow": `0 0 14px rgba(168,246,255,${0.38 * glowIntensity()}), 0 0 36px rgba(143,233,255,${0.30 * glowIntensity()}), 0 0 80px rgba(115,167,255,${0.16 * glowIntensity()})`,
            filter: `drop-shadow(0 4px 22px rgba(143,233,255,${0.30 * glowIntensity()}))`,
          }}>
          {lineText()}
        </div>
      </Show>
    </div>
  );
};

export default StageLyrics;
