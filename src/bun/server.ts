import * as fs from "fs";
import * as path from "path";
import { MusicProvider } from "./providers";
import { createRPCHandler } from "./routes/rpc";
import { createLegacyAPIHandler } from "./routes/legacy";

const HOST = process.env.HOST || "0.0.0.0";
const PORT = parseInt(process.env.PORT || "3001");

// ---- File serving ----
function resolveDistDir(): string {
  const candidates = [
    path.resolve(import.meta.dir, "../../dist"),
    path.resolve(import.meta.dir, "../views/mainview"),
    path.resolve(process.cwd(), "dist"),
  ];
  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, "index.html"))) return dir;
  }
  return candidates[0];
}
function resolvePublicDir(): string {
  const candidates = [
    path.resolve(import.meta.dir, "../../public"),
    path.resolve(import.meta.dir, "../views"),
    path.resolve(process.cwd(), "public"),
  ];
  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, "vendor"))) return dir;
  }
  return candidates[0];
}

const DIST_DIR = process.env.DIST_DIR || resolveDistDir();
const PUBLIC_DIR = process.env.PUBLIC_DIR || resolvePublicDir();
const COOKIE_FILE = process.env.COOKIE_FILE || path.join(process.cwd(), ".cookie");
const QQ_COOKIE_FILE = process.env.QQ_COOKIE_FILE || path.join(process.cwd(), ".qq-cookie");

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".bin": "application/octet-stream",
};

function serveFile(resolvedPath: string): Response {
  const ext = path.extname(resolvedPath);
  try {
    const data = fs.readFileSync(resolvedPath);
    return new Response(data as any, {
      headers: { "Content-Type": MIME[ext] || "application/octet-stream" },
    });
  } catch {
    return new Response("Not Found", { status: 404 });
  }
}

function json(data: any, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}

// ---- Cookie persistence ----
function loadCookie(file: string): string {
  try { return fs.readFileSync(file, "utf8").trim(); } catch { return ""; }
}
function saveCookieToFile(c: string, file: string) {
  try { fs.writeFileSync(file, c.trim()); } catch {}
}

// ---- Init providers ----
let userCookie = loadCookie(COOKIE_FILE);
let qqCookie = loadCookie(QQ_COOKIE_FILE);

const providers = new MusicProvider();
providers.init(
  userCookie,
  qqCookie,
  (c: string) => { userCookie = c; saveCookieToFile(c, COOKIE_FILE); },
  (c: string) => { qqCookie = c; saveCookieToFile(c, QQ_COOKIE_FILE); },
);

// ---- Create handlers ----
const handleRPC = createRPCHandler(providers);
const handleLegacyAPI = createLegacyAPIHandler(providers);

// ---- Helper: refresh userCookie from providers in case external code mutated it ----
function syncCookies() {
  providers.setCookie(userCookie);
  providers.setQQCookie(qqCookie);
}

// ---- Server ----
let serverPort: number = PORT;

export async function startCombinedServer() {
  const server = Bun.serve({
    hostname: HOST,
    port: PORT,
    async fetch(req) {
      syncCookies();
      const url = new URL(req.url);
      const pathname = url.pathname;

      // CORS preflight
      if (req.method === "OPTIONS") {
        return new Response(null, {
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
          },
        });
      }

      // Health check
      if (pathname === "/api/health") {
        return json({ ok: true, port: serverPort });
      }

      // Desktop lyrics overlay state
      if (pathname === "/api/desktop-lyrics-state") {
        const state = (globalThis as any).__getOverlayState?.() || { enabled: false };
        return json(state);
      }
      if (pathname === "/api/desktop-lyrics-update" && req.method === "POST") {
        try {
          const patch = await req.json();
          (globalThis as any).__setOverlayState?.(patch);
          return json({ ok: true });
        } catch {
          return json({ error: "invalid body" }, 400);
        }
      }

      // RPC
      if (pathname === "/api/rpc" && req.method === "POST") {
        const body = await req.json();
        return handleRPC(body);
      }

      // Image proxy: /api/proxy-image?url=... — fetches remote images and returns with CORS headers
      if (pathname === "/api/proxy-image") {
        const imageUrl = url.searchParams.get("url") || "";
        if (!imageUrl) return new Response("Missing url param", { status: 400 });
        try {
          const resp = await fetch(imageUrl);
          if (!resp.ok) return new Response("Image fetch failed", { status: resp.status });
          const buffer = await resp.arrayBuffer();
          const contentType = resp.headers.get("content-type") || "image/jpeg";
          return new Response(buffer, {
            headers: {
              "Content-Type": contentType,
              "Access-Control-Allow-Origin": "*",
              "Cache-Control": "public, max-age=86400",
            },
          });
        } catch (err) {
          console.warn("Image proxy error:", err);
          return new Response("Proxy error", { status: 502 });
        }
      }

      // Legacy API
      if (pathname.startsWith("/api/")) {
        return handleLegacyAPI(req, url);
      }

      // Static files: dist/
      const distPath = path.join(DIST_DIR, pathname === "/" ? "index.html" : pathname);
      if (fs.existsSync(distPath) && fs.statSync(distPath).isFile()) {
        return serveFile(distPath);
      }

      // Static files: public/
      const publicPath = path.join(PUBLIC_DIR, pathname === "/" ? "index.html" : pathname);
      if (fs.existsSync(publicPath) && fs.statSync(publicPath).isFile()) {
        return serveFile(publicPath);
      }

      // SPA fallback
      const spaPath = path.join(DIST_DIR, "index.html");
      if (fs.existsSync(spaPath)) {
        return serveFile(spaPath);
      }

      return new Response("Not Found", { status: 404 });
    },
  });

  serverPort = server.port as number;
  console.log(`[Mineradio] Combined server on http://${HOST}:${serverPort}`);
}

export function getPort(): number {
  return serverPort;
}
