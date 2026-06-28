// @ts-nocheck
import { Component } from "solid-js";

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
