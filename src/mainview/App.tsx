import { Component, onMount } from "solid-js";
import { checkHealth } from "./lib/api";
import { forcePlaybackControlsInteractive } from "./lib/uiControls";
import { registerPlaybackBridge } from "./lib/playbackBridge";
import {
  Splash, SearchArea, TopRight, EmptyHome, Background,
  BottomBar, FxPanel, PlaylistPanel, StageLyrics,
  GestureHud, ThumbWrap, VisualGuide, TrialBanner,
  StatusChips, Overlays, HiddenInputs, Modals,
  DesktopTitlebar, FullscreenDiyZone,
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
import { useThemeColors } from "./hooks/useThemeColors";
import { handleHomeTileClick } from "./lib/homeDiscover";
import { playHomeSong, playHomeRecent } from "./lib/homeActions";
import { useActionStore } from "./stores/actionStore";
import { useSettings } from "./stores/settingsStore";
import { useUi } from "./stores/uiStore";
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
  useThemeColors();

  const settings = useSettings();
  const ui = useUi();

  // Register playback bridge so homeActions can call playQueueAt
  registerPlaybackBridge({
    playQueueAt: audioPlayback.playQueueAt,
    forcePlaybackControlsInteractive,
  });

  onMount(async () => {
    // Set desktop shell classes (equivalent to Electron preload)
    document.documentElement.classList.add("desktop-shell-root");
    document.body.classList.add("desktop-shell");

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

    // Fullscreen DIY peek logic
    function layoutFullscreenDiyZone(): { left: number; top: number; width: number; height: number } {
      const width = innerWidth < 820 ? 104 : 128;
      const height = innerWidth < 720 ? 48 : 52;
      let left = innerWidth - 510;
      let top = 24;
      const anchor = document.querySelector("#top-right .top-account-pill") || document.getElementById("user-btn") || document.getElementById("top-right");
      if (anchor) {
        const rect = anchor.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          const gap = innerWidth < 820 ? 8 : 12;
          left = rect.left + rect.width / 2 - width / 2;
          top = rect.bottom + gap;
        }
      }
      left = Math.max(12, Math.min(innerWidth - width - 12, left));
      top = Math.max(8, Math.min(innerHeight - height - 8, top));
      document.documentElement.style.setProperty("--fullscreen-diy-left", left.toFixed(1) + "px");
      document.documentElement.style.setProperty("--fullscreen-diy-top", top.toFixed(1) + "px");
      document.documentElement.style.setProperty("--fullscreen-diy-width", width + "px");
      return { left, top, width, height };
    }

    function shouldSuppressFullscreenDiyPeek(): boolean {
      const fxPanel = document.getElementById("fx-panel");
      const hotkeyModal = document.getElementById("hotkey-modal");
      const fxPanelOpen = !!(fxPanel && (fxPanel.classList.contains("peek") || fxPanel.classList.contains("show")));
      const hotkeyOpen = !!(hotkeyModal && hotkeyModal.classList.contains("show"));
      return !!(ui.state.visualGuideActive || fxPanelOpen || hotkeyOpen);
    }

    function updateFullscreenDiyPeekFromPointer(x: number, y: number) {
      const isFullscreen = !!(document.fullscreenElement || document.body.classList.contains("desktop-fullscreen"));
      if (!isFullscreen || settings.state.immersiveMode || shouldSuppressFullscreenDiyPeek()) {
        document.body.classList.remove("fullscreen-diy-peek");
        return;
      }
      const rect = layoutFullscreenDiyZone();
      const anchor = document.querySelector("#top-right .top-account-pill") || document.getElementById("user-btn") || document.getElementById("top-right");
      const anchorRect: DOMRect = anchor ? anchor.getBoundingClientRect() : { left: rect.left, top: rect.top, width: rect.width, height: rect.height, right: rect.left + rect.width, bottom: rect.top + rect.height, x: rect.left, y: rect.top, toJSON() {} } as DOMRect;
      const hitLeft = Math.min(rect.left, anchorRect.left) - 26;
      const hitRight = Math.max(rect.left + rect.width, anchorRect.right) + 26;
      const hitTop = Math.min(rect.top, anchorRect.top) - 18;
      const hitBottom = Math.max(rect.top + rect.height, anchorRect.bottom) + 16;
      const active = x >= hitLeft && x <= hitRight && y >= hitTop && y <= hitBottom;
      document.body.classList.toggle("fullscreen-diy-peek", active);
    }

    window.addEventListener("mousemove", (e: MouseEvent) => {
      updateFullscreenDiyPeekFromPointer(e.clientX, e.clientY);
    });
  });

  return (
    <div id="desktop-window-shell">
      <Background />
      <canvas id="idle-guide-canvas" aria-hidden="true"></canvas>
      <Splash />
      <div id="hint" aria-hidden="true"></div>
      <DesktopTitlebar />
      <FullscreenDiyZone />
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
