import { Component, onMount } from "solid-js";
import { checkHealth } from "./lib/api";
import { forcePlaybackControlsInteractive } from "./lib/uiControls";
import { registerPlaybackBridge } from "./lib/playbackBridge";
import {
  Splash, SearchArea, TopRight, EmptyHome, Background,
  BottomBar, FxPanel, PlaylistPanel, StageLyrics,
  GestureHud, ThumbWrap, VisualGuide, TrialBanner,
  StatusChips, Overlays, HiddenInputs, Modals,
} from "./components/index";
import { useVisualEngine } from "./hooks/useVisualEngine";
import { useAudioPlayback } from "./hooks/useAudioPlayback";
import { useBeatDetection } from "./hooks/useBeatDetection";
import { useHotkeys } from "./hooks/useHotkeys";
import { useAuthHook } from "./hooks/useAuth";
import { useSearchHook } from "./hooks/useSearch";
import { usePlaylists } from "./hooks/usePlaylists";
import { useLyricsHook } from "./hooks/useLyrics";
import { useHomeDiscover } from "./hooks/useHomeDiscover";
import { usePerformance } from "./hooks/usePerformance";
import { useDesktopLyrics } from "./hooks/useDesktopLyrics";
import { useDesktopWallpaper } from "./hooks/useDesktopWallpaper";
import { useIdleGuide } from "./hooks/useIdleGuide";
import { useControlGlass } from "./hooks/useControlGlass";
import { handleHomeTileClick } from "./lib/homeDiscover";
import { playHomeSong, playHomeRecent } from "./lib/homeActions";
import { useActionStore } from "./stores/actionStore";
import { useSettings } from "./stores/settingsStore";
import { setControlsHidden, scheduleControlsHide, revealBottomControls, wakeBottomHandle, updateControlsChromeState, isBottomControlsSuppressedForShelf } from "./lib/uiControls";

const App: Component = () => {
  // Initialize all hooks — they self-register via createEffect
  useVisualEngine();
  const audioPlayback = useAudioPlayback();
  useBeatDetection();
  useHotkeys();
  useAuthHook();
  useSearchHook();
  usePlaylists();
  useLyricsHook();
  const { refreshHomeDiscover } = useHomeDiscover();
  usePerformance();
  useDesktopLyrics();
  useDesktopWallpaper();
  useIdleGuide();
  useControlGlass();

  // Register playback bridge so homeActions can call playQueueAt
  registerPlaybackBridge({
    playQueueAt: audioPlayback.playQueueAt,
    forcePlaybackControlsInteractive,
  });

  onMount(async () => {
    const healthy = await checkHealth();
    if (!healthy) {
      console.warn("[Mineradio] Backend API not reachable. Some features may not work.");
    }
    // Refresh home discover data on mount
    refreshHomeDiscover();

    // Set up tile click handlers
    (window as any).handleHomeTileClick = handleHomeTileClick;

    // Register home actions with actionStore
    useActionStore.getState().register({
      playHomeSong: (index) => playHomeSong(index),
      playHomeRecent: (record) => playHomeRecent(record),
    });

    // Init auto-hide for bottom bar: mouse hover + click handle
    const bar = document.getElementById("bottom-bar");
    const handle = document.getElementById("bottom-handle");
    const settings = useSettings();

    function enterControls() {
      settings.setControlsHovering(true);
      wakeBottomHandle();
      setControlsHidden(false);
    }
    function leaveControls() {
      settings.setControlsHovering(false);
      scheduleControlsHide(70);
      wakeBottomHandle(900);
    }

    bar?.addEventListener("mouseenter", enterControls);
    bar?.addEventListener("mouseleave", leaveControls);
    if (handle) {
      handle.addEventListener("mouseenter", () => {
        settings.setControlsHovering(true);
        revealBottomControls(900);
      });
      handle.addEventListener("mouseleave", leaveControls);
      handle.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (isBottomControlsSuppressedForShelf()) return;
        revealBottomControls(900);
      });
    }
    updateControlsChromeState();
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
      <Modals />
      <VisualGuide />
    </div>
  );
};

export default App;
