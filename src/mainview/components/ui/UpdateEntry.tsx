// @ts-nocheck
import { Component, createSignal, createEffect, onCleanup } from "solid-js";

declare const gsap: any;

const UpdateEntry: Component<{ onClick: () => void }> = (props) => {
  const [visible, setVisible] = createSignal(false);
  const [downloading, setDownloading] = createSignal(false);
  const [ready, setReady] = createSignal(false);
  let entryRef: HTMLButtonElement | undefined;
  let breathAnim: any = null;
  let ringAnim: any = null;

  createEffect(() => {
    // Check for updates on mount
    checkForUpdates();
  });

  async function checkForUpdates() {
    try {
      const res = await fetch("/api/update/latest?t=" + Date.now());
      const data = await res.json();
      if (data.updateAvailable || data.preview) {
        setVisible(true);
        startBreathing();
      }
    } catch {
      // Show anyway in preview mode
      setVisible(true);
      startBreathing();
    }
  }

  function startBreathing() {
    if (!window.gsap || !entryRef) return;
    const ring = entryRef.querySelector(".update-ring");
    breathAnim = window.gsap.to(entryRef, {
      y: -1.4,
      boxShadow: "0 16px 44px rgba(0,0,0,.32),0 0 24px rgba(244,210,138,.18),0 0 13px rgba(157,184,207,.06),inset 0 1px 0 rgba(255,255,255,.11)",
      duration: 2.6,
      repeat: -1,
      yoyo: true,
      ease: "sine.inOut",
    });
    if (ring) {
      ringAnim = window.gsap.to(ring, {
        rotate: 18,
        duration: 3.8,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
        transformOrigin: "50% 50%",
      });
    }
  }

  onCleanup(() => {
    if (breathAnim) breathAnim.kill?.();
    if (ringAnim) ringAnim.kill?.();
  });

  return (
    <button
      ref={entryRef}
      id="update-entry"
      classList={{
        "update-entry": true,
        available: visible(),
        downloading: downloading(),
        ready: ready(),
      }}
      type="button"
      onClick={props.onClick}
      title="发现新版本"
      aria-label="发现新版本"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle class="update-ring" cx="12" cy="12" r="8.8"></circle>
        <circle id="update-progress-ring" class="update-progress-ring" cx="12" cy="12" r="8.8"></circle>
        <path class="update-arrow" d="M12 16.5V7.5"></path>
        <path class="update-arrow" d="M8.7 10.7 12 7.4l3.3 3.3"></path>
      </svg>
    </button>
  );
};

export default UpdateEntry;
