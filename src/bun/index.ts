import { BrowserWindow, ApplicationMenu } from "electrobun/bun";
import { startCombinedServer, getPort } from "./server";

// Start the combined HTTP server (serves both API and built frontend files)
await startCombinedServer();
const port = getPort();
const url = `http://127.0.0.1:${port}`;

const isHidden = process.env.HIDDEN === "1";

console.log(`[Mineradio] App URL: ${url}`);

// Desktop lyrics overlay state
let overlayWindow: BrowserWindow | null = null;
let overlayState: any = {
  enabled: false,
  text: "",
  progress: 0,
  progressSpan: 1,
  title: "",
  artist: "",
  playing: false,
  size: 1.0,
  opacity: 0.92,
  y: 0.76,
  clickThrough: false,
  cinema: true,
  highlightFollow: false,
  frameRate: 60,
  fontFamily: "\u9ed1\u4f53",
  fontWeight: 700,
  letterSpacing: 2,
  lineHeight: 1.0,
  lyricScale: 1.0,
  feather: 0.03,
  motion: { beatGlow: 0, glowBreath: 0, sunEnergy: 0 },
  colors: { primary: "#d6f8ff", highlight: "#fff0b8", glow: "#9cffdf" },
};

function buildOverlayHtml(): string {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{background:transparent;overflow:hidden;font-family:"\u9ed1\u4f53","SimHei","Microsoft YaHei",sans-serif}
body{display:flex;align-items:center;justify-content:center;width:100vw;height:100vh}
.lyric-line{position:absolute;left:50%;top:var(--y,76%);transform:translate(-50%,-50%);text-align:center;white-space:nowrap;max-width:92vw;padding:0 24px;font-size:clamp(28px,var(--size,1) * 4vw,64px);font-weight:var(--weight,700);letter-spacing:var(--ls,2px);line-height:var(--lh,1);color:#fff;opacity:var(--opacity,0.92);text-shadow:0 0 14px rgba(168,246,255,var(--glow,0)),0 0 36px rgba(143,233,255,var(--glow,0)),0 0 80px rgba(115,167,255,var(--glow,0));filter:drop-shadow(0 4px 22px rgba(143,233,255,var(--glow,0)));transition:opacity .3s,transform .3s}
</style></head><body>
<div class="lyric-line" id="lyric"></div>
<script>
let state={};
async function poll(){
  try{const r=await fetch('/api/desktop-lyrics-state');if(r.ok)state=await r.json();render();}catch(e){}
  setTimeout(poll,Math.max(16,1000/(state.frameRate||60)));
}
function render(){
  const el=document.getElementById('lyric');
  if(!el)return;
  if(!state.enabled||!state.text){el.style.display='none';return;}
  el.style.display='';
  el.style.setProperty('--y',(state.y*100)+'%');
  el.style.setProperty('--size',state.size||1);
  el.style.setProperty('--opacity',state.opacity||0.92);
  el.style.setProperty('--weight',state.fontWeight||700);
  el.style.setProperty('--ls',(state.letterSpacing||2)+'px');
  el.style.setProperty('--lh',state.lineHeight||1);
  el.style.setProperty('--glow',state.motion?.beatGlow||0);
  el.textContent=state.text||'';
}
poll();
</script></body></html>`;
}

function createOverlayWindow() {
  if (overlayWindow) return;
  overlayWindow = new BrowserWindow({
    title: "Mineradio Lyrics",
    url: "about:blank",
    frame: { x: 0, y: 0, width: 1280, height: 800 },
    titleBarStyle: "hidden",
    transparent: true,
    passthrough: overlayState.clickThrough,
    hidden: false,
  });
  overlayWindow.setAlwaysOnTop(true);
  (globalThis as any).__overlayWindow = overlayWindow;
  overlayWindow.on("close", () => { overlayWindow = null; });
}

function destroyOverlayWindow() {
  if (overlayWindow) {
    overlayWindow.close();
    overlayWindow = null;
  }
}

// Expose overlay state getter/setter for HTTP endpoints
(globalThis as any).__getOverlayState = () => overlayState;
(globalThis as any).__setOverlayState = (patch: any) => {
  Object.assign(overlayState, patch);
  if (patch.enabled && !overlayWindow) createOverlayWindow();
  if (!patch.enabled && overlayWindow) destroyOverlayWindow();
};

// Dev server check for HMR
const DEV_SERVER_PORT = 5173;
try {
  await fetch(`http://localhost:${DEV_SERVER_PORT}`, { method: "HEAD" });
  const devUrl = `http://localhost:${DEV_SERVER_PORT}?apiPort=${port}`;
  console.log(`[Mineradio] HMR enabled: ${devUrl}`);

  const devMainWindow = new BrowserWindow({
    title: "Mineradio",
    url: devUrl,
    frame: { x: 0, y: 0, width: 1280, height: 800 },
    titleBarStyle: "hidden",
    hidden: isHidden,
  });

  (globalThis as any).__mainWindow = devMainWindow;
} catch {
  const mainWindow = new BrowserWindow({
    title: "Mineradio",
    url,
    frame: { x: 0, y: 0, width: 1280, height: 800 },
    titleBarStyle: "hidden",
    hidden: isHidden,
  });

  (globalThis as any).__mainWindow = mainWindow;
}

// Configure application menu
ApplicationMenu.setApplicationMenu([
  {
    submenu: [{ label: "Quit", role: "quit" }],
  },
  {
    label: "Edit",
    submenu: [
      { role: "undo" },
      { role: "redo" },
      { type: "separator" },
      { role: "cut" },
      { role: "copy" },
      { role: "paste" },
      { role: "pasteAndMatchStyle" },
      { role: "delete" },
      { role: "selectAll" },
    ],
  },
]);
