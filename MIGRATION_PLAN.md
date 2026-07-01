# Migration Plan: Extract Logic from `public/legacy/app.js` into SolidJS Components

## Current State

- **18 components** in `src/mainview/components/` — all are **static JSX shells** with no SolidJS reactivity (`createSignal`/`createStore`)
- `public/legacy/app.js` (~3000+ lines) — **monolithic file** with all global state + business logic + event handlers + Three.js render loop
- `src/mainview/lib/api.ts` — RPC client for Bun backend (already extracted)
- `src/mainview/hooks/` — empty (hooks directory created but unused)

## Extraction Architecture

```
src/mainview/
├── stores/                          # NEW: SolidJS stores (replacing global vars)
│   ├── audioStore.ts               # Audio playback, volume, Web Audio API
│   ├── playbackStore.ts            # playQueue, currentIdx, playMode, playlist
│   ├── visualStore.ts              # FFT data, beat detection, particle uniforms
│   ├── lyricsStore.ts              # lyricsLines, custom lyrics, karaoke state
│   ├── searchStore.ts              # searchMode, results, history, podcast
│   ├── authStore.ts                # loginStatus, qqLoginStatus, QR flow
│   ├── userStore.ts                # userPlaylists, likedSongMap, likes
│   ├── fxStore.ts                  # fx preset object, visual settings
│   ├── shelfStore.ts               # shelfManager state, cards, hover
│   ├── settingsStore.ts            # diyMode, auto-hides, hotkeys, prefs
│   ├── homeStore.ts                # homeDiscoverState, weather, listen stats
│   ├── uiStore.ts                  # cursor, modals, glass displacement, overlay state
│   └── performanceStore.ts         # adaptive FPS, render power, cache trimming
├── hooks/                          # NEW: SolidJS hooks (business logic)
│   ├── useAudioPlayback.ts         # playQueueAt, attemptAudioPlay, togglePlay, next/prev
│   ├── useAudioAnalysis.ts         # Web Audio graph setup, FFT analysis, band splitting
│   ├── useBeatDetection.ts         # onset detection, beatCam, beatmap application
│   ├── useLyrics.ts                # fetchLyric, parse, custom lyric CRUD
│   ├── useSearch.ts                # doSearch, search dedup, podcast search
│   ├── useAuth.ts                  # QR flow, web login, cookie login, logout
│   ├── usePlaylists.ts             # refreshUserPlaylists, collect, like songs
│   ├── useHotkeys.ts               # hotkey capture, global shortcuts
│   ├── useVisualEngine.ts          # Three.js scene init, uniforms update, render loop
│   ├── useShelf.ts                 # shelfManager lifecycle, card management
│   ├── usePerformance.ts           # adaptive FPS, cache trimming, power hooks
│   └── useLocalStorage.ts          # generic localStorage wrapper for stores
├── components/                     # EXISTING: enhance with reactivity
│   ├── panels/
│   │   ├── SearchArea.tsx          # ← connect to searchStore + useSearch
│   │   ├── PlaylistPanel.tsx       # ← connect to playbackStore + playlists
│   │   ├── BottomBar.tsx           # ← connect to audioStore + playbackStore + fxStore
│   │   ├── FxPanel.tsx             # ← connect to fxStore
│   │   ├── StageLyrics.tsx         # ← connect to lyricsStore + visualStore
│   │   ├── Splash.tsx              # ← connect to authStore
│   │   ├── EmptyHome.tsx           # ← connect to homeStore
│   │   └── Modals.tsx              # ← connect to authStore + settingsStore
│   └── ui/
│       ├── TopRight.tsx            # ← connect to authStore
│       ├── StatusChips.tsx         # ← connect to playbackStore (now playing)
│       └── ... others ← connect as needed
└── mainview/
    └── App.tsx                     # Wire up stores at root, dispose legacy app.js
```

## Migration Phases

### Phase 0: Foundation (Prerequisites)

**Goal**: Set up the infrastructure before extracting any logic.

1. **Create `src/mainview/stores/` directory**
2. **Create `src/mainview/hooks/` directory** (already exists, empty)
3. **Build `useLocalStorage.ts` hook** — generic wrapper for reading/writing localStorage keys used by app.js:
   ```ts
   function useLocalStorage<T>(key: string, fallback: T): [() => T, (v: T) => void]
   ```
4. **Create store type definitions** — extract interfaces from global variables in app.js
5. **Set up root-level store providers** in `App.tsx` (replace script injection pattern)

**Deliverable**: Directory structure + localStorage hook + empty stores scaffolded

---

### Phase 1: State Layer (Stores) — Replace Global Variables

**Goal**: Convert every global variable in app.js into a SolidJS `createStore` or `createSignal`.

**Priority order** (by dependency — low-hanging fruit first):

| # | Store | Global Variables Mapped | Key app.js Functions Referenced |
|---|-------|------------------------|--------------------------------|
| 1 | **settingsStore** | `diyPlayerMode`, `hotkeySettings`, `FREE_CAMERA_STORE_KEY`, `VISUAL_GUIDE_SEEN_STORE_KEY`, auto-hide flags | `readSavedVolume()`, `readDiyModePreference()`, `saveDiyModePreference()`, `readBooleanPreference()`, `saveBooleanPreference()` |
| 2 | **fxStore** | `fx` object (100+ settings), `playbackVisualPreset`, `presetTransition` | `applyVisualPreset()`, `switchVisualPreset()`, `saveVisualSettings()` |
| 3 | **audioStore** | `audio`, `audioCtx`, `source`, `analyser`, `gainNode`, `volume`, `targetVolume`, `AUDIO_FADE_*` | `preparePlaybackFadeIn()`, `startPlaybackFadeIn()`, `fadeOutAndPauseAudio()`, `applyVolumeToAudio()`, `scheduleVolumeTween()` |
| 4 | **playbackStore** | `playlist`, `playQueue`, `currentIdx`, `playing`, `playMode`, `playToggleBusy` | `playQueueAt()`, `togglePlay()`, `nextTrack()`, `prevTrack()`, `cyclePlayMode()`, `shuffleQueue()`, `clearQueue()`, `removeFromQueue()` |
| 5 | **visualStore** | `FFT_SIZE`, `frequencyData`, `timeDomainData`, `bass`, `mid`, `treble`, `beatPulse`, `smoothBass/Mid/Treb/Energy`, `beatCam`, `rtBeat` | `processRealtimeBeatEngine()`, `updateCinemaDynamics()`, `updateCinemaTrackProfile()` |
| 6 | **lyricsStore** | `lyricsLines`, `lyricsVisible`, `lyricsHasNativeKaraoke`, `lyricsTimingSource`, `lyricSunEnergy/Target/Hold/Avg`, `lyricSunPeak`, `lyricSourceMode`, `customLyricMap`, `customLyricPrefs` | `fetchLyric()`, `setOriginalLyricsState()`, `applyCustomLyricState()`, `saveCustomLyricForCurrent()`, `deleteCustomLyricForCurrent()` |
| 7 | **searchStore** | `searchMode`, `podcastResults`, `podcastPrograms`, `podcastCurrentRadio`, `searchLastResultQuery`, `searchHistory` | `doSearch()`, `setSearchMode()`, `loadPodcastHot()`, `doPodcastSearch()`, `renderSearchHistory()`, `searchLooksLikeDerivative()` |
| 8 | **authStore** | `loginStatus`, `qqLoginStatus`, `loginProvider`, `activeAccountProvider`, `dualAccountMode`, `qqCookieBusy`, `qrPollTimer`, `qrKey` | `showLoginModal()`, `closeLoginModal()`, `refreshQr()`, `startQrPoll()`, `checkQr()`, `openNeteaseWebLogin()`, `openQQWebLogin()`, `refreshQQLoginStatus()`, `logoutActiveAccount()`, `doLogout()` |
| 9 | **userStore** | `userPlaylists`, `qqPlaylists`, `myPodcastCollections`, `myPodcastItems`, `playlistCoverCache`, `likedSongMap`, `likeBusyMap`, `collectTargetSong`, `collectBusy` | `refreshUserPlaylists()`, `toggleLikeSong()`, `syncLikeStatusForSongs()`, `openCollectModal()`, `addCollectTargetToPlaylist()`, `createPlaylistFromCollect()` |
| 10 | **shelfStore** | `shelfManager` state, `shelfPinnedOpen`, `shelfHoverCue`, `shelfVisibility` | `scheduleShelfRebuild()`, `safeShelfRebuild()`, `updateShelfHoverCueFromPointer()` |
| 11 | **homeStore** | `homeDiscoverState`, `homeWeatherRadioState`, `listenStatsState`, `emptyHomeActive`, `homeForcedOpen` | `refreshHomeDiscover()`, `loadWeatherRadio()`, `updateListenStats()` |
| 12 | **uiStore** | `controlsAutoHide`, `controlsHovering`, `fxPanelPinned`, `playlistPanelPinned`, `immersiveMode`, `miniQueueOpen`, `cursorVisible`, `coverCropState`, `uploadTipTimer` | `toggleDiyMode()`, `toggleFxFabAutoHide()`, `toggleControlsAutoHide()`, `toggleUserCapsuleAutoHide()`, `toggleImmersiveMode()`, `togglePlaylistPanelPinned()` |
| 13 | **performanceStore** | `renderPerfState`, `runtimePerfState`, `coverDepthCache`, `coverDepthCacheKeys`, `aiDepthPipeline`, `aiDepthBusy` | `trimRuntimeCaches()`, `applyRendererPowerMode()`, `installRenderPowerHooks()`, `isDeepBackgroundMode()`, `shouldSkipAdaptiveRenderFrame()` |

**Each store module pattern**:
```ts
import { createStore } from "solid-store";
import { useLocalStorage } from "../hooks/useLocalStorage";

interface AudioStoreState {
  audio: HTMLAudioElement | null;
  audioCtx: AudioContext | null;
  analyser: AnalyserNode | null;
  source: MediaElementAudioSourceNode | null;
  gainNode: GainNode | null;
  volume: number;
  targetVolume: number;
  // ... all relevant globals
}

const [state, setState] = createStore<AudioStoreState>({
  audio: null,
  audioCtx: null,
  // defaults from app.js
});

// Expose getter + setter pairs for key state
export function useAudio() {
  return {
    state: () => state,
    setVolume: (v: number) => { setState("volume", v); applyVolumeToAudio(v); },
    // ...
  };
}
```

**Deliverable**: All 13 stores created, type-safe, connected to localStorage where applicable.

---

### Phase 2: Business Logic (Hooks) — Extract Functions from app.js

**Goal**: Convert every major function group in app.js into a SolidJS hook that operates on the stores.

**Priority order** (by user-facing feature importance):

| # | Hook | app.js Functions Extracted | Stores Operated On |
|---|------|---------------------------|-------------------|
| 1 | **useAudioPlayback** | `playQueueAt()`, `attemptAudioPlay()`, `togglePlay()`, `nextTrack()`, `prevTrack()`, `cyclePlayMode()`, `shuffleQueue()`, `clearQueue()`, `removeFromQueue()`, `bindPlaybackProgressEvents()`, `preparePlaybackFadeIn()`, `startPlaybackFadeIn()`, `fadeOutAndPauseAudio()`, `scheduleVolumeTween()` | audioStore, playbackStore, userStore |
| 2 | **useBeatDetection** | `processRealtimeBeatEngine()`, `scheduleBeatAnalysis()`, `scheduleBeatPrefetch()`, `tickBeatMap()`, `tickPodcastDjBeatMap()`, `applyCinemaProfileFromBeatMap()`, `resetCinemaTrackProfile()` | visualStore, playbackStore, shelfStore |
| 3 | **useLyrics** | `fetchLyric()`, `setOriginalLyricsState()`, `applyCustomLyricState()`, `saveCustomLyricForCurrent()`, `deleteCustomLyricForCurrent()`, `parseCustomLyricText()`, `tickLyricsParticles()` | lyricsStore, audioStore |
| 4 | **useSearch** | `doSearch()`, `setSearchMode()`, `loadPodcastHot()`, `doPodcastSearch()`, `renderSearchHistory()`, `clearSearchHistory()`, `searchLooksLikeDerivative()`, `searchLooksLikeSameTitleCover()`, `syncSearchAreaResultState()` | searchStore, playbackStore |
| 5 | **useAuth** | `showLoginModal()`, `closeLoginModal()`, `refreshQr()`, `startQrPoll()`, `stopQrPoll()`, `checkQr()`, `openNeteaseWebLogin()`, `openQQWebLogin()`, `refreshQQLoginStatus()`, `startQQLoginStatusAutoRefresh()`, `logoutActiveAccount()`, `doLogout()`, `renderUserBtn()` | authStore, userStore, uiStore |
| 6 | **usePlaylists** | `refreshUserPlaylists()`, `openCollectModal()`, `renderCollectModal()`, `addCollectTargetToPlaylist()`, `createPlaylistFromCollect()`, `toggleLikeSong()`, `syncLikeStatusForSongs()` | userStore, authStore, uiStore |
| 7 | **useVisualEngine** | `animate()` (main render loop), `buildCoverParticleGeometry()`, `applyCoverParticleResolution()`, `updateRipples()`, `triggerRipple()`, `updateFloatLayer()`, `updateSkullParticleLayer()`, `updateStageLyrics3D()`, `recenterCamera()`, `toggleFreeCamera()`, `applyCinemaProfileFromBeatMap()`, `tickGestureRotation()`, `updateCamera()`, `applySkullCameraPose()` | visualStore, fxStore, audioStore |
| 8 | **useShelf** | `shelfManager` lifecycle, `getMode()`, `getCards()`, `update()`, `hasOpenContent()`, `raycastCards()`, `scheduleShelfRebuild()`, `safeShelfRebuild()`, `updateShelfHoverCueFromPointer()`, `tickShelfHoverCue()` | shelfStore, playbackStore |
| 9 | **useHotkeys** | Keyboard event handling, hotkey capture, global shortcut dispatch | settingsStore, playbackStore, audioStore, uiStore |
| 10 | **usePerformance** | `markAppPerf()`, `installStartupLongTaskObserver()`, `trimRuntimeCaches()`, `applyRendererPowerMode()`, `installRenderPowerHooks()`, `isDeepBackgroundMode()`, `shouldSkipAdaptiveRenderFrame()`, `collectRuntimePerfSnapshot()` | performanceStore |
| 11 | **useHomeDiscover** | `refreshHomeDiscover()`, `loadWeatherRadio()`, `updateListenStats()`, `startWeatherAutoRefresh()` | homeStore, authStore |
| 12 | **useCoverCrop** | `coverCropState` management | uiStore, userStore |
| 13 | **useLocalStorage** | (already in Phase 0) | All stores |

**Each hook pattern**:
```ts
import { createEffect, onCleanup } from "solid-js";
import { useAudio } from "../stores/audioStore";
import { usePlayback } from "../stores/playbackStore";

export function useAudioPlayback() {
  const audio = useAudio();
  const playback = usePlayback();

  function togglePlay() {
    // Extracted from app.js togglePlay()
    if (playback.state.playing) {
      audio.state.audio?.pause();
    } else {
      startPlaybackFadeIn();
    }
  }

  // ... more extracted functions

  return { togglePlay, nextTrack, prevTrack, ... };
}
```

**Deliverable**: All hooks implemented, each one a drop-in replacement for the corresponding app.js function group.

---

### Phase 3: Component Reactivity — Connect Components to Stores + Hooks

**Goal**: Add SolidJS reactivity to each static shell component.

**Migration pattern for each component**:
```tsx
// BEFORE (current state)
export function BottomBar() {
  return (
    <div id="bottom-bar">
      <button id="play-btn" onclick={togglePlay}>...</button>
    </div>
  );
}

// AFTER (migrated)
import { createSignal, onMount } from "solid-js";
import { useAudio } from "../../stores/audioStore";
import { useAudioPlayback } from "../../hooks/useAudioPlayback";
import { useFx } from "../../stores/fxStore";

export function BottomBar() {
  const audio = useAudio();
  const playback = useAudioPlayback();
  const fx = useFx();

  // Reactive bindings
  const isPlaying = () => audio.state.playing;
  const currentTrack = () => playback.state.currentIdx >= 0
    ? playback.state.playQueue[playback.state.currentIdx]?.title
    : '';
  const volume = () => audio.state.volume;
  const progress = () => audio.state.audio?.currentTime ?? 0;

  return (
    <div id="bottom-bar">
      <button id="play-btn" onclick={() => playback.togglePlay()}>
        {isPlaying() ? "⏸" : "▶"}
      </button>
      {/* ... reactive progress bar, volume slider, etc. */}
    </div>
  );
}
```

**Component migration mapping**:

| Component | Primary Store | Hook | Reactive Bindings Needed |
|-----------|--------------|------|------------------------|
| **SearchArea** | searchStore | useSearch | searchMode (tab active), search input value, result visibility, search history chips |
| **PlaylistPanel** | playbackStore, userStore | usePlaylists | queue items (live list), playMode indicator, playlist selection, current song highlight |
| **BottomBar** | audioStore, playbackStore | useAudioPlayback | playing state (icon), current track info, progress bar (live update), volume slider, like status, playMode indicator |
| **FxPanel** | fxStore | — | preset grid active highlight, auto-hide toggle state, FX panel open/closed |
| **StageLyrics** | lyricsStore, visualStore | useLyrics | lyric lines (dynamic render), karaoke highlight, lyric sun glow intensity, lyric positioning |
| **Splash** | authStore | useAuth | login status, splash visibility (auto-hide after timeout) |
| **EmptyHome** | homeStore | useHomeDiscover | loading state, discover feed items, weather display, play button |
| **Modals** | authStore, settingsStore | useAuth, usePlaylists | modal open/close (visibility), form state within modals, login provider tabs |
| **TopRight** | authStore | useAuth | login status, user avatar/name, VIP badge, dropdown menu visibility |
| **StatusChips** | playbackStore, audioStore | useAudioPlayback | now-playing track info, quality badge, volume indicator, beat pulse indicator |
| **Background** | visualStore, fxStore | useVisualEngine | background video/image source, canvas visibility |
| **ThumbWrap** | playbackStore | useAudioPlayback | current thumbnail image, loading state |
| **GestureHud** | visualStore | useVisualEngine | gesture visibility, rotation indicator |
| **HiddenInputs** | settingsStore | — | hidden input state (file picker, etc.) |
| **TrialBanner** | settingsStore, uiStore | — | banner visibility, dismiss state |
| **VisualGuide** | settingsStore, uiStore | — | guide step visibility, progress |
| **Overlays** | uiStore | — | overlay visibility states, z-order management |

**Deliverable**: All 18 components are reactive SolidJS components with proper store/hook wiring.

---

### Phase 4: Visual Engine — Three.js Integration

**Goal**: Migrate the Three.js render loop and particle system into a SolidJS hook + canvas lifecycle.

This is the **largest and most complex** piece — the `animate()` function in app.js is the central nervous system of the visual pipeline.

**Approach**:

1. **Create `useVisualEngine.ts`** hook that:
   - Initializes Three.js scene (currently called via `window.__initMineradioVisuals`)
   - Sets up the main `requestAnimationFrame` loop
   - Reads FFT/beat data from `visualStore` each frame
   - Updates Three.js uniforms (`uBass`, `uMid`, `uTreble`, `uBeat`, `uEnergy`, etc.)
   - Manages particle systems, ripples, camera, shelf, gesture rotation
   - Renders the scene each frame
   - Implements adaptive FPS
   - Handles resize events

2. **Integration in `Background.tsx`**:
   ```tsx
   import { onMount, onCleanup } from "solid-js";
   import { useVisualEngine } from "../../hooks/useVisualEngine";

   export function Background() {
     const canvasRef: HTMLCanvasElement;

     onMount(() => {
       const engine = useVisualEngine({ canvas: canvasRef });
       onCleanup(() => engine.dispose());
     });

     return <canvas ref={canvasRef} id="main-canvas" />;
   }
   ```

3. **Move the GLSL shaders** from app.js into separate `.glsl` files in `src/mainview/assets/shaders/`

4. **Migrate `window.__initMineradioVisuals`** into a proper hook export

**Deliverable**: Three.js visuals work identically but are managed by SolidJS hooks with proper lifecycle cleanup.

---

### Phase 5: DOM Event Wiring — Replace `onclick` / `addEventListener`

**Goal**: Replace all raw DOM event listeners in app.js with SolidJS event bindings.

**Current app.js event listeners that need migration**:

| Event | app.js handler | Target element | → SolidJS binding in |
|-------|---------------|----------------|---------------------|
| `#search-input` enter | `doSearch()` | SearchArea | `on:keydown` |
| `#search-mode-tabs` | `setSearchMode()` | SearchArea | `onclick` |
| `#play-btn` | `togglePlay()` | BottomBar | `onclick` |
| `#prev-btn` | `prevTrack()` | BottomBar | `onclick` |
| `#next-btn` | `nextTrack()` | BottomBar | `onclick` |
| `#heart-btn` | `toggleLikeCurrent()` | BottomBar | `onclick` |
| `#play-mode-btn` | `cyclePlayMode()` | BottomBar | `onclick` |
| `#user-btn` | `showUserModal()` | TopRight | `onclick` |
| `#fx-fab` | `toggleFxPanel()` | FxPanel | `onclick` |
| `#fx-fab-hide-btn` | `toggleFxFabAutoHide()` | FxPanel | `onclick` |
| `#bottom-bar` mouseenter/leave | auto-hide | BottomBar | `on:mouseenter`/`on:mouseleave` |
| `#collect-new-name` enter | create playlist | Modals | `on:keydown` |
| `keydown` (global) | hotkeys | window | `useHotkeys` hook |
| `mousemove`/`pointermove` | cursor reveal, pointer tracking | window | `useVisualEngine` / `useHotkeys` |
| `mousedown` on canvas | orbit rotation | Background | `on:mousedown` |
| `wheel` on canvas | zoom | Background | `on:wheel` |
| `dblclick` on canvas | recenter camera | Background | `on:dblclick` |
| `resize` | glass maps, shelf layout | window | handled in hooks |
| `MutationObserver` on `#search-area` | result state sync | SearchArea | Replace with SolidJS reactive signals |

**Approach**:
- Each component already has `onclick` handlers referencing global functions
- Replace these with **local functions from hooks** that operate on stores
- Remove all `document.addEventListener()` calls from app.js
- Replace `MutationObserver` on `#search-area` with SolidJS reactive rendering of search results
- Replace `animateListItems()` with SolidJS keyed lists (no need for manual GSAP stagger — use CSS transitions)

**GSAP replacement**: Replace GSAP animations with CSS transitions/animations:
```css
/* Replace GSAP button hover/press animations */
.ctrl-btn {
  transition: transform 0.15s ease, opacity 0.15s ease;
}
.ctrl-btn:hover { transform: scale(1.1); }
.ctrl-btn:active { transform: scale(0.95); }

/* Replace GSAP list item stagger */
.queue-item {
  transition: transform 0.3s ease, opacity 0.3s ease;
}
.queue-item-enter {
  animation: slideIn 0.3s ease forwards;
}
@keyframes slideIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}
```

**Deliverable**: All event wiring moved into SolidJS component bindings, no more `addEventListener` in app.js.

---

### Phase 6: Cleanup & Decommission

**Goal**: Remove app.js entirely, verify app works without it.

1. **Gradual removal**:
   - First, verify `App.tsx` no longer loads `legacy/app.js` script
   - Ensure `window.__initMineradioVisuals` is gone (replaced by hook in Background.tsx)
   - Remove all `onclick={globalFn}` patterns — all should be hook calls
   - Remove `document.dispatchEvent(new Event("DOMContentLoaded"))` hack

2. **Clean up app.js**:
   - Delete `public/legacy/app.js`
   - Remove `public/legacy/` directory (keep only visuals/shaders if moved)

3. **Remove any remaining global references**:
   - Search for `window.` references in components
   - Remove `window.__initMineradioVisuals`
   - Ensure no component directly accesses global vars

4. **Verify**:
   - `npm run dev` (or `bun dev`) — no errors
   - App loads in Electrobun with all features working
   - Visuals render correctly
   - Audio playback works
   - Search, login, playlists, lyrics all functional

---

## Risk Areas & Mitigations

| Risk | Mitigation |
|------|-----------|
| **Three.js render loop** is tightly coupled to global state | Phase 2 creates stores first; Phase 4 hook reads from stores — clean separation |
| **GSAP animations** — can't import GSAP in SolidJS easily | Replace with CSS transitions; use SolidJS `transition:` directive for enter/leave |
| **`MutationObserver` on search-area** — used for DOM-based state detection | Replace with SolidJS keyed lists that render directly from store state |
| **Beat detection timing** — must stay in sync with audio | Phase 2 `useBeatDetection` hook runs `processRealtimeBeatEngine()` every frame from the `animate()` loop |
| **Electrobun blank screen** — likely a bundling or routing issue | Ensure `main.tsx` mounts correctly; verify Bun dev server serves static files |
| **Performance regression** — SolidJS re-renders vs raw DOM manipulation | Use `createMemo`/`createSelector` for derived state; batch updates; avoid unnecessary re-renders |

## Estimated Effort

| Phase | Complexity | Estimated Work |
|-------|-----------|----------------|
| 0: Foundation | Low | 1-2 hours |
| 1: Stores (13 stores) | Medium | 4-6 hours |
| 2: Hooks (13 hooks) | High | 12-18 hours |
| 3: Component Reactivity | Medium | 6-10 hours |
| 4: Visual Engine (Three.js) | Very High | 10-16 hours |
| 5: DOM Event Wiring | Medium | 4-6 hours |
| 6: Cleanup & Verify | Low | 2-3 hours |

**Total estimated**: 39-61 hours of focused work

## Order of Execution (Recommended)

1. **Phase 0** — Foundation
2. **Phase 1** — Stores (low → high dependency order as listed)
3. **Phase 2** — Hooks (corresponding to stores, Phase 1 order)
4. **Phase 3** — Components (non-visual first, visual components last)
5. **Phase 4** — Visual Engine (parallel with Phase 3 possible)
6. **Phase 5** — DOM Event Wiring (after hooks + components)
7. **Phase 6** — Cleanup

## Key Principles

1. **One source of truth**: Each global variable → one store. No duplicated state.
2. **Hooks encapsulate behavior, stores encapsulate data**: Hooks are pure functions that operate on stores.
3. **Preserve visual fidelity**: CSS/styling must match app.js output exactly. Only JavaScript logic changes.
4. **Incremental verification**: After each phase, start the app and verify nothing is broken.
5. **No feature loss**: Every function in app.js must have a destination in the new architecture.
