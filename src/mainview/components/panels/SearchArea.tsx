// @ts-nocheck
import { Component } from "solid-js";

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
