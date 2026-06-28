// State module — defines all global state variables
// Used by: all other modules via window properties

(function(){
  const S = window.__MINERADIO_STATE__ = {};

  // Audio state
  S.audio = null; S.audioCtx = null; S.source = null; S.analyser = null;
  S.beatAnalyser = null; S.gainNode = null; S.audioReady = false;
  S.uiSfxCtx = null; S.lastShelfSelectSfxAt = 0;
  S.FFT_SIZE = 2048;
  S.frequencyData = new Uint8Array(1024);
  S.timeDomainData = new Uint8Array(1024);
  S.BEAT_FFT_SIZE = 2048;
  S.beatFrequencyData = new Uint8Array(1024);
  S.beatTimeDomainData = new Uint8Array(1024);
  S.bass = 0; S.mid = 0; S.treble = 0; S.audioEnergy = 0; S.beatPulse = 0; S.prevEnergy = 0;
  S.lyricSunEnergy = 0; S.lyricSunTarget = 0; S.lyricSunHold = 0; S.lyricSunAvg = 0; S.lyricSunPeak = 0.55;
  S.smoothBass = 0; S.smoothMid = 0; S.smoothTreb = 0; S.smoothEnergy = 0;
  S.bassPeak = 0.12; S.midPeak = 0.10; S.treblePeak = 0.08; S.energyPeak = 0.10;
  S.beatOnsetFlag = false; S.lastStrongDrop = 0;

  // Playlist / Queue
  S.lyricsLines = []; S.lyricsVisible = false; S.lyricsHasNativeKaraoke = false; S.lyricsTimingSource = 'none';
  S.playlist = []; S.playQueue = []; S.currentIdx = -1; S.playing = false; S.playToggleBusy = false;
  S.searchMode = 'song'; S.podcastResults = []; S.podcastPrograms = []; S.podcastCurrentRadio = null;

  // Login state
  S.loginStatus = { loggedIn: false, vipType: 0, vipLevel: 'none', isVip: false, isSvip: false, vipLabel: '无VIP' };
  S.qqLoginStatus = { provider: 'qq', loggedIn: false, preview: false, nickname: 'QQ 音乐', userId: '', avatar: '', vipType: 0 };
  S.qqLoginAutoRefreshTimer = null;
  S.qqLoginWasLoggedIn = false;
  S.loginProvider = 'netease';
  S.activeAccountProvider = 'netease';
  S.dualAccountMode = false;
  S.qqCookieBusy = false;
  S.neteaseWebLoginBusy = false;
  S.qqWebLoginBusy = false;
  S.qqManualCookieOpen = false;
  S.loginStatusChecked = false; S.loginStatusCheckFailed = false;
  S.qrPollTimer = null; S.qrKey = null;
  S.volumeTween = null; S.trackSwitchToken = 0;
  S.audioFadeTimer = null; S.audioElementFadeFrame = 0; S.audioFadeSerial = 0;
  S.AUDIO_FADE_IN_MS = 460; S.AUDIO_FADE_OUT_MS = 420; S.AUDIO_SILENCE_GAIN = 0.0001;

  // Collections
  S.userPlaylists = []; S.qqPlaylists = []; S.myPodcastCollections = []; S.myPodcastItems = {}; S.playlistCoverCache = {};

  // UI state
  S.immersiveMode = false;
  S.fxFabAutoHide = false;
  S.fxFabAutoHideRevealArmed = true;
  S.userCapsuleAutoHide = false;
  S.desktopRuntimeState = {};
  S.desktopFullscreenActive = false;
  S.queueViewTab = 'queue'; S.playMode = 'loop'; S.miniQueueOpen = false;
  S.miniQueueRenderSeq = 0; S.queueRenderSeq = 0; S.playlistRenderSeq = 0;
  S.queuePanelDirty = false;
  S.PLAYLIST_PANEL_BATCH_SIZE = 28;
  S.playlistPanelRenderLimit = 28;
  S.playlistPanelLazyBound = false;
  S.PLAYLIST_DETAIL_INITIAL_RENDER = 64;
  S.PLAYLIST_DETAIL_BATCH_SIZE = 48;
  S.smoothWheelScrollBound = false;

  // Store keys
  S.CUSTOM_COVER_STORE_KEY = 'mineradio-custom-covers';
  S.CUSTOM_LYRIC_STORE_KEY = 'mineradio-custom-lyrics-v1';
  S.CUSTOM_LYRIC_PREF_STORE_KEY = 'mineradio-custom-lyric-prefs-v1';
  S.LYRIC_LAYOUT_STORE_KEY = 'mineradio-lyric-layout-v1';
  S.VISUAL_PRESET_SCHEMA = 'skull-preset-v2';
  S.PLAYBACK_QUALITY_STORE_KEY = 'mineradio-playback-quality-v1';
  S.UPLOAD_TIP_STORE_KEY = 'mineradio-upload-tip-seen';
  S.DIY_MODE_STORE_KEY = 'mineradio-diy-player-mode-v1';
  S.PLAYLIST_PANEL_PIN_STORE_KEY = 'mineradio-playlist-panel-pinned-v1';
  S.USER_CAPSULE_AUTO_HIDE_STORE_KEY = 'mineradio-user-capsule-auto-hide-v1';
  S.FX_FAB_AUTO_HIDE_STORE_KEY = 'mineradio-fx-fab-auto-hide-v1';
  S.CONTROLS_AUTO_HIDE_STORE_KEY = 'mineradio-controls-auto-hide-v1';
  S.FREE_CAMERA_STORE_KEY = 'mineradio-free-camera-v1';
  S.HOTKEY_SETTINGS_STORE_KEY = 'mineradio-hotkey-settings-v1';
  S.VISUAL_GUIDE_SEEN_STORE_KEY = 'mineradio-visual-guide-seen-v2';
  S.LOCAL_BEATMAP_STORE_KEY = 'mineradio-local-beatmaps-v1';
  S.LOCAL_BEAT_PREF_STORE_KEY = 'mineradio-local-beatmap-prefs-v1';
  S.HOME_LISTEN_STATS_KEY = 'mineradio-listen-stats-v1';
  S.HOME_WEATHER_CITY_KEY = 'mineradio-weather-city';

  // Expose to window for backward compatibility
  const keys = Object.keys(S);
  for (const key of keys) {
    if (typeof key === 'string' && !key.includes('_')) {
      try { window[key] = S[key]; } catch {}
    }
  }
})();
