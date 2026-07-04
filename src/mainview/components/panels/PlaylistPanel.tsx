// @ts-nocheck
import { proxyImageUrl } from "../../lib/api";
import { Component, createSignal, onMount, onCleanup, For, Show, createMemo } from "solid-js";
import { usePlayback } from "../../stores/playbackStore";
import { useSettings } from "../../stores/settingsStore";
import { useUser } from "../../stores/userStore";
import { useActionStore } from "../../stores/actionStore";
import { updateEmptyHomeVisibility } from "../../lib/homeVisibility";

const PlaylistPanel: Component = () => {
  const playback = usePlayback();
  const settings = useSettings();
  const user = useUser();
  const [tab, setTab] = createSignal<"queue" | "playlists" | "podcasts">("queue");

  // Listen for external tab switch requests via actionStore
  onMount(() => {
    useActionStore.getState().register({
      setPlaylistTab: (tab: string) => setTab(tab as any),
    });
  });

  const playModeLabel = () => {
    switch (playback.state.playMode) {
      case "shuffle": return "随机播放";
      case "single": return "单曲循环";
      default: return "顺序循环";
    }
  };

  function playSong(song: any, idx: number) {
    playback.set("currentIdx", idx);
    playback.set("currentSong", song);
    useActionStore.getState().hotkey("togglePlay");
    updateEmptyHomeVisibility();
  }

  function loadPlaylist(pl: any) {
    useActionStore.getState().loadPlaylist(pl.id, pl.name);
  }

  const groupedPlaylists = createMemo(() => {
    const all = user.state.userPlaylists || [];
    const ne = all.filter((p: any) => p.provider !== "qq");
    const qq = all.filter((p: any) => p.provider === "qq");
    const groups: { key: string; label: string; items: any[] }[] = [];
    if (ne.length) groups.push({ key: "netease", label: "网易云歌单", items: ne });
    if (qq.length) groups.push({ key: "qq", label: "QQ 音乐歌单", items: qq });
    return groups;
  });

  return (
    <div id="playlist-panel">
      <div class="queue-head">
        <div>
          <div class="fx-title">歌单 / 队列</div>
          <div class="fx-sub">QUEUE · 鼠标移开自动隐藏</div>
        </div>
        <div class="queue-head-act">
          <button
            id="playlist-pin-btn"
            classList={{ "fx-mini-btn": true, ghost: true, "playlist-pin-btn": true, active: settings.state.playlistPanelPinned }}
            onClick={() => settings.togglePlaylistPanelPinned()}
          >
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 4l6 6"/><path d="M5 15l4 4"/><path d="M14 4l-2 5-4 4-3 2 4 4 2-3 4-4 5-2z"/>
            </svg>
          </button>
          <button class="fx-mini-btn ghost" onClick={() => playback.shuffleQueue()}>随机</button>
        </div>
      </div>

      <div class="panel-tabs">
        <button classList={{ "panel-tab": true, active: tab() === "queue" }} onClick={() => setTab("queue")}>当前队列</button>
        <button classList={{ "panel-tab": true, active: tab() === "playlists" }} onClick={() => setTab("playlists")}>我的歌单</button>
        <button classList={{ "panel-tab": true, active: tab() === "podcasts" }} onClick={() => setTab("podcasts")}>我的播客</button>
      </div>

      <Show when={tab() === "queue"}>
        <div id="queue-pane">
          <div class="queue-toolbar">
            <div id="play-mode-chip" class="queue-chip">{playModeLabel()}</div>
            <div style={{ display: "flex", gap: "6px" }}>
              <button class="fx-mini-btn ghost" onClick={() => playback.cyclePlayMode()} style={{ height: "26px", padding: "0 10px", "font-size": "11px" }}>切换模式</button>
              <button class="fx-mini-btn ghost" onClick={() => { playback.clearQueue(); updateEmptyHomeVisibility(); }} style={{ height: "26px", padding: "0 10px", "font-size": "11px" }}>清空</button>
            </div>
          </div>
          <div id="queue-list" class="queue-list">
            <For each={playback.state.playQueue}>
              {(song, idx) => (
                <div
                  classList={{ "queue-item": true, now: idx() === playback.state.currentIdx }}
                  onClick={() => playSong(song, idx())}
                >
                  <img src={proxyImageUrl(song.cover)} alt="" loading="lazy" />
                  <div style={{ "flex": "1", "min-width": "0" }}>
                    <div class="qi-name">{song.name}</div>
                    <div class="qi-sub">{song.artist}</div>
                  </div>
                </div>
              )}
            </For>
          </div>
        </div>
      </Show>

      <Show when={tab() === "playlists"}>
        <div id="pl-pane">
          <div class="queue-toolbar">
            <div class="queue-chip">登录后显示网易云 / QQ 歌单</div>
          </div>
          <div id="pl-list" style={{ "margin-top": "6px" }}>
            <For each={groupedPlaylists()}>
              {(group) => (
                <>
                  <div class="pl-section-label">{group.label}</div>
                  <For each={group.items}>
                    {(pl) => (
                      <div class="pl-card" onClick={() => loadPlaylist(pl)}>
                        <img src={proxyImageUrl(pl.cover || "")} alt="" loading="lazy" />
                        <div style={{ "flex": "1", "min-width": "0" }}>
                          <div class="pl-name">
                            {pl.name}
                            <span class={`tag-source ${pl.provider === "qq" ? "qq" : "netease"}`} style={{ "margin-left": "6px", "vertical-align": "1px" }}>
                              {pl.provider === "qq" ? "QQ" : "NE"}
                            </span>
                          </div>
                          <div class="pl-sub">{pl.trackCount} 首</div>
                        </div>
                      </div>
                    )}
                  </For>
                </>
              )}
            </For>
          </div>
        </div>
      </Show>

      <Show when={tab() === "podcasts"}>
        <div id="podcast-pane">
          <div class="queue-toolbar">
            <div class="queue-chip">收藏 / 创建 / 喜欢</div>
          </div>
          <div id="podcast-list"></div>
        </div>
      </Show>
    </div>
  );
};

export default PlaylistPanel;
