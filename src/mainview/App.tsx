import { Component, onMount } from "solid-js";
import { checkHealth } from "./lib/api";
import {
  Splash,
  SearchArea,
  TopRight,
  EmptyHome,
  Background,
  BottomBar,
  FxPanel,
  PlaylistPanel,
  StageLyrics,
  GestureHud,
  ThumbWrap,
  VisualGuide,
  TrialBanner,
  StatusChips,
  Overlays,
  HiddenInputs,
} from "./components/LegacyComponents";

const App: Component = () => {
  onMount(async () => {
    // Verify backend API is running
    const healthy = await checkHealth();
    if (!healthy) {
      console.warn("[Mineradio] Backend API not reachable. Some features may not work.");
    }

    // Load legacy JS after SolidJS has rendered all DOM elements
    const script = document.createElement("script");
    script.src = "/legacy/app.js";
    script.onload = () => {
      console.log("[Mineradio] Legacy app loaded");
      // Trigger DOMContentLoaded again since the legacy app.js
      // uses it to initialize — but the event already fired before
      // SolidJS rendered the DOM.
      document.dispatchEvent(new Event("DOMContentLoaded"));
    };
    script.onerror = () => {
      console.warn("[Mineradio] Legacy app JS not found, running in bootstrap mode");
    };
    document.body.appendChild(script);
  });

  return (
    <div id="desktop-window-shell">
      <Background />
      <canvas id="idle-guide-canvas" aria-hidden="true"></canvas>
      <Splash />
      <div id="hint" aria-hidden="true"></div>
      <TopRight />
      <SearchArea />
      <EmptyHome />
      <FxPanel />
      <PlaylistPanel />
      <StageLyrics />
      <GestureHud />
      <ThumbWrap />
      <BottomBar />
      <HiddenInputs />
      <TrialBanner />
      <StatusChips />
      <Overlays />
      <VisualGuide />
    </div>
  );
};

export default App;
