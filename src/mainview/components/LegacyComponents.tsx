// @ts-nocheck — Legacy bridge file: onclick strings invoke globals from app.js
import { Component } from "solid-js";

export const Splash: Component = () => (
  <div id="splash">
    <canvas id="splash-canvas"></canvas>
    <div class="splash-bg-noise"></div>
    <div class="splash-content">
      <div class="splash-wordmark" id="splash-wordmark" aria-label="Mineradio">
        <span class="splash-word-mine">Mine</span>
        <span class="splash-word-radio" aria-label="radio">
          rad<span class="splash-word-i" aria-hidden="true"></span><span class="splash-word-o">o</span>
        </span>
      </div>
      <div class="splash-signal-line"></div>
      <div class="splash-sub">private visual radio</div>
      <div class="splash-enter" aria-hidden="true">点击进入</div>
    </div>
  </div>
);

export const SearchArea: Component = () => (
  <div id="search-area">
    <div id="search-stack">
      <div id="search-box">
        <svg id="search-icon" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
        <input id="search-input" type="text" placeholder="搜索歌曲、歌手..." autocomplete="off" spellcheck="false" />
      </div>
      <div id="search-mode-tabs" class="search-mode-tabs" role="tablist" aria-label="Search mode">
        <button id="search-mode-song" class="active" type="button" onclick="setSearchMode('song')" aria-selected="true">All</button>
        <button id="search-mode-netease" type="button" onclick="setSearchMode('netease')" aria-selected="false">NE</button>
        <button id="search-mode-qq" type="button" onclick="setSearchMode('qq')" aria-selected="false">QQ</button>
        <button id="search-mode-podcast" type="button" onclick="setSearchMode('podcast')" aria-selected="false">Podcast</button>
      </div>
      <div id="search-results"></div>
    </div>
    <div id="upload-actions">
      <button id="upload-btn" class="icon-btn" onclick="document.getElementById('file-input').click()" title="导入音乐或封面">
        <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
        </svg>
      </button>
      <button id="clear-cover-btn" class="icon-btn" onclick="clearCustomCoverForCurrent()" title="取消自定义封面" aria-label="取消自定义封面">×</button>
      <div id="upload-tip" role="status" aria-live="polite">
        <button class="upload-tip-close" onclick="closeUploadTip(true)" aria-label="关闭提示">×</button>
        <span class="upload-tip-title">导入入口</span>
        这里支持上传歌曲，也可以给当前曲目换自定义封面。
      </div>
    </div>
  </div>
);

export const TopRight: Component = () => (
  <div id="top-right">
    <button id="user-capsule-hide-btn" class="user-capsule-hide-btn" type="button" onclick="toggleUserCapsuleAutoHide(event)" title="自动隐藏账号胶囊">‹</button>
    <button id="home-btn" class="icon-btn" onclick="goHome()" title="回到 Home" aria-label="回到 Home">
      <svg width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.9" viewBox="0 0 24 24">
        <path d="M3 10.8 12 3l9 7.8"/><path d="M5 10v10h14V10"/><path d="M9.5 20v-5h5v5"/>
      </svg>
    </button>
    <button id="user-btn" class="icon-btn logged-out" onclick="onUserBtnClick()" title="登录账号">
      <span class="login-word">登录</span>
    </button>
  </div>
);

export const EmptyHome: Component = () => (
  <section id="empty-home" aria-label="Mineradio home">
    <div class="empty-home-shell">
      <div class="home-hero">
        <div class="home-hero-inner home-construction-inner">
          <div class="home-title home-construction-title">🚧此处施工，敬请期待🚧</div>
          <button class="home-chip home-console-chip" type="button" onclick="openHomePlayerConsole()">展开播放器控制台</button>
        </div>
      </div>
      <div class="home-grid">
        <button class="home-card" data-home-tone="library" type="button" onclick="openHomeLibrary()">
          <div class="home-card-label">Library</div>
          <div class="home-card-title" id="home-weather-card-title">我的歌单</div>
          <div class="home-card-sub" id="home-weather-card-sub">打开左侧歌单库</div>
          <div class="home-card-art" id="home-weather-art"></div>
        </button>
        <button class="home-card" data-home-tone="mix" type="button" onclick="playHomeSong(0)">
          <div class="home-card-label">Daily</div>
          <div class="home-card-title" id="home-daily-title">每日推荐</div>
          <div class="home-card-sub" id="home-daily-sub">登录后同步你的今日歌曲</div>
          <div class="home-card-art" id="home-daily-art"></div>
        </button>
        <button class="home-card" data-home-tone="playlist" type="button" onclick="playHomeSong(1)">
          <div class="home-card-label">Song</div>
          <div class="home-card-title" id="home-private-title">私人电台</div>
          <div class="home-card-sub" id="home-private-sub">从你的推荐和歌单里开播</div>
          <div class="home-card-art" id="home-private-art"></div>
        </button>
        <button class="home-card" data-home-tone="mix" type="button" onclick="playHomeRecent()">
          <div class="home-card-label">Continue</div>
          <div class="home-card-title" id="home-continue-title">继续听</div>
          <div class="home-card-sub" id="home-continue-sub">最近播放会出现在这里</div>
          <div class="home-card-art" id="home-continue-art"></div>
        </button>
        <button class="home-card" data-home-tone="local" type="button" onclick="openHomeInsight()">
          <div class="home-card-label">Profile</div>
          <div class="home-card-title" id="home-profile-title">听歌画像</div>
          <div class="home-card-sub" id="home-profile-sub">播放几首后生成偏好</div>
          <div class="home-card-art" id="home-profile-art"></div>
        </button>
        <button class="home-card" data-home-tone="local" type="button" onclick="playHomeSong(2)">
          <div class="home-card-label">Song</div>
          <div class="home-card-title" id="home-library-title">常听歌手</div>
          <div class="home-card-sub" id="home-library-sub">你的偏好会在这里汇总</div>
          <div class="home-card-art" id="home-library-art"></div>
        </button>
      </div>
      <div class="home-rail">
        <div class="home-section-head">
          <div class="home-section-title" id="home-rail-title">为你准备</div>
          <div class="home-section-note" id="home-rail-note">正在整理推荐</div>
        </div>
        <div id="home-tile-row" class="home-tile-row"></div>
      </div>
    </div>
  </section>
);

export const Background: Component = () => (
  <>
    <div id="custom-bg"><video id="custom-bg-video" muted loop playsinline preload="metadata"></video></div>
    <div id="album-bg"></div>
    <div id="canvas-container"></div>
  </>
);

export const FxPanel: Component = () => (
  <>
    <button id="fx-fab" title="视觉控制台">
      <svg width="21" height="21" fill="none" stroke="currentColor" stroke-width="1.9" viewBox="0 0 24 24">
        <path d="M4 7h8"/><path d="M16 7h4"/><circle cx="14" cy="7" r="2"/><path d="M4 17h4"/><path d="M12 17h8"/><circle cx="10" cy="17" r="2"/></svg>
    </button>
    <button id="fx-fab-hide-btn" type="button" onclick="toggleFxFabAutoHide(event)">‹</button>
    <div id="fx-panel">
      <div class="fx-head">
        <div><div class="fx-title">视觉控制台</div><div class="fx-sub">MINERADIO VISUALS · 鼠标移开自动隐藏</div></div>
      </div>
      <div class="fx-section-label">视觉预设</div>
      <div class="preset-grid" id="preset-grid"></div>
    </div>
  </>
);

export const PlaylistPanel: Component = () => (
  <div id="playlist-panel">
    <div class="queue-head">
      <div>
        <div class="fx-title">歌单 / 队列</div>
        <div class="fx-sub">QUEUE · 鼠标移开自动隐藏</div>
      </div>
      <div class="queue-head-act">
        <button id="playlist-pin-btn" class="fx-mini-btn ghost playlist-pin-btn" onclick="togglePlaylistPanelPinned()">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 4l6 6"/><path d="M5 15l4 4"/><path d="M14 4l-2 5-4 4-3 2 4 4 2-3 4-4 5-2z"/></svg>
        </button>
        <button class="fx-mini-btn ghost" onclick="shuffleQueue()">随机</button>
      </div>
    </div>
    <div class="panel-tabs">
      <button id="tab-queue" class="panel-tab active" onclick="switchPlaylistTab('queue')">当前队列</button>
      <button id="tab-pl" class="panel-tab" onclick="switchPlaylistTab('playlists')">我的歌单</button>
      <button id="tab-podcast" class="panel-tab" onclick="switchPlaylistTab('podcasts')">我的播客</button>
    </div>
    <div id="queue-pane">
      <div class="queue-toolbar">
        <div id="play-mode-chip" class="queue-chip">顺序循环</div>
        <div style="display:flex;gap:6px">
          <button class="fx-mini-btn ghost" onclick="cyclePlayMode()" style="height:26px;padding:0 10px;font-size:11px">切换模式</button>
          <button class="fx-mini-btn ghost" onclick="clearQueue()" style="height:26px;padding:0 10px;font-size:11px">清空</button>
        </div>
      </div>
      <div id="queue-list" class="queue-list"></div>
    </div>
    <div id="pl-pane" style="display:none">
      <div class="queue-toolbar">
        <div class="queue-chip">登录后显示网易云 / QQ 歌单</div>
        <button class="fx-mini-btn ghost" onclick="refreshUserPlaylists(true)" style="height:26px;padding:0 10px;font-size:11px">刷新</button>
      </div>
      <div id="pl-list" style="margin-top:6px"></div>
    </div>
    <div id="podcast-pane" style="display:none">
      <div class="queue-toolbar">
        <div class="queue-chip">收藏 / 创建 / 喜欢</div>
        <button class="fx-mini-btn ghost" onclick="refreshUserPlaylists(true)" style="height:26px;padding:0 10px;font-size:11px">刷新</button>
      </div>
      <div id="podcast-list"></div>
    </div>
  </div>
);

export const StageLyrics: Component = () => (
  <div id="stage-lyrics"></div>
);

export const GestureHud: Component = () => (
  <>
    <div id="gesture-hud" class="gesture-hud">
      <div>手势：<b id="gesture-label">待命</b></div>
      <div id="gesture-confirm" class="gesture-confirm">将手放进摄像头视野</div>
      <div class="gesture-meter"><span id="gesture-fill"></span></div>
      <div class="gesture-legend">手掌推开粒子 · 捏合旋转 · 握拳收束</div>
    </div>
    <canvas id="hand-canvas"></canvas>
  </>
);

export const ThumbWrap: Component = () => (
  <div id="thumb-wrap">
    <img id="thumb-cover" src="" alt="" />
    <div id="thumb-info">
      <div id="thumb-title" onclick="openTrackDetailModal('song')" title="歌曲详情"></div>
      <div id="thumb-artist" onclick="openTrackDetailModal('artist')" title="歌手详情"></div>
    </div>
  </div>
);

export const TrialBanner: Component = () => (
  <div id="trial-banner">
    <svg class="ic" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
    <span id="trial-text">仅播放试听片段</span>
    <span id="trial-login-btn" class="login-link" onclick="showLoginModal()">扫码登录</span>
    <span class="close" onclick="document.getElementById('trial-banner').classList.remove('show')">×</span>
  </div>
);

export const StatusChips: Component = () => (
  <>
    <div id="ai-depth-chip"><div class="mini-spin"></div><span id="ai-depth-text">AI 深度估计…</span></div>
    <div id="beat-chip"><div class="mini-spin"></div><span id="beat-text">分析节奏…</span></div>
  </>
);

export const VisualGuide: Component = () => (
  <div id="visual-guide" aria-live="polite" aria-hidden="true">
    <div class="visual-guide-scrim"></div>
    <div id="visual-guide-ring" class="visual-guide-ring"></div>
    <div id="visual-guide-card" class="visual-guide-card">...</div>
  </div>
);

export const BottomBar: Component = () => (
  <>
    <svg id="control-glass-svg" class="control-glass-filter-svg" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
      <defs>
        <filter id="mineradio-control-glass-filter" color-interpolation-filters="sRGB" x="-12%" y="-28%" width="124%" height="156%">
          <feImage id="control-glass-map" x="0" y="0" width="100%" height="100%" preserveAspectRatio="none" result="map"></feImage>
          <feDisplacementMap in="SourceGraphic" in2="map" scale="180" xChannelSelector="R" yChannelSelector="B" result="dispRed"></feDisplacementMap>
          <feOffset in="dispRed" dx="-90" dy="0" result="dispRedShifted"></feOffset>
          <feMerge result="dispRedAligned"><feMergeNode in="SourceGraphic"></feMergeNode><feMergeNode in="dispRedShifted"></feMergeNode></feMerge>
          <feColorMatrix in="dispRedAligned" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="red"></feColorMatrix>
          <feDisplacementMap in="SourceGraphic" in2="map" scale="170" xChannelSelector="R" yChannelSelector="B" result="dispGreen"></feDisplacementMap>
          <feOffset in="dispGreen" dx="-90" dy="0" result="dispGreenShifted"></feOffset>
          <feMerge result="dispGreenAligned"><feMergeNode in="SourceGraphic"></feMergeNode><feMergeNode in="dispGreenShifted"></feMergeNode></feMerge>
          <feColorMatrix in="dispGreenAligned" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="green"></feColorMatrix>
          <feDisplacementMap in="SourceGraphic" in2="map" scale="160" xChannelSelector="R" yChannelSelector="B" result="dispBlue"></feDisplacementMap>
          <feOffset in="dispBlue" dx="-90" dy="0" result="dispBlueShifted"></feOffset>
          <feMerge result="dispBlueAligned"><feMergeNode in="SourceGraphic"></feMergeNode><feMergeNode in="dispBlueShifted"></feMergeNode></feMerge>
          <feColorMatrix in="dispBlueAligned" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="blue"></feColorMatrix>
          <feBlend in="red" in2="green" mode="screen" result="rg"></feBlend>
          <feBlend in="rg" in2="blue" mode="screen" result="output"></feBlend>
          <feGaussianBlur in="output" stdDeviation="0.5"></feGaussianBlur>
        </filter>
        <filter id="mineradio-search-box-glass-filter" color-interpolation-filters="sRGB" x="-24%" y="-34%" width="158%" height="168%">
          <feImage id="search-box-glass-map" x="-10%" y="-4%" width="120%" height="108%" preserveAspectRatio="none" result="map"></feImage>
          <feDisplacementMap in="SourceGraphic" in2="map" scale="180" xChannelSelector="R" yChannelSelector="B" result="dispRed"></feDisplacementMap>
          <feOffset in="dispRed" dx="-90" dy="0" result="dispRedShifted"></feOffset>
          <feMerge result="dispRedAligned"><feMergeNode in="SourceGraphic"></feMergeNode><feMergeNode in="dispRedShifted"></feMergeNode></feMerge>
          <feColorMatrix in="dispRedAligned" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="red"></feColorMatrix>
          <feDisplacementMap in="SourceGraphic" in2="map" scale="170" xChannelSelector="R" yChannelSelector="B" result="dispGreen"></feDisplacementMap>
          <feOffset in="dispGreen" dx="-90" dy="0" result="dispGreenShifted"></feOffset>
          <feMerge result="dispGreenAligned"><feMergeNode in="SourceGraphic"></feMergeNode><feMergeNode in="dispGreenShifted"></feMergeNode></feMerge>
          <feColorMatrix in="dispGreenAligned" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="green"></feColorMatrix>
          <feDisplacementMap in="SourceGraphic" in2="map" scale="160" xChannelSelector="R" yChannelSelector="B" result="dispBlue"></feDisplacementMap>
          <feOffset in="dispBlue" dx="-90" dy="0" result="dispBlueShifted"></feOffset>
          <feMerge result="dispBlueAligned"><feMergeNode in="SourceGraphic"></feMergeNode><feMergeNode in="dispBlueShifted"></feMergeNode></feMerge>
          <feColorMatrix in="dispBlueAligned" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="blue"></feColorMatrix>
          <feBlend in="red" in2="green" mode="screen" result="rg"></feBlend>
          <feBlend in="rg" in2="blue" mode="screen" result="output"></feBlend>
          <feGaussianBlur in="output" stdDeviation="0.35"></feGaussianBlur>
        </filter>
      </defs>
    </svg>
    <button id="bottom-handle" type="button" aria-label="展开播放器控制台" title="播放器控制台"><span></span></button>
    <div id="bottom-bar">
      <div id="mini-queue-popover" class="mini-queue-popover" onclick="event.stopPropagation()">
        <div class="mini-queue-head">
          <div>
            <div class="mini-queue-title">当前队列</div>
            <div id="mini-queue-count" class="mini-queue-count">0 首</div>
          </div>
          <button class="fx-mini-btn ghost" onclick="closeMiniQueue()" title="关闭" style="height:26px;padding:0 9px;font-size:13px">×</button>
        </div>
        <div id="mini-queue-list" class="mini-queue-list"></div>
      </div>
      <div id="progress-bar"><div id="progress-fill"></div><div id="progress-thumb" aria-hidden="true"></div></div>
      <div id="controls">
        <div class="control-cluster actions">
          <div class="control-track">
            <div id="control-cover" class="control-cover cover-empty" aria-hidden="true"></div>
            <div class="control-meta">
              <div id="control-title" class="control-title" onclick="openTrackDetailModal('song')" title="歌曲详情"></div>
              <div id="control-artist" class="control-artist" onclick="openTrackDetailModal('artist')" title="歌手详情"></div>
            </div>
          </div>
          <div id="quality-control" class="quality-control">
            <button id="quality-btn" class="ctrl-btn quality-pill" onclick="toggleQualityPanel(event)" title="音质"><span id="quality-btn-label">臻音</span></button>
            <div class="quality-popover" onclick="event.stopPropagation()">
              <button class="quality-option svip-only" data-quality="jymaster" data-svip="1" onclick="setPlaybackQuality('jymaster')"><span>超清母带</span><small>SVIP / 最高规格</small></button>
              <button class="quality-option" data-quality="hires" onclick="setPlaybackQuality('hires')"><span>高清臻音</span><small>默认 / 细节优先</small></button>
              <button class="quality-option" data-quality="lossless" onclick="setPlaybackQuality('lossless')"><span>无损 SQ</span><small>FLAC 优先</small></button>
              <button class="quality-option" data-quality="exhigh" onclick="setPlaybackQuality('exhigh')"><span>极高 HQ</span><small>320kbps</small></button>
              <button class="quality-option" data-quality="standard" onclick="setPlaybackQuality('standard')"><span>标准</span><small>128kbps</small></button>
            </div>
          </div>
          <button id="heart-btn" class="ctrl-btn" onclick="toggleLikeCurrent()" title="红心喜欢">
            <svg class="heart-svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21.45c-.32 0-.62-.12-.86-.34l-1.23-1.12C5.54 16.03 2.25 13.05 2.25 8.9 2.25 5.48 4.88 2.9 8.28 2.9c1.7 0 3.35.72 4.52 1.96C13.97 3.62 15.62 2.9 17.32 2.9c3.4 0 6.03 2.58 6.03 6 0 4.15-3.29 7.13-7.66 11.09l-1.23 1.12c-.24.22-.54.34-.86.34z"/></svg>
          </button>
          <button id="collect-btn" class="ctrl-btn" onclick="openCollectModalForCurrent()" title="收藏到歌单">
            <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
          </button>
        </div>
        <div class="control-cluster transport">
          <button id="play-mode-btn" class="ctrl-btn" onclick="cyclePlayMode()" title="播放顺序">
            <svg id="play-mode-icon" width="19" height="19" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M17 2l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>
          </button>
          <button id="prev-btn" class="ctrl-btn" onclick="prevTrack()" title="上一首">
            <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg>
          </button>
          <button id="play-btn" class="ctrl-btn" onclick="togglePlay()" title="播放/暂停">
            <svg id="play-icon" width="20" height="20" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
          </button>
          <button id="next-btn" class="ctrl-btn" onclick="nextTrack()" title="下一首">
            <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>
          </button>
          <button id="mini-queue-btn" class="ctrl-btn" onclick="toggleMiniQueue(event)" title="当前队列">
            <svg width="19" height="19" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M3 6h.01"/><path d="M3 12h.01"/><path d="M3 18h.01"/></svg>
          </button>
        </div>
        <div class="control-cluster modes">
          <button class="ctrl-btn lyrics-toggle-btn" onclick="toggleLyricsPanel()" title="歌词"><span class="lyrics-word-icon">词</span></button>
          <div id="volume-control" class="volume-control">
            <button id="volume-btn" class="ctrl-btn" onclick="toggleVolumePanel(event)" title="音量 / 静音">
              <svg id="volume-icon" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/></svg>
            </button>
            <div class="volume-popover" onclick="event.stopPropagation()">
              <input id="volume-slider" type="range" min="0" max="1" step="0.01" value="1" aria-label="音量" />
              <span id="volume-value">100%</span>
            </div>
          </div>
          <button id="controls-hide-btn" class="ctrl-btn active" onclick="toggleControlsAutoHide()" title="控制条自动隐藏">
            <svg width="19" height="19" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M5 8h14"/><path d="M8 12h8"/><path d="M10 16h4"/></svg>
          </button>
          <button id="immersive-btn" class="ctrl-btn" onclick="toggleImmersiveMode()" title="全沉浸式" aria-label="全沉浸式" aria-pressed="false">
            <svg width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.9" viewBox="0 0 24 24"><path d="M4 9V5a1 1 0 0 1 1-1h4"/><path d="M15 4h4a1 1 0 0 1 1 1v4"/><path d="M20 15v4a1 1 0 0 1-1 1h-4"/><path d="M9 20H5a1 1 0 0 1-1-1v-4"/><circle cx="12" cy="12" r="2.2"/></svg>
          </button>
          <button class="ctrl-btn fullscreen-toggle-btn" onclick="toggleFullscreen()" title="全屏 (F)">
            <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M3 7V3h4"/><path d="M21 7V3h-4"/><path d="M3 17v4h4"/><path d="M21 17v4h-4"/></svg>
          </button>
          <div id="time-display">0:00 / 0:00</div>
        </div>
      </div>
    </div>
  </>
);

export const HiddenInputs: Component = () => (
  <>
    <input type="file" id="file-input" accept=".mp3,.flac,.wav,.ogg,.m4a,.jpg,.jpeg,.png,.webp" multiple style="display:none" />
    <input type="file" id="background-image-input" accept=".jpg,.jpeg,.png,.webp,.mp4,.webm,.mov,image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime" style="display:none" />
    <div id="drop-overlay"><div class="drop-text">拖放音乐或封面</div></div>
    <div id="free-camera-hint">自由镜头 R 固定/退出 · WASD 移动 · 鼠标转向</div>
    <div id="loading-overlay"><div class="spinner"></div></div>
    <canvas id="login-guide-canvas" aria-hidden="true"></canvas>
  </>
);

export const Overlays: Component = () => (
  <>
    <div id="toast"></div>
    <div id="source-fallback-notice" aria-live="polite">
      <div class="source-fallback-head">
        <div id="source-fallback-title" class="source-fallback-title">自动换源</div>
        <button class="source-fallback-close" type="button" onclick="closeSourceFallbackNotice()">×</button>
      </div>
      <div id="source-fallback-body" class="source-fallback-body"></div>
    </div>
  </>
);

export const Modals: Component = () => (
  <>
    <div id="login-modal" class="modal-mask">
      <div class="modal dual-login-modal">
        <div class="login-platform-tabs" id="login-platform-tabs">
          <button id="login-provider-netease" class="netease active" type="button" onclick="setLoginProvider('netease')">网易云</button>
          <button id="login-provider-qq" class="qq" type="button" onclick="setLoginProvider('qq')">QQ 音乐</button>
        </div>
        <div class="login-intro">
          <div class="login-intro-kicker">Mineradio</div>
          <div class="login-intro-title">音乐播放器，也是一座视觉舞台</div>
          <div class="login-intro-body">搜索或导入一首歌即可播放；登录后会同步歌单、红心和播客。</div>
        </div>
        <h2 id="login-modal-title">扫码登录网易云音乐</h2>
        <div id="login-modal-desc" class="desc">使用 <b>网易云音乐 App</b> 扫码。</div>
        <div id="qr-shell" class="qr-shell">
          <img id="qr-img" src="" alt="" />
          <button id="qq-web-login-card" class="qq-login-mark" type="button" onclick="openProviderWebLogin()"><b>QQ</b><span>打开官方扫码窗口</span></button>
        </div>
        <div id="qr-status">正在生成二维码…</div>
        <div id="qq-cookie-panel" class="qq-cookie-panel">
          <textarea id="qq-cookie-input" class="qq-cookie-input" spellcheck="false" autocomplete="off" placeholder="uin=...; qqmusic_key=...; qm_keyst=..."></textarea>
          <div class="qq-cookie-actions">
            <div class="qq-cookie-note">从 y.qq.com 的登录会话导入。</div>
            <button id="qq-cookie-save-btn" class="modal-btn primary" type="button" onclick="submitQQCookieLogin()">保存</button>
          </div>
        </div>
        <div class="btn-row">
          <button class="modal-btn" onclick="closeLoginModal()">取消</button>
          <button class="modal-btn" onclick="skipLoginAndFocusSearch()">先搜索一首歌</button>
          <button id="login-both-btn" class="modal-btn" onclick="requestDualLoginMode()">我两个都要</button>
          <button id="qq-cookie-toggle-btn" class="modal-btn" type="button" onclick="toggleQQCookiePanel()">手动导入</button>
          <button id="refresh-qr-btn" class="modal-btn primary" onclick="refreshQr()">刷新二维码</button>
        </div>
      </div>
    </div>
    <div id="user-modal" class="modal-mask">
      <div class="modal dual-user-modal">
        <h2>账号信息</h2>
        <div id="account-provider-chip" class="account-provider-chip netease"><span class="account-source-dot netease"></span><span>网易云音乐</span></div>
        <img id="user-modal-avatar" src="" style="width:72px;height:72px;border-radius:50%;margin:0 auto 12px;object-fit:cover;background:rgba(255,255,255,0.1);display:block" />
        <div id="user-modal-name" style="font-size:15px;margin-bottom:4px"></div>
        <div id="user-modal-vip" style="font-size:11px;color:rgba(255,255,255,0.5);margin-bottom:20px;letter-spacing:.5px"></div>
        <div class="user-platform-tabs" id="user-platform-tabs">...</div>
        <div class="btn-row">
          <button class="modal-btn" onclick="closeUserModal()">关闭</button>
          <button id="account-logout-btn" class="modal-btn primary" onclick="logoutActiveAccount()">退出当前平台</button>
        </div>
      </div>
    </div>
    <div id="cover-crop-modal" class="modal-mask">...</div>
    <div id="collect-modal" class="modal-mask">...</div>
    <div id="local-beat-modal" class="modal-mask">...</div>
    <div id="custom-lyric-modal" class="modal-mask">...</div>
    <div id="track-detail-modal" class="modal-mask">...</div>
    <div id="update-modal" class="modal-mask">...</div>
  </>
);
