// @ts-nocheck
import { useAuth } from "../stores/authStore";
import { useSettings } from "../stores/settingsStore";
import { useUi } from "../stores/uiStore";
import { usePlayback } from "../stores/playbackStore";
import { useHome } from "../stores/homeStore";
import { hasAnyPlatformLogin } from "./platformLogin";
import { setPeek } from "./peek";
import { revealBottomControls } from "./uiControls";
import { UPLOAD_TIP_STORE_KEY, VISUAL_GUIDE_SEEN_STORE_KEY } from "../utils/constants";

// ── Visual Guide Step Data ──

interface VisualGuideStep {
  target?: string;
  selector?: string;
  kicker: string;
  title: string;
  body: string;
}

const visualGuideSteps: VisualGuideStep[] = [
  {
    target: "stage",
    kicker: "01 / Welcome",
    title: "Mineradio 是用来听歌的视觉播放器",
    body: "它不是单纯歌单页：搜索或导入一首歌后，封面、歌词、粒子和镜头会跟着音乐一起动。",
  },
  {
    selector: "#search-box",
    kicker: "02 / Play",
    title: "从搜索或导入开始",
    body: "输入歌名、歌手或关键词即可播放；如果有本地音乐，也可以用导入入口直接放进舞台。",
  },
  {
    selector: "#bottom-bar",
    kicker: "03 / Control",
    title: "播放以后看底部控制台",
    body: "播放、切歌、进度、队列和歌词都集中在底部，先把它当作一个正常播放器使用就可以。",
  },
  {
    selector: "#user-btn",
    kicker: "04 / Account",
    title: "登录只是为了同步你的音乐库",
    body: "登录后会同步歌单、红心和播客；不登录也可以搜索和播放，不会强制卡住你。",
  },
  {
    target: "shelf",
    kicker: "05 / Visual",
    title: "进阶视觉都放在舞台周围",
    body: "右侧 3D 歌单架和 DIY 玩家模式是进阶入口；先播放一首歌，再慢慢调视觉效果。",
  },
  {
    selector: "#diy-mode-btn",
    kicker: "06 / DIY",
    title: "高级功能在 DIY 玩家模式",
    body: "视觉控制台、上传/封面、自定义歌词、音质和更多面板都会在这里展开。",
  },
];

const visualGuideStepsDiy: VisualGuideStep[] = [
  {
    selector: "#diy-mode-btn",
    kicker: "01 / DIY",
    title: "DIY 玩家模式已展开",
    body: "这里可以随时切回默认模式。DIY 模式会显示完整控制台、上传、视觉面板和高级调参。",
  },
  {
    selector: "#search-box",
    kicker: "02 / Search",
    title: "搜索源和导入入口会展开",
    body: "顶部搜索支持更多来源切换，上传歌曲、封面等入口也会在 DIY 模式中显示。",
  },
  {
    selector: "#playlist-panel",
    kicker: "03 / Library",
    title: "左侧是完整歌单和队列",
    body: "靠近左侧边缘可以打开歌单/队列面板，在这里管理队列、个人歌单和播客。",
  },
  {
    selector: "#fx-panel",
    kicker: "04 / Visual Lab",
    title: "右侧是视觉控制台",
    body: "靠近右下角或点击视觉按钮，可以调节粒子、歌词、镜头、3D 歌单架和更多视觉参数。",
  },
  {
    selector: "#quality-control",
    kicker: "05 / Controls",
    title: "高级播放控制会补全",
    body: "音质、播放顺序、收藏、歌词源和更多按钮会在 DIY 模式中完整显示。",
  },
  {
    target: "shelf",
    kicker: "06 / Shelf",
    title: "3D 歌单架支持直接打开",
    body: "右侧的 3D 歌单架会在靠近时半透明浮现，点击卡片可打开歌单，点卡片里的播放按钮可直接播放整张歌单。",
  },
];

export function activeVisualGuideSteps(): VisualGuideStep[] {
  const settings = useSettings();
  return settings.state.diyPlayerMode ? visualGuideStepsDiy : visualGuideSteps;
}

// ── Visual Guide State ──

function visualGuideWasSeen(): boolean {
  try { return localStorage.getItem(VISUAL_GUIDE_SEEN_STORE_KEY) === "1"; } catch { return false; }
}

function markVisualGuideSeen() {
  try { localStorage.setItem(VISUAL_GUIDE_SEEN_STORE_KEY, "1"); } catch { /* ignore */ }
}

// ── Target Rect Calculation ──

function guideTargetRect(step: VisualGuideStep | undefined): { left: number; top: number; width: number; height: number; right: number; bottom: number } {
  const IW = window.innerWidth;
  const IH = window.innerHeight;

  if (step && step.target === "stage") {
    const stageW = Math.min(620, Math.max(260, IW - 72));
    const stageH = Math.min(310, Math.max(178, IH * 0.34));
    const stageLeft = IW * 0.5 - stageW * 0.5;
    const stageTop = Math.max(116, IH * 0.32 - stageH * 0.5);
    return { left: stageLeft, top: stageTop, width: stageW, height: stageH, right: stageLeft + stageW, bottom: stageTop + stageH };
  }

  if (step && step.target === "shelf") {
    // Fallback: use a reasonable rect on the right side
    const shelfW = 120;
    const shelfH = 200;
    const shelfLeft = Math.max(12, IW - shelfW - 40);
    const shelfTop = Math.max(12, IH * 0.3);
    return { left: shelfLeft, top: shelfTop, width: shelfW, height: shelfH, right: shelfLeft + shelfW, bottom: shelfTop + shelfH };
  }

  if (step && step.selector === "#bottom-bar") {
    const bar = document.getElementById("bottom-bar");
    const progressBar = document.getElementById("progress-bar");
    const controls = document.getElementById("controls");
    if (bar) {
      const br = bar.getBoundingClientRect();
      let left = br.left, top = br.top, right = br.right, bottom = br.bottom;
      [progressBar, controls].forEach((el) => {
        if (!el) return;
        const r = el.getBoundingClientRect();
        if (r.width <= 0 || r.height <= 0) return;
        left = Math.min(left, r.left);
        top = Math.min(top, r.top);
        right = Math.max(right, r.right);
        bottom = Math.max(bottom, r.bottom);
      });
      return { left, top, width: right - left, height: bottom - top, right, bottom };
    }
  }

  if (step && step.selector) {
    const target = document.querySelector(step.selector) as HTMLElement | null;
    if (target) {
      const style = window.getComputedStyle(target);
      const rect = target.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden") {
        return { left: rect.left, top: rect.top, width: rect.width, height: rect.height, right: rect.right, bottom: rect.bottom };
      }
    }
  }

  if (step && step.selector === "#diy-mode-btn") {
    const fallbackRight = Math.max(116, IW - 26);
    const fallbackTop = 16;
    return { left: fallbackRight - 88, top: fallbackTop, width: 88, height: 38, right: fallbackRight, bottom: fallbackTop + 38 };
  }

  return { left: IW * 0.5 - 120, top: IH * 0.5 - 40, width: 240, height: 80, right: IW * 0.5 + 120, bottom: IH * 0.5 + 40 };
}

// ── Prepare Step (peek/visible toggling) ──

function prepareVisualGuideStep(step: VisualGuideStep | undefined) {
  const ui = useUi();
  const search = document.getElementById("search-area");
  const bottom = document.getElementById("bottom-bar");
  const fxPanel = document.getElementById("fx-panel");
  const playlistPanel = document.getElementById("playlist-panel");

  if (step && step.selector === "#search-box") setPeek(search, true, "search");
  if (step && step.selector === "#playlist-panel") setPeek(playlistPanel, true, "pl");
  else if (playlistPanel && !ui.state.visualGuideState.plWasPeek) setPeek(playlistPanel, false, "pl");
  if (step && step.selector === "#fx-panel") setPeek(fxPanel, true, "fx");
  else if (fxPanel && !ui.state.visualGuideState.fxWasPeek) setPeek(fxPanel, false, "fx");
  if (step && (step.selector === "#bottom-bar" || step.selector === "#mini-queue-btn" || step.selector === "#immersive-btn" || step.selector === "#quality-control")) {
    if (bottom) bottom.classList.add("visible");
    revealBottomControls(1500);
  }
}

// ── Position Ring + Card ──

function positionVisualGuideStep() {
  const ui = useUi();
  if (!ui.state.visualGuideActive) return;
  const guide = document.getElementById("visual-guide");
  const ring = document.getElementById("visual-guide-ring");
  const card = document.getElementById("visual-guide-card");
  if (!guide || !ring || !card) return;

  const steps = activeVisualGuideSteps();
  const step = steps[ui.state.visualGuideStep];
  const rect = guideTargetRect(step);

  // Toggle shelf-target class
  ring.classList.toggle("shelf-target", !!(step && step.target === "shelf"));

  // Position ring
  const pad = step && step.target === "shelf" ? 14 : (step && step.selector === "#bottom-bar" ? 10 : 8);
  const left = Math.max(12, rect.left - pad);
  const top = Math.max(12, rect.top - pad);
  const width = Math.min(window.innerWidth - left - 12, rect.width + pad * 2);
  const height = Math.min(window.innerHeight - top - 12, rect.height + pad * 2);
  ring.style.left = left + "px";
  ring.style.top = top + "px";
  ring.style.width = Math.max(44, width) + "px";
  ring.style.height = Math.max(38, height) + "px";
  ring.style.borderRadius = step && step.target === "shelf" ? "28px" : ((step && step.selector === "#bottom-bar") ? "20px" : "16px");

  // Scrim gradient center
  const scrim = guide.querySelector(".visual-guide-scrim") as HTMLElement | null;
  if (scrim) {
    scrim.style.setProperty("--gx", ((rect.left + rect.width / 2) / Math.max(1, window.innerWidth) * 100).toFixed(2) + "%");
    scrim.style.setProperty("--gy", ((rect.top + rect.height / 2) / Math.max(1, window.innerHeight) * 100).toFixed(2) + "%");
  }

  // Position card
  const cardW = Math.min(326, window.innerWidth - 32);
  const cardH = card.offsetHeight || 170;
  let cardLeft = rect.left + rect.width / 2 - cardW / 2;
  cardLeft = Math.max(16, Math.min(window.innerWidth - cardW - 16, cardLeft));
  const below = rect.bottom + 18;
  const above = rect.top - cardH - 18;
  const cardTop = below + cardH < window.innerHeight - 16 ? below : Math.max(16, above);
  card.style.left = cardLeft + "px";
  card.style.top = cardTop + "px";
}

function scheduleVisualGuidePositioning() {
  requestAnimationFrame(positionVisualGuideStep);
  setTimeout(positionVisualGuideStep, 180);
  setTimeout(positionVisualGuideStep, 620);
}

// ── Show Step ──

function showVisualGuideStep(index: number) {
  const ui = useUi();
  const steps = activeVisualGuideSteps();
  const clamped = Math.max(0, Math.min(steps.length - 1, index));
  ui.setVisualGuideStep(clamped);
  prepareVisualGuideStep(steps[clamped]);
  scheduleVisualGuidePositioning();
}

// ── Next Step ──

export function nextVisualGuideStep() {
  const ui = useUi();
  const steps = activeVisualGuideSteps();
  if (ui.state.visualGuideStep >= steps.length - 1) {
    closeVisualGuide(true);
    return;
  }
  showVisualGuideStep(ui.state.visualGuideStep + 1);
}

// ── Close Guide ──

export function closeVisualGuide(markSeen?: boolean) {
  const ui = useUi();
  const guide = document.getElementById("visual-guide");
  ui.setVisualGuideActive(false);
  if (markSeen) markVisualGuideSeen();
  if (guide) {
    guide.classList.remove("show");
    guide.setAttribute("aria-hidden", "true");
  }
  document.body.classList.remove("visual-guide-active");
  document.body.classList.remove("fullscreen-diy-peek");

  const search = document.getElementById("search-area");
  const bottom = document.getElementById("bottom-bar");
  const fxPanel = document.getElementById("fx-panel");
  const playlistPanel = document.getElementById("playlist-panel");

  if (search && !ui.state.visualGuideState.searchWasPeek && document.activeElement?.tagName !== "INPUT") {
    setPeek(search, false, "search");
  }
  if (fxPanel && !ui.state.visualGuideState.fxWasPeek) setPeek(fxPanel, false, "fx");
  if (playlistPanel && !ui.state.visualGuideState.plWasPeek) setPeek(playlistPanel, false, "pl");

  const playback = usePlayback();
  if (bottom && !ui.state.visualGuideState.bottomWasVisible && !playback.state.playing) {
    bottom.classList.remove("visible", "soft-hidden");
  }
}

// ── Surface Click ──

function handleVisualGuideSurfaceClick(e: MouseEvent) {
  const ui = useUi();
  if (!ui.state.visualGuideActive) return;
  if (e && e.target && (e.target as HTMLElement).closest && (e.target as HTMLElement).closest("button")) return;
  if (e && e.preventDefault) e.preventDefault();
  nextVisualGuideStep();
}

// ── Start Guide ──

export function maybeRunStartupVisualGuide(source?: string): boolean {
  const ui = useUi();
  if (visualGuideWasSeen() || ui.state.visualGuideActive) return false;
  const settings = useSettings();
  if (settings.state.immersiveMode) return false;
  const pb = usePlayback();
  if (pb.state.playing) return false;
  if (source !== "manual" && !hasAnyPlatformLogin()) return false;
  setTimeout(() => {
    if (!visualGuideWasSeen() || source === "manual") startVisualGuide({ source: source || "startup" });
  }, source === "splash" ? 3600 : 1400);
  return true;
}

export function startVisualGuide(opts?: { source?: string; manual?: boolean }) {
  if (document.body.classList.contains("splash-active")) {
    setTimeout(() => startVisualGuide(opts), 700);
    return;
  }
  const settings = useSettings();
  if (settings.state.immersiveMode) settings.toggleImmersiveMode();
  const ui = useUi();

  // Capture panel peek states before showing guide
  const bottom = document.getElementById("bottom-bar");
  const search = document.getElementById("search-area");
  const fxPanel = document.getElementById("fx-panel");
  const playlistPanel = document.getElementById("playlist-panel");
  ui.set("visualGuideState", {
    bottomWasVisible: !!(bottom && bottom.classList.contains("visible")),
    searchWasPeek: !!(search && search.classList.contains("peek")),
    fxWasPeek: !!(fxPanel && fxPanel.classList.contains("peek")),
    plWasPeek: !!(playlistPanel && playlistPanel.classList.contains("peek")),
    manual: !!(opts && opts.manual),
  });

  ui.setVisualGuideActive(true);
  document.body.classList.add("visual-guide-active");
  ui.setVisualGuideStep(0);

  const guide = document.getElementById("visual-guide");
  if (guide) {
    guide.classList.add("show");
    guide.setAttribute("aria-hidden", "false");
  }

  if (!ui.state.visualGuideResizeBound) {
    ui.set("visualGuideResizeBound", true);
    window.addEventListener("resize", positionVisualGuideStep);
    window.addEventListener("scroll", positionVisualGuideStep, true);
  }

  // Bind surface click
  if (guide && !(guide as any)._guideClickBound) {
    (guide as any)._guideClickBound = true;
    guide.addEventListener("click", handleVisualGuideSurfaceClick);
  }

  showVisualGuideStep(0);
}

export function completeVisualGuide() {
  markVisualGuideSeen();
  const ui = useUi();
  ui.setVisualGuideActive(false);
  document.body.classList.remove("visual-guide-active");
  const guide = document.getElementById("visual-guide");
  if (guide) {
    guide.classList.remove("show");
    guide.setAttribute("aria-hidden", "true");
  }
}

// ── Login Guide ──

let startupLoginGuideShown = false;

export function maybeRunStartupLoginGuide(source?: string) {
  if (startupLoginGuideShown) return;
  const ui = useUi();
  if (ui.state.visualGuideActive) return;
  if (document.body.classList.contains("splash-active")) return;
  const settings = useSettings();
  if (settings.state.immersiveMode) return;
  const auth = useAuth();
  if (!auth.state.loginStatusChecked || auth.state.loginStatusCheckFailed || auth.state.loginStatus.loggedIn) return;
  const pb = usePlayback();
  if (pb.state.playing) return;
  const loginModal = document.getElementById("login-modal");
  const userModal = document.getElementById("user-modal");
  if ((loginModal && loginModal.classList.contains("show")) || (userModal && userModal.classList.contains("show"))) return;
  startupLoginGuideShown = true;
  setTimeout(() => {
    const auth2 = useAuth();
    const pb2 = usePlayback();
    const settings2 = useSettings();
    if (auth2.state.loginStatus.loggedIn || pb2.state.playing || settings2.state.immersiveMode || document.body.classList.contains("splash-active")) return;
    auth2.showLoginModal();
  }, source === "splash" ? 6200 : 2600);
}

// ── Upload Tip ──

function uploadTipWasSeen(): boolean {
  try { return localStorage.getItem(UPLOAD_TIP_STORE_KEY) === "1"; } catch { return true; }
}

function markUploadTipSeen() {
  try { localStorage.setItem(UPLOAD_TIP_STORE_KEY, "1"); } catch { /* ignore */ }
}

let uploadTipTimer: ReturnType<typeof setTimeout> | null = null;
let uploadTipAttempts = 0;

export function maybeShowUploadTipOnce() {
  const settings = useSettings();
  if (!settings.state.diyPlayerMode) return;
  if (uploadTipWasSeen()) return;
  if (settings.state.immersiveMode) {
    setTimeout(maybeShowUploadTipOnce, 1800);
    return;
  }
  if (document.body.classList.contains("splash-active")) {
    setTimeout(maybeShowUploadTipOnce, 900);
    return;
  }
  const auth = useAuth();
  if (auth.state.modalOpen) {
    uploadTipAttempts++;
    if (uploadTipAttempts < 18) setTimeout(maybeShowUploadTipOnce, 1800);
    return;
  }
  const area = document.getElementById("search-area");
  const tip = document.getElementById("upload-tip");
  if (!area || !tip) return;
  markUploadTipSeen();
  setPeek(area, true, "search");
  tip.classList.add("show");
  uploadTipTimer = setTimeout(() => {
    uploadTipTimer = null;
    closeUploadTip(false);
    setPeek(area, false, "search");
  }, 6800);
}

export function closeUploadTip(manual?: boolean) {
  if (uploadTipTimer) { clearTimeout(uploadTipTimer); uploadTipTimer = null; }
  if (manual) markUploadTipSeen();
  const tip = document.getElementById("upload-tip");
  if (!tip || !tip.classList.contains("show")) return;
  tip.classList.remove("show");
}
