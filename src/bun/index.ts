import { BrowserWindow, ApplicationMenu } from "electrobun/bun";
import { startCombinedServer, getPort } from "./server";

// Start the combined HTTP server (serves both API and built frontend files)
await startCombinedServer();
const port = getPort();
const url = `http://127.0.0.1:${port}`;

const isHidden = process.env.HIDDEN === "1";

console.log(`[Mineradio] App URL: ${url}`);

// Dev server check for HMR
const DEV_SERVER_PORT = 5173;
try {
  await fetch(`http://localhost:${DEV_SERVER_PORT}`, { method: "HEAD" });
  // Vite dev server is running - use it for HMR
  const devUrl = `http://localhost:${DEV_SERVER_PORT}?apiPort=${port}`;
  console.log(`[Mineradio] HMR enabled: ${devUrl}`);

  const devMainWindow = new BrowserWindow({
    title: "Mineradio",
    url: devUrl,
    frame: {
      x: 0,
      y: 0,
      width: 1280,
      height: 800,
    },
    titleBarStyle: "hidden",
    hidden: isHidden,
  });

  // Keep reference to avoid GC
  (globalThis as any).__mainWindow = devMainWindow;
} catch {
  // Vite dev server not running - use bundled frontend
  const mainWindow = new BrowserWindow({
    title: "Mineradio",
    url,
    frame: {
      x: 0,
      y: 0,
      width: 1280,
      height: 800,
    },
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
