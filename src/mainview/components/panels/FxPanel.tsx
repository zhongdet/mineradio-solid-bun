// @ts-nocheck
import { Component, For, Show, createSignal } from "solid-js";
import { useFx } from "../../stores/fxStore";
import { useSettings } from "../../stores/settingsStore";
import { useArchive } from "../../stores/archiveStore";

const PRESET_META = [
  { name: "emily专辑封面", desc: "封面粒子 · 快速入场", icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 14c3-2 5-2 8 0s5 2 8 0M3 10c3-2 5-2 8 0s5 2 8 0M3 18c3-2 5-2 8 0s5 2 8 0"/></svg>' },
  { name: "滚筒", desc: "隧道 · 沉浸感", icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/></svg>' },
  { name: "星球", desc: "星球 · 雕塑感", icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="7"/><path d="M5 12a7 7 0 0 0 14 0"/></svg>' },
  { name: "虚空", desc: "无粒子 · 自定义背景", icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="7"/><path d="M8.8 8.8l6.4 6.4"/></svg>' },
  { name: "唱片", desc: "唱片 · 圆形封面", icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.4"/><path d="M16.5 5.2c2.1.9 3.4 2.4 4 4.5"/><path d="M18.8 3.2l1.5 4.8"/></svg>' },
  { name: "星河", desc: "壁纸粒子 · 音乐律动", icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 15c2.2-4.4 4.4-4.4 6.6 0s4.4 4.4 6.6 0S20.6 10.6 23 15"/><path d="M3 9c2.2 2.2 4.4 2.2 6.6 0s4.4-2.2 6.6 0S20.6 11.2 23 9"/><circle cx="12" cy="12" r="1.7" fill="currentColor"/></svg>' },
  { name: "安魂", desc: "骷髅·YUI7W", icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M10 3.2h4v6.2h4.2v3.8H14v7.6h-4v-7.6H5.8V9.4H10z"/></svg>' },
];
const PRESET_ORDER = [0, 6, 5, 4, 2, 1, 3];

const TOGGLES = [
  { key: "floatLayer", label: "浮空粒子层" },
  { key: "cinema", label: "电影镜头" },
  { key: "lyricGlow", label: "歌词溢光" },
  { key: "lyricGlowBeat", label: "鼓点溢光" },
  { key: "lyricGlowParticles", label: "歌词光粒" },
  { key: "lyricCameraLock", label: "歌词镜头绑定" },
  { key: "bloom", label: "粒子溢光" },
  { key: "edge", label: "轮廓高亮" },
  { key: "particleLyrics", label: "歌词粒子" },
  { key: "backCover", label: "背景封面" },
  { key: "desktopLyrics", label: "桌面歌词" },
  { key: "desktopLyricsClickThrough", label: "桌面歌词锁定" },
  { key: "desktopLyricsCinema", label: "桌面歌词电影震动" },
  { key: "desktopLyricsHighlight", label: "桌面歌词高亮跟随" },
];

const SHELF_MODES = [
  { value: "side", label: "侧面" },
  { value: "stage", label: "舞台" },
  { value: "off", label: "关闭" },
];
const SHELF_CAMERA = [
  { value: "static", label: "静态" },
  { value: "follow", label: "跟随" },
  { value: "auto", label: "自动" },
];
const SHELF_PRESENCE = [
  { value: "always", label: "始终" },
  { value: "hover", label: "悬浮" },
  { value: "off", label: "关闭" },
];
const QUALITY_MODES = [
  { value: "eco", label: "低" },
  { value: "balanced", label: "中" },
  { value: "high", label: "高" },
  { value: "ultra", label: "超高" },
];
const DESKTOP_FPS = [24, 30, 60, 120, 0];

const LYRIC_FONTS = [
  { key: "hei", label: "黑体" },
  { key: "song", label: "宋体" },
  { key: "kai", label: "楷体" },
  { key: "yuan", label: "圆体" },
  { key: "mono", label: "等宽" },
];

const Slider: Component<{ label: string; value: number; min: number; max: number; step: number; onInput: (v: number) => void; format?: (v: number) => string; devLocked?: boolean }> = (props) => {
  const display = () => props.format ? props.format(props.value) : props.value.toFixed(2);
  return (
    <div classList={{ "fx-slider": true, "dev-locked": props.devLocked }}>
      <label>{props.label}</label>
      <input type="range" min={props.min} max={props.max} step={props.step} value={props.value}
        disabled={props.devLocked}
        onInput={(e) => props.onInput(parseFloat(e.currentTarget.value))} />
      <output>{display()}</output>
    </div>
  );
};

const SegPicker: Component<{ value: string; options: { value: string; label: string }[]; onChange: (v: string) => void }> = (props) => (
  <div class="fx-seg">
    <For each={props.options}>
      {(opt) => (
        <button classList={{ active: props.value === opt.value }} onClick={() => props.onChange(opt.value)}>
          {opt.label}
        </button>
      )}
    </For>
  </div>
);

const FxPanel: Component = () => {
  const fx = useFx();
  const settings = useSettings();
  const archive = useArchive();
  const [lyricFold, setLyricFold] = createSignal(false);
  const [overlayFold, setOverlayFold] = createSignal(false);
  const [stageFold, setStageFold] = createSignal(false);
  const [advancedOpen, setAdvancedOpen] = createSignal(false);
  const [editingIdx, setEditingIdx] = createSignal(-1);

  const handleFileImport = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const text = await file.text();
      archive.importJson(text);
    };
    input.click();
  };

  const toggleFx = (key: string) => {
    fx.set(key as any, !fx.state[key]);
  };

  return (
    <>
      <button
        id="fx-fab"
        classList={{ "fx-fab-auto-hide": settings.state.fxFabAutoHide, "fx-fab-peek": false }}
        title="视觉控制台"
        onClick={() => fx.set("preset", fx.state.preset)}
      >
        <svg width="21" height="21" fill="none" stroke="currentColor" stroke-width="1.9" viewBox="0 0 24 24">
          <path d="M4 7h8"/><path d="M16 7h4"/><circle cx="14" cy="7" r="2"/><path d="M4 17h4"/><path d="M12 17h8"/><circle cx="10" cy="17" r="2"/>
        </svg>
      </button>
      <button
        id="fx-fab-hide-btn"
        type="button"
        classList={{ on: settings.state.fxFabAutoHide }}
        onClick={() => settings.toggleFxFabAutoHide()}
      >
        {settings.state.fxFabAutoHide ? "›" : "‹"}
      </button>

      <div id="fx-panel" classList={{ show: fx.state.presetTransition.active }}>
        <div class="fx-head">
          <div class="fx-head-main">
            <div class="fx-title">视觉控制台</div>
            <div class="fx-sub">MINERADIO VISUALS · 鼠标移开自动隐藏</div>
          </div>
          <div class="fx-head-actions">
            <button class="fx-mini-btn" onClick={() => fx.reset()}>恢复默认</button>
          </div>
        </div>

        {/* Preset Grid */}
        <div class="fx-section-label">视觉预设</div>
        <div class="preset-grid" id="preset-grid">
          <For each={PRESET_ORDER}>
            {(i) => {
              const p = PRESET_META[i];
              return (
                <div
                  classList={{ "preset-card": true, active: fx.state.preset === i }}
                  data-preset={i}
                  onClick={() => fx.setPreset(i)}
                >
                  <div class="pc-icon" innerHTML={p.icon} />
                  <div class="pc-name">{p.name}</div>
                  <div class="pc-desc">{p.desc}</div>
                </div>
              );
            }}
          </For>
        </div>

        {/* User Archives */}
        <div class="fx-section-label">用户存档</div>
        <div class="user-archive-grid">
          <div class="user-archive-toolbar">
            <div class="user-archive-note">保存当前视觉方案，支持导出/导入 JSON 文件</div>
            <div class="user-archive-tools">
              <button class="fx-mini-btn" onClick={() => archive.addBlank()}>+ 新建</button>
              <button class="fx-mini-btn" onClick={handleFileImport}>导入</button>
            </div>
          </div>
          <For each={archive.state.slots}>
            {(slot, i) => (
              <div classList={{ "user-archive-slot": true, "has-save": !!slot.snapshot }}>
                <Show
                  when={editingIdx() === i()}
                  fallback={
                    <div class="user-archive-name" onDblClick={() => setEditingIdx(i())}>
                      {slot.name}
                    </div>
                  }
                >
                  <input
                    class="user-archive-input"
                    type="text"
                    value={slot.name}
                    onBlur={(e) => {
                      archive.rename(i(), e.currentTarget.value || slot.name);
                      setEditingIdx(-1);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        archive.rename(i(), e.currentTarget.value || slot.name);
                        setEditingIdx(-1);
                      }
                    }}
                    autoFocus
                  />
                </Show>
                <div class="user-archive-meta">
                  {slot.savedAt ? new Date(slot.savedAt).toLocaleString() : "空白"}
                </div>
                <div class="user-archive-actions">
                  <button disabled={!slot.snapshot} onClick={() => archive.load(i(), fx)}>
                    应用
                  </button>
                  <button onClick={() => archive.save(i(), fx.state)}>
                    {slot.snapshot ? "覆盖" : "保存"}
                  </button>
                  <button disabled={!slot.snapshot} onClick={() => archive.exportJson(i())}>
                    导出
                  </button>
                  <button onClick={() => archive.remove(i())}>
                    删除
                  </button>
                </div>
              </div>
            )}
          </For>
          <div classList={{ "user-archive-slot": true, "is-new": true }}
            onClick={() => archive.addBlank()}>
            <strong>+ 新建存档</strong>
            <span>空白存档槽</span>
          </div>
        </div>

        {/* Custom Colors */}
        <div class="fx-section-label">自定义颜色</div>
        <div class="lyric-color-row visual-tint-row">
          <input class="lyric-color-picker" type="color" value={fx.state.visualTintColor}
            onInput={(e) => { fx.set("visualTintMode", "custom"); fx.set("visualTintColor", e.currentTarget.value); }} />
          <div class="fx-color-row-label">
            视觉主色
            <small>{fx.state.visualTintMode === "auto" ? "封面取色" : fx.state.visualTintColor}</small>
          </div>
          <button class="fx-mini-btn" onClick={() => { fx.set("visualTintMode", "auto"); }}>封面</button>
          <button class="fx-mini-btn" onClick={() => { fx.set("visualTintMode", "auto"); fx.set("visualTintColor", "#9db8cf"); }}>默认</button>
        </div>
        <div class="lyric-color-row">
          <input class="lyric-color-picker" type="color" value={fx.state.uiAccentColor}
            onInput={(e) => fx.set("uiAccentColor", e.currentTarget.value)} />
          <div class="fx-color-row-label">UI强调色</div>
          <button class="fx-mini-btn" onClick={() => fx.set("uiAccentColor", "#ffffff")}>默认</button>
        </div>
        <div class="lyric-color-row">
          <input class="lyric-color-picker" type="color" value={fx.state.homeAccentColor}
            onInput={(e) => fx.set("homeAccentColor", e.currentTarget.value)} />
          <div class="fx-color-row-label">首页强调</div>
          <button class="fx-mini-btn" onClick={() => fx.set("homeAccentColor", "#ffffff")}>默认</button>
        </div>
        <div class="lyric-color-row">
          <input class="lyric-color-picker" type="color" value={fx.state.homeIconColor}
            onInput={(e) => fx.set("homeIconColor", e.currentTarget.value)} />
          <div class="fx-color-row-label">首页图标</div>
          <button class="fx-mini-btn" onClick={() => fx.set("homeIconColor", "#ffffff")}>默认</button>
        </div>
        <div class="lyric-color-row">
          <input class="lyric-color-picker" type="color" value={fx.state.visualIconColor}
            onInput={(e) => fx.set("visualIconColor", e.currentTarget.value)} />
          <div class="fx-color-row-label">视觉图标</div>
          <button class="fx-mini-btn" onClick={() => fx.set("visualIconColor", "#ffffff")}>默认</button>
        </div>
        <div class="lyric-color-row">
          <input class="lyric-color-picker" type="color" value={fx.state.backgroundColor}
            onInput={(e) => { fx.set("backgroundColorMode", "custom"); fx.set("backgroundColorCustom", true); fx.set("backgroundColor", e.currentTarget.value); }} />
          <div class="fx-color-row-label">背景色</div>
          <button class="fx-mini-btn" onClick={() => { fx.set("backgroundColorMode", "cover"); fx.set("backgroundColorCustom", false); }}>封面</button>
        </div>
        <Slider label="背景透明度" value={fx.state.backgroundOpacity} min={0} max={1} step={0.01}
          onInput={(v) => fx.set("backgroundOpacity", v)} />
        <Slider label="控制台玻璃色差" value={fx.state.controlGlassChromaticOffset} min={0} max={140} step={1}
          onInput={(v) => fx.set("controlGlassChromaticOffset", v)} />

        {/* Master Controls */}
        <div class="fx-section-label">主控</div>
        <Slider label="律动强度" value={fx.state.intensity} min={0.2} max={1.6} step={0.01}
          onInput={(v) => fx.set("intensity", v)} />
        <Slider label="立体感" value={fx.state.depth} min={0.2} max={1.8} step={0.01}
          onInput={(v) => fx.set("depth", v)} />
        <Slider label="封面清晰度" value={fx.state.coverResolution} min={0.75} max={1.55} step={0.01}
          onInput={(v) => fx.set("coverResolution", v)} />
        <Slider label="镜头晃动" value={fx.state.cinemaShake} min={0} max={1.8} step={0.01}
          onInput={(v) => fx.set("cinemaShake", v)} />
        <Slider label="歌词溢光" value={fx.state.lyricGlowStrength} min={0} max={0.85} step={0.01}
          onInput={(v) => fx.set("lyricGlowStrength", v)} />

        {/* Lyric Appearance Fold */}
        <div classList={{ "fx-fold": true, open: lyricFold() }}>
          <div class="fx-fold-head" onClick={() => setLyricFold(!lyricFold())}>
            <div class="fx-fold-title">
              <strong>歌词外观</strong>
              <small>颜色 · 字体 · 布局</small>
            </div>
            <span class="arrow">▸</span>
          </div>
          <div class="fx-fold-body">
            <div class="fx-section-label">歌词颜色</div>
            <div class="lyric-color-row">
              <input class="lyric-color-picker" type="color" value={fx.state.lyricColor}
                onInput={(e) => { fx.set("lyricColorMode", "custom"); fx.set("lyricColor", e.currentTarget.value); }} />
              <div class="lyric-color-value">{fx.state.lyricColorMode === "auto" ? "封面取色" : fx.state.lyricColor}</div>
              <button class="fx-mini-btn" onClick={() => fx.set("lyricColorMode", "auto")}>封面</button>
            </div>
            <div class="lyric-color-row">
              <input class="lyric-color-picker" type="color" value={fx.state.lyricHighlightColor}
                onInput={(e) => { fx.set("lyricHighlightMode", "custom"); fx.set("lyricHighlightColor", e.currentTarget.value); }} />
              <div class="lyric-color-value">{fx.state.lyricHighlightMode === "auto" ? "跟随歌词" : fx.state.lyricHighlightColor}</div>
              <button class="fx-mini-btn" onClick={() => fx.set("lyricHighlightMode", "auto")}>跟随</button>
            </div>
            <div classList={{ "lyric-color-row": true, linked: fx.state.lyricGlowLinked }}
              onClick={() => fx.set("lyricGlowLinked", !fx.state.lyricGlowLinked)}>
              <input class="lyric-color-picker" type="color" value={fx.state.lyricGlowColor}
                onInput={(e) => { fx.set("lyricGlowLinked", false); fx.set("lyricGlowColor", e.currentTarget.value); }} />
              <div class="lyric-color-value">{fx.state.lyricGlowLinked ? "跟随高亮" : fx.state.lyricGlowColor}</div>
              <button class="fx-mini-btn" onClick={(e) => { e.stopPropagation(); fx.set("lyricGlowLinked", !fx.state.lyricGlowLinked); }}>
                {fx.state.lyricGlowLinked ? "链接" : "解锁"}
              </button>
            </div>

            <div class="fx-section-label">字体</div>
            <div class="fx-seg">
              <For each={LYRIC_FONTS}>
                {(f) => (
                  <button classList={{ active: fx.state.lyricFont === f.key }}
                    onClick={() => fx.set("lyricFont", f.key)}>
                    {f.label}
                  </button>
                )}
              </For>
            </div>

            <Slider label="字间距" value={fx.state.lyricLetterSpacing} min={-0.04} max={0.18} step={0.005}
              onInput={(v) => fx.set("lyricLetterSpacing", v)} />
            <Slider label="行距" value={fx.state.lyricLineHeight} min={0.86} max={1.35} step={0.01}
              onInput={(v) => fx.set("lyricLineHeight", v)} />
            <Slider label="字重" value={fx.state.lyricWeight} min={500} max={900} step={50}
              onInput={(v) => fx.set("lyricWeight", v)} format={(v) => String(v)} />
            <Slider label="歌词大小" value={fx.state.lyricScale} min={0.35} max={1.65} step={0.01}
              onInput={(v) => fx.set("lyricScale", v)} />
            <Slider label="水平位置" value={fx.state.lyricOffsetX} min={-2.0} max={2.0} step={0.01}
              onInput={(v) => fx.set("lyricOffsetX", v)} />
            <Slider label="垂直位置" value={fx.state.lyricOffsetY} min={-1.2} max={1.35} step={0.01}
              onInput={(v) => fx.set("lyricOffsetY", v)} />
            <Slider label="景深位置" value={fx.state.lyricOffsetZ} min={-1.6} max={1.6} step={0.01}
              onInput={(v) => fx.set("lyricOffsetZ", v)} />
            <Slider label="上下角度" value={fx.state.lyricTiltX} min={-42} max={42} step={1}
              onInput={(v) => fx.set("lyricTiltX", v)} format={(v) => String(v)} />
            <Slider label="左右角度" value={fx.state.lyricTiltY} min={-42} max={42} step={1}
              onInput={(v) => fx.set("lyricTiltY", v)} format={(v) => String(v)} />
          </div>
        </div>

        {/* Overlay Effects Fold */}
        <div classList={{ "fx-fold": true, open: overlayFold() }}>
          <div class="fx-fold-head" onClick={() => setOverlayFold(!overlayFold())}>
            <div class="fx-fold-title">
              <strong>叠加效果</strong>
              <small>开关 · 桌面歌词 · 壁纸</small>
            </div>
            <span class="arrow">▸</span>
          </div>
          <div class="fx-fold-body">
            <div class="fx-toggle-grid">
              <For each={TOGGLES}>
                {(t) => (
                  <div classList={{ "fx-toggle": true, on: !!fx.state[t.key] }}
                    onClick={() => toggleFx(t.key)}>
                    <span>{t.label}</span>
                    <span class="dot" />
                  </div>
                )}
              </For>
              <div classList={{ "fx-toggle": true, "dev-locked": true, on: !!fx.state.wallpaperMode }}
                title="开发中，暂不可用">
                <span>壁纸模式<em class="fx-dev-badge">开发中</em></span>
                <span class="dot" />
              </div>
            </div>

            <div class="fx-section-label">桌面歌词参数</div>
            <Slider label="桌面歌词大小" value={fx.state.desktopLyricsSize} min={0.72} max={1.55} step={0.01}
              onInput={(v) => fx.set("desktopLyricsSize", v)} />
            <Slider label="桌面歌词透明" value={fx.state.desktopLyricsOpacity} min={0.28} max={1} step={0.01}
              onInput={(v) => fx.set("desktopLyricsOpacity", v)} />
            <Slider label="桌面歌词高度" value={fx.state.desktopLyricsY} min={0.08} max={0.92} step={0.01}
              onInput={(v) => fx.set("desktopLyricsY", v)} />

            <div class="fx-section-label">桌面歌词帧率</div>
            <div class="fx-seg">
              <For each={DESKTOP_FPS}>
                {(fps) => (
                  <button classList={{ active: fx.state.desktopLyricsFps === fps }}
                    onClick={() => fx.set("desktopLyricsFps", fps)}>
                    {fps === 0 ? "无上限" : fps}
                  </button>
                )}
              </For>
            </div>

            <div class="fx-section-label">壁纸透明度</div>
            <Slider label="壁纸透明度" value={fx.state.wallpaperOpacity} min={0.35} max={1} step={0.01}
              onInput={(v) => fx.set("wallpaperOpacity", v)} devLocked={true} />
          </div>
        </div>

        {/* 3D / Stage Fold */}
        <div classList={{ "fx-fold": true, open: stageFold() }}>
          <div class="fx-fold-head" onClick={() => setStageFold(!stageFold())}>
            <div class="fx-fold-title">
              <strong>3D / 歌单架</strong>
              <small>模式 · 镜头 · 透明度</small>
            </div>
            <span class="arrow">▸</span>
          </div>
          <div class="fx-fold-body">
            <div class="fx-section-label">歌单架模式</div>
            <SegPicker value={fx.state.shelf} options={SHELF_MODES} onChange={(v) => fx.set("shelf", v)} />

            <div class="fx-section-label">镜头模式</div>
            <SegPicker value={fx.state.shelfCameraMode} options={SHELF_CAMERA} onChange={(v) => fx.set("shelfCameraMode", v)} />

            <div class="fx-section-label">显示模式</div>
            <SegPicker value={fx.state.shelfPresence} options={SHELF_PRESENCE} onChange={(v) => fx.set("shelfPresence", v)} />

            <div class="fx-toggle-grid" style={{ "margin-top": "8px" }}>
              <div classList={{ "fx-toggle": true, on: fx.state.shelfShowPodcasts }}
                onClick={() => fx.set("shelfShowPodcasts", !fx.state.shelfShowPodcasts)}>
                <span>显示播客歌单</span><span class="dot" />
              </div>
              <div classList={{ "fx-toggle": true, on: fx.state.shelfMergeCollections }}
                onClick={() => fx.set("shelfMergeCollections", !fx.state.shelfMergeCollections)}>
                <span>合并收藏歌单</span><span class="dot" />
              </div>
            </div>

            <Slider label="歌单架大小" value={fx.state.shelfSize} min={0.65} max={1.45} step={0.01}
              onInput={(v) => fx.set("shelfSize", v)} />
            <Slider label="左右位置" value={fx.state.shelfOffsetX} min={-1.2} max={1.2} step={0.01}
              onInput={(v) => fx.set("shelfOffsetX", v)} />
            <Slider label="上下位置" value={fx.state.shelfOffsetY} min={-0.9} max={0.9} step={0.01}
              onInput={(v) => fx.set("shelfOffsetY", v)} />
            <Slider label="前后景深" value={fx.state.shelfOffsetZ} min={-0.9} max={0.9} step={0.01}
              onInput={(v) => fx.set("shelfOffsetZ", v)} />
            <Slider label="侧向角度" value={fx.state.shelfAngleY} min={-30} max={30} step={1}
              onInput={(v) => fx.set("shelfAngleY", v)} format={(v) => String(v)} />
            <Slider label="整体透明度" value={fx.state.shelfOpacity} min={0.25} max={1} step={0.01}
              onInput={(v) => fx.set("shelfOpacity", v)} />
            <Slider label="背景透明度" value={fx.state.shelfBgOpacity} min={0.25} max={0.98} step={0.01}
              onInput={(v) => fx.set("shelfBgOpacity", v)} />

            <div class="lyric-color-row">
              <input class="lyric-color-picker" type="color" value={fx.state.shelfAccentColor}
                onInput={(e) => fx.set("shelfAccentColor", e.currentTarget.value)} />
              <div class="fx-color-row-label">歌单架强调色</div>
              <button class="fx-mini-btn" onClick={() => fx.set("shelfAccentColor", "#ffffff")}>默认</button>
            </div>
          </div>
        </div>

        {/* Advanced */}
        <div classList={{ "fx-advanced": true, open: advancedOpen() }}>
          <div class="fx-advanced-head" onClick={() => setAdvancedOpen(!advancedOpen())}>
            <span>高级参数</span>
            <span class="arrow">▸</span>
          </div>
          <div class="fx-advanced-body">
            <div class="fx-section-label">画质档位</div>
            <SegPicker value={fx.state.performanceQuality} options={QUALITY_MODES}
              onChange={(v) => fx.set("performanceQuality", v)} />

            <div class="fx-section-label">粒子参数</div>
            <Slider label="粒子尺寸" value={fx.state.point} min={0.5} max={2.2} step={0.01}
              onInput={(v) => fx.set("point", v)} />
            <Slider label="流速" value={fx.state.speed} min={0.2} max={2.5} step={0.01}
              onInput={(v) => fx.set("speed", v)} />
            <Slider label="扭曲" value={fx.state.twist} min={0} max={0.6} step={0.01}
              onInput={(v) => fx.set("twist", v)} />
            <Slider label="色彩张力" value={fx.state.color} min={0.5} max={2.0} step={0.01}
              onInput={(v) => fx.set("color", v)} />
            <Slider label="溢光强度" value={fx.state.bloomStrength} min={0} max={1.6} step={0.01}
              onInput={(v) => fx.set("bloomStrength", v)} />
            <Slider label="离散感" value={fx.state.scatter} min={0} max={0.5} step={0.01}
              onInput={(v) => fx.set("scatter", v)} />
            <Slider label="背景压缩" value={fx.state.bgFade} min={0} max={1.2} step={0.01}
              onInput={(v) => fx.set("bgFade", v)} />
          </div>
        </div>

        <div class="fx-actions">
          <button class="fx-mini-btn" onClick={() => fx.reset()}>恢复默认</button>
        </div>
      </div>
    </>
  );
};

export default FxPanel;
