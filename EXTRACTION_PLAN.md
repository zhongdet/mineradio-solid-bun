# Extraction Plan: `public/legacy/app.js` → SolidJS Components

## Source File

`public/legacy/app.js` — **23,624 lines, 1,037 functions, ~800+ global variables**

## Current Migration State

| Layer | Status |
|-------|--------|
| **13 stores** | Scaffolded in `src/mainview/stores/` — audioStore & visualStore are partially implemented |
| **13 hooks** | Created in `src/mainview/hooks/` — useAudioPlayback & useVisualEngine partially implemented |
| **18 components** | Static JSX shells in `src/mainview/components/` — no SolidJS reactivity wired |
| **App.tsx** | Still loads legacy app.js via `<script>` tag |
| **legacy/** | Empty `visuals/` and `ui/` subdirs exist as placeholders |

---

## Extraction Strategy

### Phase 0: Fix Foundation (1-2 days)

1. **Remove legacy script injection from App.tsx** — stop loading `public/legacy/app.js`
2. **Implement `useLocalStorage` hook** — generic typed localStorage wrapper for all store keys
3. **Complete store scaffolding** — fill in all 13 stores with proper type definitions and initial values extracted from app.js globals
4. **Wire store exports in `stores/index.ts`** and hook exports in `hooks/index.ts`

### Phase 1: State Layer — Complete All Stores (3-4 days)

Extract every global variable from app.js into a typed SolidJS store. Each store maps to a coherent domain.

| # | Store | Approx. Lines in app.js | Key Globals Mapped | Key Functions to Port |
|---|-------|------------------------|-------------------|----------------------|
| 1 | **settingsStore** | ~100 | `diyPlayerMode`, `hotkeySettings`, `playbackQuality`, all `*_STORE_KEY` constants, all auto-hide flags (`userCapsuleAutoHide`, `fxFabAutoHide`, `controlsAutoHide`, `playlistPanelPinned`, `freeCamera`) | `readSavedVolume()`, `readDiyModePreference()`, `saveDiyModePreference()`, `readBooleanPreference()`, `saveBooleanPreference()`, `readHotkeySettings()` |
| 2 | **fxStore** | ~150 | `fx` object (100+ visual effect params), `playbackVisualPreset`, `presetTransition`, `fxDefaults`, `PACKAGED_DEFAULT_FX_SNAPSHOT` | `clonePackagedDefaultFxSnapshot()`, `normalizeDevelopmentLockedFxState()`, `readSavedPlaybackVisualPreset()`, `applyVisualPreset()`, `switchVisualPreset()` |
| 3 | **audioStore** | ~120 | `audio`, `audioCtx`, `source`, `analyser`, `beatAnalyser`, `gainNode`, `fftSize`, `frequencyData`, `timeDomainData`, `beatFrequencyData`, `beatTimeDomainData` | `initAudioContext()`, `createAudioElement()`, `setVolume()`, `applyVolumeToAudio()` |
| 4 | **playbackStore** | ~80 | `playlist`, `playQueue`, `currentIdx`, `playing`, `playToggleBusy`, `playMode`, `queueViewTab`, `miniQueueOpen` | `playQueueAt()`, `togglePlay()`, `nextTrack()`, `prevTrack()`, `cyclePlayMode()`, `shuffleQueue()`, `clearQueue()`, `removeFromQueue()` |
| 5 | **visualStore** | ~100 | All FFT energy vars (`bass`, `mid`, `treble`, `audioEnergy`, `beatPulse`), smooth values, `beatCam`, `rtBeat`, `cinemaDynamics`, `cinemaTrackProfile`, `djMode`, `lyricSun*`, `pointerParallax`, `headParallax`, `gestureRotation`, `orbit`, beat map caches | Already partially done — needs `resetAudioVisualState()`, `pulseObjectValue()` |
| 6 | **lyricsStore** | ~80 | `lyricsLines`, `lyricsVisible`, `lyricsHasNativeKaraoke`, `lyricsTimingSource`, `lyricSourceMode`, `customLyricMap`, `customLyricPrefs`, `originalLyricsState` | `fetchLyric()`, `setOriginalLyricsState()`, `applyCustomLyricState()`, `saveCustomLyricForCurrent()`, `deleteCustomLyricForCurrent()`, `parseCustomLyricText()`, `tickLyricsParticles()` |
| 7 | **searchStore** | ~60 | `searchMode`, `podcastResults`, `podcastPrograms`, `podcastCurrentRadio`, `searchLastResultQuery` | `doSearch()`, `setSearchMode()`, `loadPodcastHot()`, `doPodcastSearch()`, `renderSearchHistory()`, `searchLooksLikeDerivative()` |
| 8 | **authStore** | ~150 | `loginStatus`, `qqLoginStatus`, `loginProvider`, `activeAccountProvider`, `dualAccountMode`, `qrPollTimer`, `qrKey`, all busy flags | `showLoginModal()`, `closeLoginModal()`, `refreshQr()`, `startQrPoll()`, `stopQrPoll()`, `checkQr()`, `openNeteaseWebLogin()`, `openQQWebLogin()`, `refreshQQLoginStatus()`, `logoutActiveAccount()`, `doLogout()` |
| 9 | **userStore** | ~80 | `userPlaylists`, `qqPlaylists`, `myPodcastCollections`, `myPodcastItems`, `playlistCoverCache`, `likedSongMap`, `likeBusyMap`, `collectTargetSong`, `collectBusy`, `customCoverMap` | `refreshUserPlaylists()`, `toggleLikeSong()`, `syncLikeStatusForSongs()`, `openCollectModal()`, `addCollectTargetToPlaylist()` |
| 10 | **shelfStore** | ~60 | `shelfManager` state, `shelfHoverCue`, `shelfVisibility` | `scheduleShelfRebuild()`, `safeShelfRebuild()`, `updateShelfHoverCueFromPointer()`, `tickShelfHoverCue()` |
| 11 | **homeStore** | ~100 | `homeDiscoverState`, `homeWeatherRadioState`, `listenStatsState`, `emptyHomeActive`, `homeForcedOpen`, `homeSuppressed`, `visualGuideState` | `refreshHomeDiscover()`, `loadWeatherRadio()`, `updateListenStats()` |
| 12 | **uiStore** | ~120 | `controlsAutoHide`, `controlsHovering`, `controlsHideTimer`, `immersiveMode`, `immersiveState`, `coverCropState`, `uploadTipTimer`, `visualGuideActive`, `desktopRuntimeState` | `toggleDiyMode()`, `toggleFxFabAutoHide()`, `toggleControlsAutoHide()`, `toggleUserCapsuleAutoHide()`, `toggleImmersiveMode()`, `applyDiyMode()`, `layoutFullscreenDiyZone()`, `updateFullscreenDiyPeekFromPointer()`, `applyUserCapsuleAutoHideState()`, `applyFxFabAutoHideState()` |
| 13 | **performanceStore** | ~100 | `renderPowerState`, `runtimePerfState`, `coverDepthCache`, `coverDepthCacheKeys`, `aiDepthPipeline`, `appPerfMarks` | `trimRuntimeCaches()`, `applyRendererPowerMode()`, `installRenderPowerHooks()`, `markAppPerf()`, `collectRuntimePerfSnapshot()`, `shouldSkipAdaptiveRenderFrame()` |

### Phase 2: Business Logic — Extract Hooks (5-7 days)

Convert each function group from app.js into a hook that operates on stores.

| # | Hook | Lines in app.js | Stores Operated On | Priority |
|---|------|----------------|-------------------|----------|
| 1 | **useAudioPlayback** | ~200 | audioStore, playbackStore, userStore | HIGH |
| 2 | **useAudioAnalysis** | ~150 | audioStore, visualStore | HIGH |
| 3 | **useBeatDetection** | ~300 | visualStore, playbackStore | HIGH |
| 4 | **useLyrics** | ~120 | lyricsStore, audioStore | MEDIUM |
| 5 | **useSearch** | ~100 | searchStore, playbackStore | MEDIUM |
| 6 | **useAuth** | ~200 | authStore, userStore, uiStore | MEDIUM |
| 7 | **usePlaylists** | ~100 | userStore, authStore, uiStore | MEDIUM |
| 8 | **useVisualEngine** | ~500 | visualStore, fxStore, audioStore, performanceStore | HIGH |
| 9 | **useShelf** | ~100 | shelfStore, playbackStore | LOW |
| 10 | **useHotkeys** | ~80 | settingsStore, playbackStore, audioStore, uiStore | MEDIUM |
| 11 | **usePerformance** | ~120 | performanceStore | LOW |
| 12 | **useHomeDiscover** | ~150 | homeStore, authStore | LOW |
| 13 | **useCoverCrop** | ~60 | uiStore, userStore | LOW |

### Phase 3: Visualization — Single File (4-5 days)

**Constraint**: Keep all Three.js + WebGL visualization logic in ONE file.

#### Target file: `src/mainview/legacy/visuals/VisualEngine.ts`

This single file will contain:

```
VisualEngine.ts (~4,000-5,000 lines)
├── [constants]          — SKULL_PRESET_INDEX, VISUAL_PRESET_SCHEMA, shader sources
├── [types]              — BeatEvent, CameraPose, ParticleConfig, etc.
├── initThreeJs()        — Scene, Camera, WebGLRenderer setup
├── createParticles()    — Main particle geometry + shader material
├── createBloomParticles() — Bloom/additive particle layer
├── createSkullLayer()   — Skull-specific particle geometry (decimation points)
├── createRippleSystem() — Ripple effect geometry + management
├── createFloatLayer()   — Floating UI layer for presets
├── createCoverTexture() — Cover art texture loading + AI depth processing
├── createVinylGeometry() — Spinning vinyl disc
├── startRenderLoop()    — Main animate() loop extracted from app.js
│   ├── readFFTData()    — GetByteFrequencyData → bass/mid/treble/energy
│   ├── processBeatEngine() — Onset detection, beatCam, rtBeat update
│   ├── tickBeatMap()    — Scheduled beatmap kick events
│   ├── updateRipples()  — Ripple particle updates
│   ├── updateFloatLayer() — Preset UI float layer
│   ├── updateParticles() — Audio-reactive particle positioning
│   ├── updateCamera()   — Orbit + cinema dynamics + free camera
│   ├── updateGestureRotation() — Mouse drag / head parallax / inertia
│   ├── updateSkullLayer() — Skull-specific visual layer
│   ├── updateStageLyrics3D() — 3D lyric positioning
│   └── render()         — renderer.render(scene, camera)
├── applyUniforms()      — Update shader uniforms each frame
├── triggerRipple()      — Add ripple event
├── toggleFreeCamera()   — Free camera toggle
├── applyCinemaProfile() — Cinema dynamics from beatmap
├── tickGestureRotation() — Mouse drag + head parallax + inertia
├── dispose()            — Clean up Three.js objects, cancel animation frame
└── export default       — Singleton factory function
```

**Key design decisions**:
- This is the **only file** that imports `THREE` — all other code stays framework-agnostic
- The hook `useVisualEngine` becomes a thin SolidJS wrapper that calls into VisualEngine singleton
- VisualEngine receives audio state via stores (no direct DOM access)
- All shader sources kept as template literals in this file
- Cover art textures loaded asynchronously, cached in store

### Phase 4: Component Reactivity — Connect UI (4-5 days)

Wire each static component to its appropriate stores + hooks.

| Component | Store(s) | Hook(s) | Complexity |
|-----------|----------|---------|------------|
| **Background** | visualStore, fxStore | useVisualEngine | LOW |
| **Splash** | authStore | useAuth | LOW |
| **TopRight** | authStore, uiStore | useAuth, useSettings | MEDIUM |
| **SearchArea** | searchStore | useSearch | MEDIUM |
| **EmptyHome** | homeStore | useHomeDiscover | MEDIUM |
| **FxPanel** | fxStore, uiStore | useFxPanel | MEDIUM |
| **PlaylistPanel** | playbackStore, userStore | usePlaylists, useAudioPlayback | HIGH |
| **StageLyrics** | lyricsStore, visualStore | useLyrics, useVisualEngine | HIGH |
| **BottomBar** | playbackStore, audioStore, fxStore | useAudioPlayback | HIGH |
| **GestureHud** | uiStore, visualStore | useVisualEngine | MEDIUM |
| **ThumbWrap** | playbackStore, userStore | — | LOW |
| **VisualGuide** | uiStore, settingsStore | — | LOW |
| **Modals** | authStore, uiStore | useAuth | MEDIUM |
| **Overlays** | uiStore, playbackStore | — | LOW |
| **StatusChips** | playbackStore | — | LOW |
| **TrialBanner** | uiStore | — | LOW |
| **HiddenInputs** | uiStore | — | LOW |
| **LegacyComponents** | — | — | LOW (deletion target) |

### Phase 5: Cleanup & Deprecation (1-2 days)

1. Delete `public/legacy/app.js`
2. Delete `public/legacy/modules/`
3. Delete `src/mainview/components/LegacyComponents.tsx`
4. Update `App.tsx` — remove script injection, wire up all hooks at root
5. Update `MIGRATION_PLAN.md` — mark all phases as complete
6. Run lint + typecheck to ensure nothing broken
7. Manual QA: test playback, visualization, login, search, playlists, lyrics

---

## Execution Order (Critical Path)

```
Phase 0 → Phase 1 → Phase 2(1-3) → Phase 3 → Phase 4(HIGH) → Phase 2(4-7) → Phase 4(MED/LOW) → Phase 2(8-13) → Phase 4(LOW) → Phase 5
```

**Parallelizable after Phase 1**:
- Phase 2 hooks #4-7 (useLyrics, useSearch, useAuth, usePlaylists) can be done in parallel
- Phase 2 hook #10-13 (useHotkeys, usePerformance, useHomeDiscover, useCoverCrop) can be done in parallel with Phase 3

**Total estimated effort**: ~3-4 weeks

---

## Mapping Reference: Global Vars → Store

Here are the key variable groupings from app.js that map to stores:

### Settings & Preferences (settingsStore)
```
diyPlayerMode, hotkeySettings, playbackQuality, qqPlaybackQualityCeiling,
DIY_MODE_STORE_KEY, FREE_CAMERA_STORE_KEY, HOTKEY_SETTINGS_STORE_KEY,
VISUAL_GUIDE_SEEN_STORE_KEY, PLAYLIST_PANEL_PIN_STORE_KEY,
USER_CAPSULE_AUTO_HIDE_STORE_KEY, FX_FAB_AUTO_HIDE_STORE_KEY,
CONTROLS_AUTO_HIDE_STORE_KEY, CUSTOM_COVER_STORE_KEY,
CUSTOM_LYRIC_STORE_KEY, CUSTOM_LYRIC_PREF_STORE_KEY,
LYRIC_LAYOUT_STORE_KEY, LOCAL_BEATMAP_STORE_KEY, LOCAL_BEAT_PREF_STORE_KEY
```

### UI State (uiStore)
```
controlsAutoHide, controlsHovering, controlsHideTimer, controlsLastMoveAt,
cursorHideTimer, fxPanelPinned, playlistPanelPinned, userCapsuleAutoHide,
fxFabAutoHide, fxFabAutoHideRevealArmed, immersiveMode, immersiveState,
coverCropState, visualGuideActive, visualGuideStep, visualGuideState,
uploadTipTimer, miniQueueOpen, queueViewTab, queuePanelDirty
```

### Audio (audioStore)
```
audio, audioCtx, source, analyser, beatAnalyser, gainNode, fftSize,
audioReady, volume, targetVolume, lastNonZeroVolume, volumeCloseTimer,
audioFadeTimer, audioElementFadeFrame, audioFadeSerial,
frequencyData, timeDomainData, beatFrequencyData, beatTimeDomainData
```

### Playback (playbackStore)
```
playlist, playQueue, currentIdx, playing, playToggleBusy, playMode,
queueViewTab, miniQueueOpen, trackSwitchToken
```

### Visual / Beat (visualStore)
```
bass, mid, treble, audioEnergy, beatPulse, prevEnergy,
smoothBass, smoothMid, smoothTreb, smoothEnergy,
bassPeak, midPeak, treblePeak, energyPeak, beatOnsetFlag, lastStrongDrop,
beatCam, rtBeat, cinemaDynamics, cinemaTrackProfile, djMode,
lyricSunEnergy, lyricSunTarget, lyricSunHold, lyricSunAvg, lyricSunPeak,
pointerParallax, pointerTarget, headParallax, gestureRotation, orbit,
beatMapCache, currentBeatMap, djBeatMapCache, currentDjBeatMap,
beatMapNextIdx, djBeatMapNextIdx, djBeatPulseNextIdx,
liveCamAvg, liveCamPeak, liveCamLastRaw
```

### Lyrics (lyricsStore)
```
lyricsLines, lyricsVisible, lyricsHasNativeKaraoke, lyricsTimingSource,
lyricSourceMode, originalLyricsState, customLyricMap, customLyricPrefs,
localBeatMapCache, localBeatMapPrefs, localBeatAnalysis
```

### Search (searchStore)
```
searchMode, podcastResults, podcastPrograms, podcastCurrentRadio
```

### Auth (authStore)
```
loginStatus, qqLoginStatus, loginProvider, activeAccountProvider,
dualAccountMode, qrPollTimer, qrKey,
qqLoginAutoRefreshTimer, qqLoginWasLoggedIn,
qqCookieBusy, neteaseWebLoginBusy, qqWebLoginBusy, qqManualCookieOpen,
loginStatusChecked, loginStatusCheckFailed
```

### User / Library (userStore)
```
userPlaylists, qqPlaylists, myPodcastCollections, myPodcastItems,
playlistCoverCache, likedSongMap, likeBusyMap, likeStatusToken,
collectTargetSong, collectBusy, customCoverMap, currentLocalSong
```

### Home (homeStore)
```
homeDiscoverState, homeDiscoverToken, homeVisualPresetActive,
homeVisualPrevPreset, homeWeatherRadioState, homeWeatherToken,
homeWeatherLoadTimer, homeWeatherLoadPromise,
weatherRadioStartBusy, activeRadioContext, listenStatsState, listenSession,
emptyHomeActive, homeForcedOpen, homeSuppressed
```

### Performance (performanceStore)
```
coverProcessToken, aiDepthPipeline, aiDepthReady, aiDepthBusy, aiDepthFailUntil,
coverDepthCache, coverDepthCacheKeys, aiDepthLastRunAt,
renderPowerState, backgroundCacheTrimTimer, runtimePerfState,
appPerfMarks, desktopRuntimeState, updatePreviewState
```

### FX (fxStore)
```
fx, fxDefaults, playbackVisualPreset, startupVisualPreviewActive,
presetTransition, PACKAGED_DEFAULT_FX_SNAPSHOT
```

### Shelf (shelfStore)
```
shelfManager state (created in DOM, managed via refs)
```

---

## File Structure After Migration

```
src/mainview/
├── stores/
│   ├── index.ts                  # barrel exports
│   ├── settingsStore.ts
│   ├── fxStore.ts
│   ├── audioStore.ts             # ✅ partial
│   ├── playbackStore.ts
│   ├── visualStore.ts            # ✅ partial
│   ├── lyricsStore.ts
│   ├── searchStore.ts
│   ├── authStore.ts
│   ├── userStore.ts
│   ├── shelfStore.ts
│   ├── homeStore.ts
│   ├── uiStore.ts
│   └── performanceStore.ts
├── hooks/
│   ├── index.ts                  # barrel exports
│   ├── useAudioPlayback.ts       # ✅ partial
│   ├── useAudioAnalysis.ts       # NEW
│   ├── useBeatDetection.ts       # ✅ partial
│   ├── useLyrics.ts
│   ├── useSearch.ts
│   ├── useAuth.ts
│   ├── usePlaylists.ts
│   ├── useVisualEngine.ts        # ✅ partial — thin wrapper
│   ├── useShelf.ts
│   ├── useHotkeys.ts
│   ├── usePerformance.ts
│   ├── useHomeDiscover.ts
│   ├── useCoverCrop.ts
│   └── useLocalStorage.ts        # NEW
├── legacy/
│   ├── visuals/
│   │   └── VisualEngine.ts       # NEW — single file, ~4-5k lines
│   └── ui/
│       └── (empty, future use)
├── components/
│   ├── index.ts                  # barrel exports
│   ├── Background.tsx
│   ├── Splash.tsx
│   ├── panels/
│   │   ├── TopRight.tsx
│   │   ├── SearchArea.tsx
│   │   ├── EmptyHome.tsx
│   │   ├── FxPanel.tsx
│   │   ├── PlaylistPanel.tsx
│   │   ├── StageLyrics.tsx
│   │   ├── BottomBar.tsx
│   │   └── Modals.tsx
│   └── ui/
│       ├── GestureHud.tsx
│       ├── ThumbWrap.tsx
│       ├── VisualGuide.tsx
│       ├── StatusChips.tsx
│       ├── Overlays.tsx
│       ├── TrialBanner.tsx
│       └── HiddenInputs.tsx
├── App.tsx                       # updated — no script injection
├── main.tsx                      # updated — root store providers
└── lib/
    └── api.ts                    # RPC client (already exists)
```
