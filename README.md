# Mineradio (SolidJS · Bun · Electrobun)

> **Migrated from**: [XxHuberrr/Mineradio](https://github.com/XxHuberrr/Mineradio) — original Electron + vanilla JS codebase
> **Current state**: Functional desktop app (mid-migration, actively developed)

[English](#english) · [简体中文](#%E7%AE%80%E4%BD%93%E4%B8%AD%E6%96%87)

---

## English

An immersive, audio-reactive desktop music player. Weather radio, 3D particle visuals, stage lyrics, a 3D playlist shelf, and dual provider support (Netease Cloud Music + QQ Music) — all wrapped in a fine-grained SolidJS frontend running on Bun via Electrobun.

---

## What It Is

Mineradio is a Windows desktop application that turns music playback into a spatial, visual experience. When you play a track, a Three.js scene reacts to the beat: particles pulse, the camera breathes with the bass, and lyrics float in 3D space. Right-clicking opens a 3D shelf of your playlists. A desktop overlay shows synced lyrics, and a separate wallpaper window projects the album art and colors onto your desktop.

This repo is a **from-scratch reimplementation** of the original [Mineradio](https://github.com/XxHuberrr/Mineradio) (Electron + a single 23k-line `app.js`). The logic, visual engine, UI, and backend are being extracted into a SolidJS + Bun architecture with typed stores, framework-agnostic hooks, and a Bun-native HTTP backend.

The new frontend is self-contained and functional; the legacy file is still in the repo for reference but is **not executed** by the current build.

---

## Tech Stack

| Layer         | Stack                                                                 |
| ------------- | --------------------------------------------------------------------- |
| UI framework  | **SolidJS 1.9** — fine-grained signals, no virtual DOM                |
| Runtime       | **Bun 1.1** — TypeScript-native, built-in HTTP/WebSocket/SQLite       |
| Desktop shell | **Electrobun 1.18** — WebView backed by Bun (no Electron, no Node.js) |
| Build         | **Vite 6** + `vite-plugin-solid` (HMR in dev)                         |
| State         | **SolidJS `createStore`** (15 domain stores) + custom hooks           |
| 3D / visuals  | **Three.js r128** + inline GLSL shaders, Web Audio API                |
| Backend       | **Bun HTTP** server + JSON-RPC over WebSocket                         |
| Music APIs    | NeteaseCloudMusicApi (REST) · QQ Music (scraped + RPC)                |
| Tests         | Playwright                                                            |

---

## Directory Layout

```
src/
├── mainview/                        # SolidJS frontend
│   ├── components/
│   │   ├── panels/                  # Splash · SearchArea · PlaylistPanel · BottomBar
│   │   │                           # · FxPanel · StageLyrics · EmptyHome · Modals
│   │   └── ui/                      # TopRight · StatusChips · Background · GestureHud
│   │                               # · ThumbWrap · VisualGuide · TrialBanner · Overlays
│   │                               # · HiddenInputs
│   ├── stores/                      # 15 typed SolidJS stores (single source of truth)
│   │   ├── audioStore.ts            # AudioElement, AudioContext, analyser, volume, FFT
│   │   ├── playbackStore.ts         # playQueue, currentIdx, playMode, playlist
│   │   ├── visualStore.ts           # bass/mid/treble, beatPulse, beatCam, cinemaDynamics
│   │   ├── lyricsStore.ts           # lyricsLines, customLyricMap, karaoke state
│   │   ├── searchStore.ts           # mode, results, history, podcasts
│   │   ├── authStore.ts             # Netease + QQ loginStatus, QR flow, dual-account
│   │   ├── userStore.ts             # userPlaylists, likedSongMap, collectBusy
│   │   ├── fxStore.ts               # 100+ visual FX params, presets, transitions
│   │   ├── shelfStore.ts            # shelf mode, pinned, hoverCue, cards
│   │   ├── settingsStore.ts         # diyMode, hotkeys, auto-hide, quality
│   │   ├── homeStore.ts             # discover feed, weather radio, listen stats
│   │   ├── uiStore.ts               # auto-hide timers, immersive mode, modals, ripples
│   │   ├── performanceStore.ts      # adaptive FPS, cover depth cache, power mode
│   │   ├── actionStore.ts           # Zustand callback registry (decouples components)
│   │   └── archiveStore.ts          # preset archive management
│   ├── hooks/                       # ~14 business-logic hooks (operate on stores only)
│   │   ├── useVisualEngine.ts       # Three.js init, render loop, particles, bloom, shelf 3D
│   │   ├── useAudioPlayback.ts      # playQueueAt, togglePlay, next/prev, fade, volume
│   │   ├── useBeatDetection.ts      # FFT band-splitting, onset detection, beatCam
│   │   ├── useSearch.ts             # Netease + QQ search, dedup, podcast, history
│   │   ├── useAuth.ts               # QR poll, web login, cookie import, logout
│   │   ├── usePlaylists.ts          # load, like, collect, create playlist
│   │   ├── useLyrics.ts             # fetch/parse LRC/KRC, custom lyric CRUD, 3D tick
│   │   ├── useHomeDiscover.ts       # personalized feed, weather radio, listen stats
│   │   ├── useHotkeys.ts            # keyboard dispatch, custom hotkey capture
│   │   ├── usePerformance.ts        # adaptive FPS, cache trim, perf marks
│   │   ├── useDesktopLyrics.ts      # overlay window RPC sync
│   │   ├── useDesktopWallpaper.ts   # wallpaper window RPC sync
│   │   ├── useIdleGuide.ts          # idle animation intro sequence
│   │   ├── useControlGlass.ts       # frosted-glass shader uniforms
│   │   ├── useThemeColors.ts        # palette extraction from cover art
│   │   ├── useCoverCrop.ts          # cover crop UI state
│   │   ├── useSplashAnimation.ts    # splash entrance/exit
│   │   └── useGesture.ts            # mouse drag orbit, inertia, head-parallax
│   ├── legacy/visuals/              # (reserved — engine lives in useVisualEngine hook)
│   ├── lib/
│   │   ├── api.ts                   # JSON-RPC client + legacy REST compat
│   │   ├── uiControls.ts            # bottom-bar auto-hide, chrome state
│   │   ├── homeDiscover.ts          # home tile click handlers
│   │   ├── homeActions.ts · homeVisibility.ts · playbackBridge.ts
│   │   └── constants.ts             # store keys, visual preset schema, API routes
│   ├── App.tsx                      # Root — mounts 14 hooks, global DOM bridges
│   └── main.tsx                     # Entry — render(<App />, #app)
│
└── bun/                             # Bun backend
    ├── server.ts                    # Combined HTTP + WebSocket server
    ├── routes/
    │   ├── legacy.ts                # REST compat endpoints
    │   └── rpc.ts                   # JSON-RPC 2.0 handler
    ├── providers/
    │   ├── netease.ts               # NeteaseCloudMusicApi wrapper
    │   └── qq.ts                    # QQ Music search · login · stream URLs
    └── index.ts                     # Exports
```

---

## Running It

### Prerequisites

| Requirement | Version | Install                                     |
| ----------- | ------- | ------------------------------------------- |
| **Bun**     | ≥ 1.1   | `curl -fsSL https://bun.sh/install \| bash` |
| **Git**     | any     | system package manager                      |

### Dev

```bash
# install
bun install

# single command — Vite HMR + Electrobun WebView + Bun backend
bun run dev

# separate terminal — backend only (port printed on startup)
bun run dev:server
```

`bun run dev`: Vite builds the frontend into `dist/`, Electrobun bundles the Bun backend into `main.js`, then launches a WebView pointing at the dev server (HMR hot-reloads). The backend port is injected via `?apiPort=<port>` query string.

### Production

```bash
bun run build          # vite build → dist/
bun run build:win      # Windows NSIS installer
bun run start          # build then launch
```

---

## Core Concepts

### Stores = Single Source of Truth

All app state lives in SolidJS `createStore` calls. There are no globals (other than DOM refs managed in effects). Every piece of UI data — play queue, volume, FFT bands, login status, search history, FX params — has exactly one owner.

Stores expose a `useXxx()` hook returning `{ state, ...methods }`. Components read via `state.field()` (fine-grained signal) and write via the returned methods.

### Hooks = Framework-Agnostic Business Logic

Hooks are plain functions that accept store references and return command APIs. They contain no JSX, no SolidJS template code, and no DOM queries — only SolidJS reactivity primitives (`createEffect`, `onCleanup`, `createSignal`) and store mutations. This makes the business logic testable and portable.

The largest hook, `useVisualEngine` (~2 000 lines), owns the Three.js lifecycle. It creates the scene, sets up particle geometry, runs the `requestAnimationFrame` render loop, reads `visualStore` each frame to update shader uniforms, and manages adaptive-FPS scheduling. Components like `Background` just provide a `<canvas>` container — the hook appends the Three.js renderer into it.

### Backend = Bun HTTP + JSON-RPC

The Bun server in `src/bun/server.ts` runs two layers:

1. **HTTP REST** under `/api/*` — image proxying, desktop-lyrics state endpoint, wallpaper state endpoint, legacy compat.
2. **JSON-RPC 2.0** over WebSocket at `/rpc` — low-latency method dispatch to `providers/netease.ts` and `providers/qq.ts`.

Frontend calls the backend through `src/mainview/lib/api.ts`, a small typed RPC client that serializes method names + arguments and returns typed results.

### Legacy File

`public/legacy/app.js` (23 624 lines) is **not executed** by the current `App.tsx` entrypoint. It is still listed in `electrobun.config.ts` under `copy` and therefore ships in packaged builds, but it is inert. It is kept in the repo as a reference implementation during migration; it can be deleted once all components are fully reactive and no legacy path remains.

---

## Key Features

| Feature                                 | Where                                                                                 |
| --------------------------------------- | ------------------------------------------------------------------------------------- |
| Web Audio · FFT · beat detection        | `stores/audioStore.ts` + `hooks/useAudioAnalysis.ts` + `hooks/useBeatDetection.ts`    |
| Three.js visual engine (6 presets)      | `hooks/useVisualEngine.ts` — Silk, Tunnel, Orbit, Void, Vinyl, Wallpaper Pulse, Skull |
| Reactive lyrics (LRC / KRC / custom)    | `stores/lyricsStore.ts` + `hooks/useLyrics.ts`                                        |
| 3D playlist shelf (side / stage)        | `hooks/useShelf3D.ts` + `hooks/useShelf.ts`                                           |
| Desktop lyrics overlay                  | `hooks/useDesktopLyrics.ts` · `src/bun/index.ts` BrowserWindow                        |
| Desktop wallpaper overlay               | `hooks/useDesktopWallpaper.ts` · `src/bun/index.ts` BrowserWindow                     |
| Netease login (QR / web / cookie)       | `hooks/useAuth.ts` + `providers/netease.ts`                                           |
| QQ search + login                       | `hooks/useAuth.ts` + `providers/qq.ts`                                                |
| Search dedup (Levenshtein) + podcast    | `hooks/useSearch.ts`                                                                  |
| Weather radio (Open-Meteo)              | `hooks/useHomeDiscover.ts` + `homeDiscover.ts`                                        |
| DIY free-camera mode · gesture rotation | `hooks/useGesture.ts` · `settingsStore.ts`                                            |
| Adaptive FPS · perf monitoring          | `hooks/usePerformance.ts` · `stores/performanceStore.ts`                              |

---

## Scripts Reference

| Command                | What it does                                   |
| ---------------------- | ---------------------------------------------- |
| `bun run dev`          | Vite build → Electrobun dev with HMR           |
| `bun run dev:hmr`      | Vite on :5173 + Electrobun concurrently        |
| `bun run dev:server`   | Backend only (REST + RPC + overlay windows)    |
| `bun run build`        | Production frontend build                      |
| `bun run build:canary` | Build with `canary` env flag                   |
| `bun run start`        | Build then launch production                   |
| `bun run hidden`       | Build then launch hidden (headless background) |
| `bun run test`         | Playwright E2E suite                           |

---

## State at a Glance

```
Store            Lines of state    Key signal consumers
-----------      --------------    --------------------
audioStore       ~40               volume, playing, FFT buffers
playbackStore    ~20               BottomBar, PlaylistPanel, ThumbWrap
visualStore      ~80               useVisualEngine render loop, beatCam uniforms
lyricsStore      ~30               StageLyrics, karaoke highlight, desktop overlay
searchStore      ~25               SearchArea, history chips, result list
authStore        ~50               TopRight, Splash, login modal
userStore        ~25               playlist LIKE state, cover cache
fxStore          ~100              every frame (preset uniforms, transitions)
shelfStore       ~15               shelf3D raycasting, hoverCue
settingsStore    ~35               hotkeys, auto-hide, quality, diyMode
homeStore        ~25               EmptyHome, weather display, stats
uiStore          ~30               auto-hide timers, modals, ripples, guide
performanceStore ~20               adaptive FPS, cache trim
actionStore      ~10               playback bridge, home tile actions
archiveStore     ~15               preset archive CRUD
```

---

## Contributing

```bash
# see what's uncommitted
git status

# run type-check before pushing
bun run lint          # (tsc --noEmit)

# manual QA
bun run dev
```

This repo is actively refactored. Core SolidJS conventions the codebase follows:

- **Signals for derived/or UI state** — `createSignal` for local component state
- **`createStore` for app state** — all cross-component mutable state
- **`createSelector` or `createMemo` for derived calculations** — avoid unnecessary recompute
- **`createEffect` for side effects** — `onCleanup` always paired
- **No `document.getElementById` in new components** — SolidJS refs only; the few remaining DOM queries are legacy bridges being removed incrementally
- **TypeScript strict** — no `any` without explicit justification comment

---

## Acknowledgements

- Original [Mineradio](https://github.com/XxHuberrr/Mineradio) — concept, visual design, and the original Electron implementation by [XxHuberrr](https://github.com/XxHuberrr)

---

# Mineradio (SolidJS · Bun · Electrobun) — 简体中文

> **迁移自**：[XxHuberrr/Mineradio](https://github.com/XxHuberrr/Mineradio) — 原 Electron + 原生 JS 代码库
> **当前状态**：可用桌面应用（迁移进行中，活跃开发中）

一款沉浸式音频响应桌面音乐播放器。集成天气电台、3D 粒子视觉、歌词舞台、3D 歌单架，支持双音源（网易云音乐 + QQ 音乐）——基于 SolidJS 细粒度响应式前端，运行于 Bun + Electrobun。

---

## 这是什么

Mineradio 是一款 Windows 桌面应用，将音乐播放转化为空间视觉体验。播放曲目时，Three.js 场景会随节拍响应：粒子脉动、镜头随低音呼吸、歌词在 3D 空间浮动。右键呼出 3D 歌单架浏览播放列表。桌面覆盖层显示同步歌词，独立的壁纸窗口则将专辑封面与色彩投射到桌面。

本仓库是对原版 [Mineradio](https://github.com/XxHuberrr/Mineradio)（Electron + 单个 23k 行 `app.js`）的**从零重写**。逻辑、视觉引擎、UI 和后端正在迁移到 SolidJS + Bun 架构：类型化 Store、框架无关 Hooks、Bun 原生 HTTP 后端。

新前端已可独立运行；遗留文件仍保留在仓库中作为参考，但**当前构建不会执行它**。

---

## 技术栈

| 层级      | 技术                                                              |
| --------- | ----------------------------------------------------------------- |
| UI 框架   | **SolidJS 1.9** — 细粒度信号，无虚拟 DOM                          |
| 运行时    | **Bun 1.1** — 原生 TypeScript，内置 HTTP / WebSocket / SQLite     |
| 桌面壳    | **Electrobun 1.18** — Bun 驱动的 WebView（无 Electron / Node.js） |
| 构建      | **Vite 6** + `vite-plugin-solid`（开发期 HMR）                    |
| 状态管理  | **SolidJS `createStore`**（15 个领域 Store）+ 自定义 Hooks        |
| 3D / 视觉 | **Three.js r128** + 内联 GLSL Shader + Web Audio API              |
| 后端      | **Bun HTTP** 服务器 + WebSocket 上的 JSON-RPC                     |
| 音乐 API  | NeteaseCloudMusicApi（REST） · QQ 音乐（抓取 + RPC）              |
| 测试      | Playwright                                                        |

---

## 目录结构

```
src/
├── mainview/                        # SolidJS 前端
│   ├── components/
│   │   ├── panels/                  # Splash · SearchArea · PlaylistPanel · BottomBar
│   │   │                           # · FxPanel · StageLyrics · EmptyHome · Modals
│   │   └── ui/                      # TopRight · StatusChips · Background · GestureHud
│   │                               # · ThumbWrap · VisualGuide · TrialBanner · Overlays
│   │                               # · HiddenInputs
│   ├── stores/                      # 15 个类型化 SolidJS Store（单一数据源）
│   │   ├── audioStore.ts            # AudioElement、AudioContext、分析器、音量、FFT
│   │   ├── playbackStore.ts         # playQueue、currentIdx、playMode、playlist
│   │   ├── visualStore.ts           # bass/mid/treble、beatPulse、beatCam、cinemaDynamics
│   │   ├── lyricsStore.ts           # lyricsLines、customLyricMap、卡拉 OK 状态
│   │   ├── searchStore.ts           # mode、results、history、podcasts
│   │   ├── authStore.ts             # Netease + QQ loginStatus、二维码流程、双账号
│   │   ├── userStore.ts             # userPlaylists、likedSongMap、collectBusy
│   │   ├── fxStore.ts               # 100+ 视觉特效参数、预设、过渡
│   │   ├── shelfStore.ts            # shelf 模式、 pinned、hoverCue、cards
│   │   ├── settingsStore.ts         # diyMode、热键、自动隐藏、音质
│   │   ├── homeStore.ts             # 发现流、天气电台、收听统计
│   │   ├── uiStore.ts               # 自动隐藏计时器、沉浸模式、模态框、波纹
│   │   ├── performanceStore.ts      # 自适应 FPS、封面深度缓存、功耗模式
│   │   ├── actionStore.ts           # Zustand 回调注册表（解耦组件）
│   │   └── archiveStore.ts          # 预设存档管理
│   ├── hooks/                       # ~14 个业务逻辑 Hooks（仅操作 Store）
│   │   ├── useVisualEngine.ts       # Three.js 初始化、渲染循环、粒子、泛光、3D 歌单架
│   │   ├── useAudioPlayback.ts      # playQueueAt、togglePlay、next/prev、淡入淡出、音量
│   │   ├── useBeatDetection.ts      # FFT 分频、起始检测、beatCam
│   │   ├── useSearch.ts             # Netease + QQ 搜索、去重、播客、历史
│   │   ├── useAuth.ts               # 二维码轮询、网页登录、Cookie 导入、登出
│   │   ├── usePlaylists.ts          # 加载、喜欢、收藏、创建歌单
│   │   ├── useLyrics.ts             # 获取/解析 LRC/KRC、自定义歌词 CRUD、3D tick
│   │   ├── useHomeDiscover.ts       # 个性化推荐、天气电台、收听统计
│   │   ├── useHotkeys.ts            # 键盘调度、自定义热键捕获
│   │   ├── usePerformance.ts        # 自适应 FPS、缓存清理、性能标记
│   │   ├── useDesktopLyrics.ts      # 覆盖层窗口 RPC 同步
│   │   ├── useDesktopWallpaper.ts   # 壁纸窗口 RPC 同步
│   │   ├── useIdleGuide.ts          # 空闲动画引导序列
│   │   ├── useControlGlass.ts       # 毛玻璃 shader uniforms
│   │   ├── useThemeColors.ts        # 从封面提取色彩
│   │   ├── useCoverCrop.ts          # 封面裁剪 UI 状态
│   │   ├── useSplashAnimation.ts    # 启动页入场/出场
│   │   └── useGesture.ts            # 鼠标拖拽轨道、惯性、头部视差
│   ├── legacy/visuals/              # （预留 — 引擎实现在 useVisualEngine Hook 中）
│   ├── lib/
│   │   ├── api.ts                   # JSON-RPC 客户端 + 旧版 REST 兼容
│   │   ├── uiControls.ts            # 底部栏自动隐藏、边框状态
│   │   ├── homeDiscover.ts          # 首页卡片点击处理
│   │   ├── homeActions.ts · homeVisibility.ts · playbackBridge.ts
│   │   └── constants.ts             # Store 键、视觉预设 Schema、API 路由
│   ├── App.tsx                      # 根组件 — 挂载 14 个 Hooks、全局 DOM 桥接
│   └── main.tsx                     # 入口 — render(<App />, #app)
│
└── bun/                             # Bun 后端
    ├── server.ts                    # 复合 HTTP + WebSocket 服务器
    ├── routes/
    │   ├── legacy.ts                # REST 兼容端点
    │   └── rpc.ts                   # JSON-RPC 2.0 处理器
    ├── providers/
    │   ├── netease.ts               # NeteaseCloudMusicApi 封装
    │   └── qq.ts                    # QQ 音乐搜索 · 登录 · 流媒体 URL
    └── index.ts                     # 导出
```

---

## 运行指南

### 前置要求

| 要求    | 版本  | 安装                                        |
| ------- | ----- | ------------------------------------------- |
| **Bun** | ≥ 1.1 | `curl -fsSL https://bun.sh/install \| bash` |
| **Git** | 任意  | 系统包管理器                                |

### 开发

```bash
# 安装依赖
bun install

# 一键启动 — Vite HMR + Electrobun WebView + Bun 后端
bun run dev

# 单独启动后端（端口打印在启动日志中）
bun run dev:server
```

`bun run dev`：Vite 将前端构建到 `dist/`，Electrobun 将 Bun 后端打包为 `main.js`，然后启动指向开发服务器的 WebView（HMR 热重载）。后端端口通过 `?apiPort=<port>` 查询字符串注入。

### 生产构建

```bash
bun run build          # vite build → dist/
bun run build:win      # Windows NSIS 安装包
bun run start          # 构建后启动
```

---

## 核心概念

### Store = 单一数据源

所有应用状态存在于 SolidJS `createStore` 调用中。除 effects 管理的 DOM 引用外，无全局变量。每个 UI 数据项 —— 播放队列、音量、FFT 频段、登录状态、搜索历史、FX 参数 —— 都有且仅有一个所有者。

Store 通过 `useXxx()` Hook 暴露，返回 `{ state, ...methods }`。组件通过 `state.field()`（细粒度信号）读取，通过返回的方法写入。

### Hook = 框架无关的业务逻辑

Hooks 是纯函数，接收 Store 引用并返回命令 API。它们不含 JSX、不含 SolidJS 模板代码、不含 DOM 查询 —— 仅使用 SolidJS 响应式原语（`createEffect`、`onCleanup`、`createSignal`）和 Store 变更。业务逻辑因此可测试、可移植。

最大的 Hook 是 `useVisualEngine`（约 2 000 行），拥有 Three.js 生命周期。它创建场景、设置粒子几何体、运行 `requestAnimationFrame` 渲染循环、每帧读取 `visualStore` 更新 Shader uniforms，并管理自适应 FPS 调度。`Background` 等组件只提供 `<canvas>` 容器 —— Hook 将 Three.js 渲染器附加其中。

### 后端 = Bun HTTP + JSON-RPC

`src/bun/server.ts` 中的 Bun 服务器运行两层：

1. **HTTP REST**（`/api/*`）—— 图片代理、桌面歌词状态端点、壁纸状态端点、旧版兼容。
2. **WebSocket 上的 JSON-RPC 2.0**（`/rpc`）—— 低延迟方法调度到 `providers/netease.ts` 和 `providers/qq.ts`。

前端通过 `src/mainview/lib/api.ts` 调用后端，这是一个小型类型化 RPC 客户端，序列化方法名 + 参数并返回类型化结果。

### 遗留文件

`public/legacy/app.js`（23 624 行）**不被当前 `App.tsx` 入口执行**。它仍在 `electrobun.config.ts` 的 `copy` 配置中，因此会随打包产物分发，但处于非激活状态。保留在仓库中作为迁移期间的参考实现；待所有组件完全响应式且无遗留路径后可删除。

---

## 主要特性

| 特性                               | 位置                                                                               |
| ---------------------------------- | ---------------------------------------------------------------------------------- |
| Web Audio · FFT · 节拍检测         | `stores/audioStore.ts` + `hooks/useAudioAnalysis.ts` + `hooks/useBeatDetection.ts` |
| Three.js 视觉引擎（6 预设）        | `hooks/useVisualEngine.ts` — 丝绸、隧道、轨道、虚空、黑胶、壁纸脉冲、骷髅          |
| 响应式歌词（LRC / KRC / 自定义）   | `stores/lyricsStore.ts` + `hooks/useLyrics.ts`                                     |
| 3D 歌单架（侧边 / 舞台）           | `hooks/useShelf3D.ts` + `hooks/useShelf.ts`                                        |
| 桌面歌词覆盖层                     | `hooks/useDesktopLyrics.ts` · `src/bun/index.ts` BrowserWindow                     |
| 桌面壁纸覆盖层                     | `hooks/useDesktopWallpaper.ts` · `src/bun/index.ts` BrowserWindow                  |
| 网易登录（二维码 / 网页 / Cookie） | `hooks/useAuth.ts` + `providers/netease.ts`                                        |
| QQ 搜索 + 登录                     | `hooks/useAuth.ts` + `providers/qq.ts`                                             |
| 搜索去重（编辑距离）+ 播客         | `hooks/useSearch.ts`                                                               |
| 天气电台（Open-Meteo）             | `hooks/useHomeDiscover.ts` + `homeDiscover.ts`                                     |
| DIY 自由视角 · 手势旋转            | `hooks/useGesture.ts` · `settingsStore.ts`                                         |
| 自适应 FPS · 性能监控              | `hooks/usePerformance.ts` · `stores/performanceStore.ts`                           |

---

## 脚本速查

| 命令                   | 作用                               |
| ---------------------- | ---------------------------------- |
| `bun run dev`          | Vite 构建 → Electrobun 开发（HMR） |
| `bun run dev:hmr`      | Vite (:5173) + Electrobun 并发运行 |
| `bun run dev:server`   | 仅后端（REST + RPC + 覆盖层窗口）  |
| `bun run build`        | 生产构建前端                       |
| `bun run build:canary` | 以 `canary` 环境标记构建           |
| `bun run start`        | 构建后启动生产版                   |
| `bun run hidden`       | 构建后无窗口启动（后台模式）       |
| `bun run test`         | Playwright E2E 测试套件            |

---

## 状态一览

```
Store            状态行数    关键信号消费者
-----------       ---------   --------------------
audioStore        ~40         音量、播放状态、FFT 缓冲区
playbackStore     ~20         BottomBar、PlaylistPanel、ThumbWrap
visualStore       ~80         useVisualEngine 渲染循环、beatCam uniforms
lyricsStore       ~30         StageLyrics、卡拉 OK 高亮、桌面覆盖层
searchStore       ~25         SearchArea、历史标签、结果列表
authStore         ~50         TopRight、Splash、登录模态框
userStore         ~25         歌单 LIKE 状态、封面缓存
fxStore           ~100         每帧（预设 uniforms、过渡）
shelfStore        ~15         shelf3D 射线检测、hoverCue
settingsStore     ~35         热键、自动隐藏、音质、diyMode
homeStore         ~25         EmptyHome、天气展示、统计
uiStore           ~30         自动隐藏计时器、模态框、波纹、引导
performanceStore ~20          自适应 FPS、缓存清理
actionStore       ~10         播放桥接、首页卡片动作
archiveStore      ~15         预设存档 CRUD
```

---

## 贡献

```bash
# 查看变更
git status

# 提交前运行类型检查
bun run lint          # (tsc --noEmit)

# 手动 QA
bun run dev
```

本仓库活跃重构中。代码库遵循的核心 SolidJS 约定：

- **派生/UI 状态用 Signals** — `createSignal` 用于组件本地状态
- **应用状态用 `createStore`** — 所有跨组件可变状态
- **派生计算用 `createSelector` 或 `createMemo`** — 避免不必要重算
- **副作用用 `createEffect`** — `onCleanup` 始终配对
- **新组件不用 `document.getElementById`** — 仅使用 SolidJS ref；剩余的 DOM 查询是正在逐步移除的遗留桥接
- **TypeScript strict** — 无无故 `any`，需加显式注释说明

---

<a name="english"></a>

[A quick link back to English](#english) · [快速返回简体中文](#简体中文)

**English**.

[English](#%E8%8B%B1%E6%96%87) · [简体中文](#%E7%AE%80%E4%BD%93%E4%B8%AD%E6%96%87)

---

## 简体中文

- 原版 [Mineradio](https://github.com/XxHuberrr/Mineradio) — 创意、视觉设计与原始 Electron 实现，作者 [XxHuberrr](https://github.com/XxHuberrr)

