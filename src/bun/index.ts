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

// Desktop wallpaper overlay state
let wallpaperWindow: BrowserWindow | null = null;
let wallpaperState: any = {
  enabled: false,
  title: "",
  artist: "",
  cover: "",
  playing: false,
  opacity: 1.0,
  preset: "default",
  colors: { primary: "#1a1a2e", secondary: "#16213e", highlight: "#e94560", glow: "#0f3460" },
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

// ── Wallpaper overlay ──

function buildWallpaperHtml(): string {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{background:#050608;overflow:hidden;width:100vw;height:100vh}
canvas{display:block;width:100%;height:100%}
</style></head><body>
<canvas id="c"></canvas>
<script>
let S={enabled:false,cover:'',playing:false,opacity:1,colors:{primary:'#1a1a2e',secondary:'#16213e',highlight:'#e94560',glow:'#0f3460'}};
let coverImg=null,particles=[],raf=0;
const C=document.getElementById('c'),X=C.getContext('2d');
function resize(){C.width=screen.width;C.height=screen.height;initParticles();}
function initParticles(){
  particles=[];const n=Math.min(760,Math.max(420,Math.floor(C.width*C.height/2800)));
  for(let i=0;i<n;i++){particles.push({a:Math.random()*Math.PI*2,r:0.08+Math.random()*0.38,v:0.0003+Math.random()*0.0015,s:0.4+Math.random()*1.8});}
}
function drawCover(){
  if(!coverImg||!S.cover)return;
  X.save();X.globalAlpha=0.16;X.filter='blur(48px)';
  const cw=C.width*1.4,ch=C.height*1.4;
  X.drawImage(coverImg,(C.width-cw)/2,(C.height-ch)/2,cw,ch);
  X.globalAlpha=0.20;X.filter='blur(12px)';
  const sw=C.height*0.7,sh=C.height*0.7;
  X.drawImage(coverImg,(C.width-sw)/2,(C.height-sh)/2,sw,sh);
  X.restore();
}
function draw(){
  if(!S.enabled){raf=requestAnimationFrame(draw);return;}
  const w=C.width,h=C.cw=C.width,hh=C.height;
  const col=S.colors||{};
  const pr=col.primary||'#1a1a2e',se=col.secondary||'#16213e',hi=col.highlight||'#e94560',gl=col.glow||'#0f3460';
  X.globalAlpha=S.opacity||1;
  const g=X.createRadialGradient(w*0.5,h*0.5,0,w*0.5,h*0.5,w*0.7);
  g.addColorStop(0,pr);g.addColorStop(0.6,se);g.addColorStop(1,'#050608');
  X.fillStyle=g;X.fillRect(0,0,w,h);
  drawCover();
  const now=performance.now(),speed=S.playing?1.8:0.4;
  for(const p of particles){
    p.a+=p.v*speed;
    const x=w/2+Math.cos(p.a)*p.r*w;
    const y=h/2+Math.sin(p.a)*p.r*h;
    X.beginPath();X.arc(x,y,p.s,0,Math.PI*2);
    const t=(Math.sin(now*0.001+p.a)+1)/2;
    X.fillStyle=t>0.5?hi:gl;X.globalAlpha=(0.15+t*0.35)*(S.opacity||1);
    X.fill();
  }
  X.globalAlpha=0.06*(S.opacity||1);
  const ag=X.createRadialGradient(w*0.5,h*0.5,0,w*0.5,h*0.5,w*0.35);
  ag.addColorStop(0,hi);ag.addColorStop(1,'transparent');
  X.fillStyle=ag;X.fillRect(0,0,w,h);
  raf=requestAnimationFrame(draw);
}
function loadCover(url){
  if(!url){coverImg=null;return;}
  const img=new Image();img.crossOrigin='anonymous';
  img.onload=()=>{coverImg=img;};img.onerror=()=>{coverImg=null;};
  img.src=url;
}
async function poll(){
  try{const r=await fetch('/api/wallpaper-state');if(r.ok){const d=await r.json();S=d;if(d.cover&&d.cover!==(S._lastCover||'')){S._lastCover=d.cover;loadCover(d.cover);}}}catch(e){}
  setTimeout(poll,120);
}
window.addEventListener('resize',resize);
resize();initParticles();poll();draw();
</script></body></html>`;
}

function createWallpaperWindow() {
  if (wallpaperWindow) return;
  wallpaperWindow = new BrowserWindow({
    title: "Mineradio Wallpaper",
    url: "about:blank",
    frame: { x: 0, y: 0, width: 1920, height: 1080 },
    titleBarStyle: "hidden",
    transparent: false,
    hidden: false,
  });
  wallpaperWindow.setAlwaysOnTop(true);
  (globalThis as any).__wallpaperWindow = wallpaperWindow;
  wallpaperWindow.on("close", () => { wallpaperWindow = null; });
}

function destroyWallpaperWindow() {
  if (wallpaperWindow) {
    wallpaperWindow.close();
    wallpaperWindow = null;
  }
}

// Expose overlay state getter/setter for HTTP endpoints
(globalThis as any).__getOverlayState = () => overlayState;
(globalThis as any).__setOverlayState = (patch: any) => {
  Object.assign(overlayState, patch);
  if (patch.enabled && !overlayWindow) createOverlayWindow();
  if (!patch.enabled && overlayWindow) destroyOverlayWindow();
};

// Expose wallpaper state getter/setter for HTTP endpoints
(globalThis as any).__getWallpaperState = () => wallpaperState;
(globalThis as any).__setWallpaperState = (patch: any) => {
  Object.assign(wallpaperState, patch);
  if (patch.enabled && !wallpaperWindow) createWallpaperWindow();
  if (!patch.enabled && wallpaperWindow) destroyWallpaperWindow();
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
