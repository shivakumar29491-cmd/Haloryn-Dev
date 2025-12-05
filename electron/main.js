// =====================================================
// Haloryn — main.js (Recorder + Whisper + Chat + Doc QA + Live Companion)
// Phase 5.11–5.15 updates included + Brave API wiring
// =====================================================
/*
  © 2025 iMSK Consultants LLC — Haloryn AI
  All Rights Reserved.
*/

// =====================================================
// IMPORTS + ENV SETUP (CLEAN + NO DUPLICATES)
// =====================================================

const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");
const dotenv = require("dotenv");
const crypto = require("crypto");

// Try multiple .env locations so packaged builds still pick up secrets
const envPaths = [];
if (process.resourcesPath) envPaths.push(path.join(process.resourcesPath, ".env"));
envPaths.push(path.join(__dirname, ".env"), path.join(__dirname, "..", ".env"));

for (const envPath of envPaths) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath, override: true });
    break;
  }
}
console.log(">>> USING THIS MAIN.JS <<<");

const {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  globalShortcut,
  clipboard,
  Tray,
  nativeImage,
  screen,
  desktopCapturer
} = require("electron");
require("./ipc/licenseIPC");

global.IS_PACKAGED = app.isPackaged;

// Minimal debug logger guard (no console output by default).
const debugLog = () => {};

function safeChdir(dir) {
  try {
    if (fs.existsSync(dir) && fs.lstatSync(dir).isDirectory()) {
      process.chdir(dir);
    }
  } catch (err) {
    // Ignore ENOTDIR when running from asar; paths will be resolved explicitly.
    console.warn(`Skipping chdir to ${dir}: ${err.message}`);
  }
}

const SCREEN_REGION_FILE = path.join(app.getPath("userData"), "screen-region.enc");
const SCREEN_REGION_KEY = crypto
  .createHash("sha256")
  .update(process.env.SCREEN_REGION_SECRET || "haloryn-screen-read")
  .digest();

function encryptRegion(region) {
  const json = JSON.stringify(region || {});
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", SCREEN_REGION_KEY, iv);
  const payload = Buffer.concat([cipher.update(json, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, payload]).toString("base64");
}

function decryptRegion(blob) {
  try {
    const buf = Buffer.from(blob || "", "base64");
    if (buf.length < 28) return null;
    const iv = buf.slice(0, 12);
    const tag = buf.slice(12, 28);
    const data = buf.slice(28);
    const decipher = crypto.createDecipheriv("aes-256-gcm", SCREEN_REGION_KEY, iv);
    decipher.setAuthTag(tag);
    const json = decipher.update(data, undefined, "utf8") + decipher.final("utf8");
    return JSON.parse(json);
  } catch (err) {
    console.warn("[screenread] decrypt failed:", err.message);
    return null;
  }
}

function loadStoredRegion() {
  try {
    if (!fs.existsSync(SCREEN_REGION_FILE)) return null;
    const raw = fs.readFileSync(SCREEN_REGION_FILE, "utf8");
    return decryptRegion(raw);
  } catch (err) {
    console.warn("[screenread] load failed:", err.message);
    return null;
  }
}

function persistRegion(region) {
  try {
    if (!region) return false;
    const dir = path.dirname(SCREEN_REGION_FILE);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(SCREEN_REGION_FILE, encryptRegion(region), "utf8");
    return true;
  } catch (err) {
    console.warn("[screenread] save failed:", err.message);
    return false;
  }
}

ipcMain.handle("screenread:get-region", () => {
  return { ok: true, region: loadStoredRegion() };
});

ipcMain.handle("screenread:save-region", (_e, region) => {
  if (!region || typeof region.x !== "number") {
    return { ok: false, error: "invalid region" };
  }
  return { ok: persistRegion(region) };
});

ipcMain.handle("screenread:launch-app", (_e, command) => {
  if (!command) return { ok: false, error: "missing command" };
  try {
    const child = exec(command, { windowsHide: true });
    child.unref?.();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

/* [SNIP OVERLAY DISABLED -- original implementation retained for reference]
let screenOverlayWindow = null;
let screenOverlayPending = null;

function finalizeScreenOverlay(result) {
  if (!screenOverlayPending) return;
  const resolver = screenOverlayPending.resolve;
  screenOverlayPending = null;
  if (resolver) resolver(result);
}
const sharp = require("sharp");

async function normalizeMacImage(base64) {
  const buffer = Buffer.from(base64, "base64");

  // Get metadata
  const meta = await sharp(buffer).metadata();

  // macOS Retina = usually density 144 → scale down by 0.5
  const scale = meta.density && meta.density > 110 ? 0.5 : 1;

  return sharp(buffer)
    .resize({
      width: Math.round(meta.width * scale),
      height: Math.round(meta.height * scale)
    })
    .png()
    .toBuffer();
}

ipcMain.on("screenread:selection", (_event, region) => {
  console.log("[screenread] selection received", region);
  finalizeScreenOverlay({ ok: true, region });
});

ipcMain.on("screenread:selection-cancel", () => {
  console.log("[screenread] selection canceled");
  finalizeScreenOverlay({ ok: false, error: "canceled" });
});
ipcMain.handle("window:await-minimized", async () => {
  return new Promise(resolve => {
    if (mainWindow.isMinimized()) return resolve(true);
    mainWindow.once("minimize", () => resolve(true));
  });
});

ipcMain.handle("screenread:open-overlay", async (_event, initialRegion) => {
  if (screenOverlayPending) {
    return { ok: false, error: "overlay busy" };
  }

  const target = BrowserWindow.getFocusedWindow() || win;
  const anchorBounds = target && !target.isDestroyed() ? target.getBounds() : { x: 0, y: 0 };
  const display =
    screen.getDisplayNearestPoint({ x: anchorBounds.x, y: anchorBounds.y }) || screen.getPrimaryDisplay();

  console.log("[screenread] overlay request", { displayId: display?.id, initialRegion });

  screenOverlayWindow = new BrowserWindow({
  x: display.bounds.x,
  y: display.bounds.y,
  width: display.bounds.width,
  height: display.bounds.height,
  frame: false,
  transparent: true,
  backgroundColor: '#00000000',
  hasShadow: false,
  resizable: false,
  movable: false,
  fullscreenable: false,
  skipTaskbar: true,
  alwaysOnTop: true,
  focusable: true,
  vibrancy: null,
  visualEffectState: 'inactive',
  webPreferences: {
    nodeIntegration: true,
    contextIsolation: false,
    backgroundThrottling: false
  }
});

  screenOverlayWindow.setMenuBarVisibility(false);
  screenOverlayWindow.setAlwaysOnTop(true, "screen-saver");

  screenOverlayPending = {
    resolve: null
  };

  const promise = new Promise((resolve) => {
    screenOverlayPending.resolve = resolve;
  });

  screenOverlayWindow.on("closed", () => {
    screenOverlayWindow = null;
    if (screenOverlayPending) {
      const closeResolver = screenOverlayPending.resolve;
      screenOverlayPending = null;
      if (closeResolver) closeResolver({ ok: false, error: "overlay closed" });
    }
  });

  await screenOverlayWindow.loadFile(path.join(__dirname, "snipOverlay.html"));

  screenOverlayWindow.once("ready-to-show", () => {
    if (screenOverlayWindow) {
      screenOverlayWindow.show();
      screenOverlayWindow.focus();
    }
  });

  return promise;
});
*/

// [REGION TOOL OVERLAY] replaces the legacy snip overlay implementation
let regionToolWindow = null;
let regionToolPending = null;
let regionToolDisplayBounds = null;
let regionToolInitialRegion = null;

function cleanupRegionTool(payload) {
  if (regionToolPending) {
    const resolve = regionToolPending;
    regionToolPending = null;
    try {
      resolve(payload);
    } catch (err) {
      console.warn("[screenread] region tool resolver failed", err);
    }
  }

  regionToolInitialRegion = null;
  regionToolDisplayBounds = null;

  const overlay = regionToolWindow;
  regionToolWindow = null;

  if (overlay && !overlay.isDestroyed()) {
    overlay.removeAllListeners("closed");
    try {
      overlay.close();
    } catch {}
  }
}

function sendRegionToolInit() {
  if (!regionToolWindow || regionToolWindow.isDestroyed()) return;
  regionToolWindow.webContents.send("region-tool:init", {
    displayBounds: regionToolDisplayBounds,
    initialRegion: regionToolInitialRegion
  });
}

ipcMain.on("region-tool:ready", (event) => {
  if (!regionToolWindow || event.sender !== regionToolWindow.webContents) return;
  sendRegionToolInit();
});

ipcMain.on("region-tool:confirm", (_event, region) => {
  if (
    !region ||
    typeof region.x !== "number" ||
    typeof region.y !== "number" ||
    region.width < 4 ||
    region.height < 4
  ) {
    cleanupRegionTool({ ok: false, error: "invalid region" });
    return;
  }

  const offsetX = regionToolDisplayBounds?.x || 0;
  const offsetY = regionToolDisplayBounds?.y || 0;
  const normalized = {
    x: Math.round(region.x + offsetX),
    y: Math.round(region.y + offsetY),
    width: Math.round(region.width),
    height: Math.round(region.height)
  };

  cleanupRegionTool({ ok: true, region: normalized });
});

ipcMain.on("region-tool:cancel", () => {
  cleanupRegionTool({ ok: false, error: "canceled" });
});

ipcMain.handle("screenread:open-overlay", async (_event, initialRegion) => {
  if (regionToolPending) {
    return { ok: false, error: "overlay busy" };
  }

  const target = BrowserWindow.getFocusedWindow() || win;
  const anchorBounds =
    target && !target.isDestroyed() ? target.getBounds() : { x: 0, y: 0 };
  const display =
    screen.getDisplayNearestPoint({
      x: anchorBounds.x,
      y: anchorBounds.y
    }) || screen.getPrimaryDisplay();

  regionToolDisplayBounds = display?.bounds || { x: 0, y: 0, width: 0, height: 0 };
  regionToolInitialRegion = initialRegion || null;

  regionToolWindow = new BrowserWindow({
    x: regionToolDisplayBounds.x,
    y: regionToolDisplayBounds.y,
    width: regionToolDisplayBounds.width,
    height: regionToolDisplayBounds.height,
    frame: false,
    transparent: true,
    backgroundColor: "#00000000",
    hasShadow: false,
    resizable: false,
    movable: false,
    focusable: true,
    skipTaskbar: true,
    fullscreenable: false,
    alwaysOnTop: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "renderer/regionToolPreload.js"),
      contextIsolation: true
    }
  });

  regionToolWindow.setAlwaysOnTop(true, "screen-saver");
  regionToolWindow.setVisibleOnAllWorkspaces(true);

  const promise = new Promise((resolve) => {
    regionToolPending = resolve;
  });

  regionToolWindow.on("closed", () => {
    cleanupRegionTool({ ok: false, error: "overlay closed" });
  });

  await regionToolWindow.loadFile(path.join(__dirname, "renderer/regionTool.html"));
  regionToolWindow.showInactive();

  return promise;
});

const sharp = require("sharp");

async function normalizeMacImage(base64) {
  const buffer = Buffer.from(base64, "base64");
  const meta = await sharp(buffer).metadata();
  const scale = meta.density && meta.density > 110 ? 0.5 : 1;
  return sharp(buffer)
    .resize({
      width: Math.round(meta.width * scale),
      height: Math.round(meta.height * scale)
    })
    .png()
    .toBuffer();
}

//safeChdir(__dirname);

const { spawn, exec } = require("child_process");
const os = require("os");
const fetch = require("node-fetch");
const cheerio = require("cheerio");
let pdfParse = null;
const http = require("http");
const IS_DEV = !app.isPackaged;


//const { triggerSnip } = require("./triggerSnip");

// Groq Engines
const { groqWhisperTranscribe, groqFastAnswer } = require("./groqEngine");
const { unifiedAsk } = require("./unifiedAsk");

// Haloryn backend
const backend = require("./api/index.js");
const { router: smartSearch } = backend.search;
const { providerSelector: getProviderStats } = backend.utils;
const { braveApi: BraveApi } = backend.search;

//const { initScreenReader } = require("./screenReader");

let lastSessionSummary = null;
let isSessionActive = false;

// Icon paths and session/tray helpers
const halorynIconPath = path.join(__dirname, "icons", "haloryn-256.png");
const trayIconPath = path.join(__dirname, "icons", "haloryn-32.png");
const incognitoHotkey = "CommandOrControl+Shift+I";
const userDataPath = path.join(os.tmpdir(), "haloryn-user");
const historyPath = path.join(userDataPath, "activityHistory.json");
const userDataFile = path.join(userDataPath, "userData.json");
const cachePath = path.join(userDataPath, "Cache");
const sessionPath = path.join(userDataPath, "session.json");

const HISTORY_ANON_OWNER = "__anon__";
let currentHistoryOwner = HISTORY_ANON_OWNER;

function determineHistoryOwner(session = {}) {
  if (!session || typeof session !== "object") return null;
  if (session.ownerId) return session.ownerId;
  if (session.email) return String(session.email).trim().toLowerCase();
  if (session.phone) return String(session.phone).trim();
  if (session.provider) return `provider:${session.provider}`;
  return null;
}

function setHistoryOwnerFromSession(session = {}) {
  const ownerId = determineHistoryOwner(session);
  currentHistoryOwner = ownerId || HISTORY_ANON_OWNER;
  return currentHistoryOwner;
}

function readSavedSession() {
  try {
    const raw = fs.readFileSync(sessionPath, "utf8");
    return JSON.parse(raw || "{}");
  } catch {
    return {};
  }
}

setHistoryOwnerFromSession(readSavedSession());

let tray = null;
let incognitoOn = false;
let answerStreamSeq = 0;

// Optional local fast transcription service (e.g., faster-whisper).
// If FAST_TRANSCRIBE_URL is set and returns text, we skip slower paths.
async function tryFastLocalTranscribe(filePath) {
  const url = process.env.FAST_TRANSCRIBE_URL || "http://127.0.0.1:8877/transcribe";
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file: filePath })
    });

    if (!res.ok) return null;
    const json = await res.json();
    const text = json?.text || json?.transcript || "";
    return String(text).trim() || null;
  } catch (err) {
    debugLog?.("[fast-transcribe] skipped:", err.message);
    return null;
  }
}


process.env.PATH = [
  'C:\\Program Files\\sox',
  'C:\\Program Files (x86)\\sox-14-4-2',
  process.env.PATH || ''
].join(';');
/*
  © 2025 iMSK Consultants LLC — Haloryn AI
  All Rights Reserved.
*/
let mainWindow;
const rendererRoot = path.join(__dirname, "renderer");
let rendererServerPort = null;

function readActivityHistory() {
  try {
    const parsed = JSON.parse(fs.readFileSync(historyPath, "utf8") || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item) => ({
      owner: item?.owner || HISTORY_ANON_OWNER,
      ...item
    }));
  } catch {
    return [];
  }
}

function appendActivityHistory(entry) {
  try {
    const owner = currentHistoryOwner || HISTORY_ANON_OWNER;
    const history = readActivityHistory();
    const record = { owner, ...entry };
    history.unshift(record);
    const trimmed = history.slice(0, 100);
    fs.mkdirSync(userDataPath, { recursive: true });
    fs.writeFileSync(historyPath, JSON.stringify(trimmed, null, 2));
  } catch (e) {
    console.warn("[history] write failed", e?.message);
  }
}

function readUserDataFile() {
  try {
    return JSON.parse(fs.readFileSync(userDataFile, "utf8"));
  } catch {
    return {};
  }
}

function writeUserDataFile(payload) {
  try {
    fs.mkdirSync(userDataPath, { recursive: true });
    fs.writeFileSync(userDataFile, JSON.stringify(payload, null, 2));
  } catch (err) {
    console.warn("[userData] write failed:", err?.message);
  }
}

function getSavedLocation() {
  const data = readUserDataFile();
  return data?.location || null;
}

function persistLocation(location) {
  if (!location || typeof location !== "object") return null;
  const data = readUserDataFile();
  data.location = { ...location, savedAt: Date.now() };
  writeUserDataFile(data);
  return data.location;
}

async function fetchIpLocation() {
  try {
    const res = await fetch("https://ipapi.co/json/");
    if (!res.ok) return null;
    const json = await res.json();
    if (!json) return null;
    const loc = {
      city: json.city,
      region: json.region,
      country: json.country_name,
      lat: json.latitude || json.lat,
      lon: json.longitude || json.lon,
      label: [json.city, json.region, json.country_name].filter(Boolean).join(", "),
      source: "ip"
    };
    return loc;
  } catch (err) {
    console.warn("[location:ip] lookup failed:", err?.message);
    return null;
  }
}

// Force Electron to use a writable temp directory and avoid disk cache errors
try { fs.mkdirSync(cachePath, { recursive: true }); } catch {}
try { app.setPath("userData", userDataPath); } catch {}
try { app.setPath("cache", cachePath); } catch {}
try { app.commandLine.appendSwitch("disk-cache-dir", cachePath); } catch {}
try { app.commandLine.appendSwitch("disable-http-cache"); } catch {}
try { app.commandLine.appendSwitch("disable-gpu"); } catch {}
try { app.commandLine.appendSwitch("disable-gpu-compositing"); } catch {}


function persistUserSession(data = {}, options = {}) {
  const { replace = false } = options;
  const base = replace ? {} : readSavedSession();
  const merged = { ...base, ...data };
  const ownerId = determineHistoryOwner(merged);
  if (ownerId) {
    merged.ownerId = ownerId;
  }
  try {
    fs.mkdirSync(userDataPath, { recursive: true });
    fs.writeFileSync(sessionPath, JSON.stringify(merged, null, 2));
  } catch (err) {
    console.error("[session] save failed:", err?.message);
  }
  setHistoryOwnerFromSession(merged);
  return merged;
}

ipcMain.handle("save-user-session", (_event, data) => {
  persistUserSession(data);
  return { ok: true };
});

ipcMain.handle("get-user-session", () => {
  return readSavedSession();
});
ipcMain.handle("nav:loadLocalFile", async (_e, file) => {
    try {
        const fullPath = path.join(__dirname, file);
        if (mainWindow && !mainWindow.isDestroyed()) {
            await mainWindow.loadFile(fullPath);
        }
    } catch (err) {
        console.error("[NAV ERROR]", err);
    }
});

ipcMain.handle("location:get", async () => {
  return { ok: true, location: getSavedLocation() };
});

ipcMain.handle("location:set", async (_e, location) => {
  const saved = persistLocation(location);
  if (saved) return { ok: true, location: saved };
  return { ok: false, error: "invalid location" };
});

ipcMain.handle("location:request-ip", async () => {
  const loc = await fetchIpLocation();
  if (!loc) return { ok: false, error: "ip lookup failed" };
  const saved = persistLocation(loc);
  return { ok: true, location: saved || loc };
});

ipcMain.handle("load-activity", async () => {
  try {
    if (win && !win.isDestroyed()) {
      await win.loadFile(path.join(__dirname, "activityRoot.html"));
      return true;
    }
    return false;
  } catch (err) {
    console.error("load-activity failed:", err);
    return false;
  }
});


// ---------------- Window ----------------
let win;


function send(ch, payload) {
  if (win && !win.isDestroyed()) {
    try { win.webContents.send(ch, payload); } catch {}
  }
}
app.setAppUserModelId("Haloryn");
safeChdir(__dirname);

function startRendererServer() {
  if (rendererServerPort) return Promise.resolve(rendererServerPort);

  const mimeTypes = {
    ".html": "text/html",
    ".js": "application/javascript",
    ".css": "text/css",
    ".json": "application/json",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".svg": "image/svg+xml"
  };

  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const urlPath = (req.url || "").split("?")[0] || "/";
      const requestPath = urlPath === "/" ? "/login.html" : urlPath;

      // Route /auth/* to electron/auth, /icons/* to electron/icons, otherwise renderer root
      let baseRoot = rendererRoot;
      let subPath = requestPath.replace(/^\/+/, ""); // strip leading slashes
      if (subPath.startsWith("auth/")) {
        baseRoot = path.join(__dirname, "auth");
        subPath = subPath.slice("auth/".length);
      } else if (subPath.startsWith("icons/")) {
        baseRoot = path.join(__dirname, "icons");
        subPath = subPath.slice("icons/".length);
      }

      const filePath = path.normalize(path.join(baseRoot, subPath));

      if (!filePath.startsWith(baseRoot)) {
        res.writeHead(403);
        return res.end("Forbidden");
      }

      fs.readFile(filePath, (err, data) => {
        if (err) {
          res.writeHead(404);
          return res.end("Not found");
        }
        const mime = mimeTypes[path.extname(filePath).toLowerCase()] || "application/octet-stream";
        res.setHeader("Content-Type", mime);
        res.end(data);
      });
    });

    server.listen(0, "127.0.0.1", () => {
      rendererServerPort = server.address().port;
      resolve(rendererServerPort);
    });
  });
}

function ensureTray() {
  if (incognitoOn) return;
  if (tray && !tray.isDestroyed?.()) return tray;
  try {
    const icon = nativeImage.createFromPath(trayIconPath);
    tray = new Tray(icon);
    tray.setToolTip("Haloryn");
    tray.on("click", () => {
      if (win && !win.isDestroyed()) {
        win.show();
        win.focus();
      }
    });
    return tray;
  } catch (e) {
    console.warn("[tray] failed to init", e);
    tray = null;
    return null;
  }
}

function clearTray() {
  try { tray?.destroy(); } catch {}
  tray = null;
}

function applyIncognito(flag) {
  incognitoOn = !!flag;
  if (win && !win.isDestroyed()) {
    try { win.setContentProtection(incognitoOn); } catch {}
    try { win.setAlwaysOnTop(incognitoOn, "screen-saver"); } catch {}
    try { win.setVisibleOnAllWorkspaces(true); } catch {}

    if (incognitoOn) {
      try { win.setSkipTaskbar(true); } catch {}
      try { win.hide(); } catch {}
      // Show without re-adding to taskbar (best effort on Windows)
      setTimeout(() => {
        try { win.showInactive(); } catch {}
      }, 100);
    } else {
      try { win.setSkipTaskbar(false); } catch {}
      try { win.setAlwaysOnTop(false); } catch {}
      try { win.setVisibleOnAllWorkspaces(false); } catch {}
      try { win.show(); win.focus(); } catch {}
    }
  }

  if (incognitoOn) {
    clearTray();
    try { globalShortcut.register(incognitoHotkey, () => applyIncognito(false)); } catch {}
  } else {
    try { globalShortcut.unregister(incognitoHotkey); } catch {}
    ensureTray();
    if (win && !win.isDestroyed()) {
      try { win.setSkipTaskbar(false); } catch {}
      try { win.setContentProtection(false); } catch {}
    }
  }
  return incognitoOn;
}


async function createWindow() {
  mainWindow = new BrowserWindow({
    center: true,
    width: 1200,
    height: 900,
    minWidth: 1100,
    minHeight: 780,
    transparent: true,
    backgroundColor: "#00000000",
    frame: false,
    titleBarStyle: "hiddenInset",
    crossOriginOpenerPolicy: null,
    crossOriginEmbedderPolicy: false,
    icon: halorynIconPath,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      nativeWindowOpen: true,
      sandbox: false
    }
  });

  mainWindow.setMovable(false);

  win = mainWindow;
ensureTray();
applyIncognito(false);
// ==========================================
  // PHASE 14 — SUBSCRIPTION CHECK (SAFE INSERT)
  // ==========================================
  const ENABLE_SUBSCRIPTIONS = process.env.ENABLE_SUBSCRIPTIONS === "true";
  const savedSession = readSavedSession();
  setHistoryOwnerFromSession(savedSession);

  if (ENABLE_SUBSCRIPTIONS && process.env.NODE_ENV !== "development") {
    try {
      const { checkLicense } = require("./license/licenseManager");
      const status = await checkLicense();

      // If NO trial, NO license, or EXPIRED trial → go to activation screen
      if (!status.valid) {
        return mainWindow.loadFile(path.join(__dirname, "licensePopup.html"));
      }
  } catch (err) {
    console.error("[Subscription Check Error]", err);
    return mainWindow.loadFile(path.join(__dirname, "licensePopup.html"));
  }
}

  if (savedSession?.verified) {
    mainWindow.loadFile(path.join(__dirname, "activityRoot.html"));
    return;
  }

  // Always land on login; app navigation happens after explicit login or test bypass
  const port = await startRendererServer();
  mainWindow.loadURL(`http://127.0.0.1:${port}/login.html`);
}




// --- Web search engines (Brave wrapper) ---
let braveSearch = null;

function initSearchEngines() {
  try {
    braveSearch = new BraveApi({
      log: (msg) => send('log', `[Brave] ${msg}`)
    });
    send('log', '[Brave] search engine initialized.');
  } catch (e) {
    send('log', `[Brave:init:error] ${e.message}`);
  }
}


app.whenReady().then(() => {
  initSearchEngines(); // NEW: wire Brave on boot
  createWindow();
  try {
    globalShortcut.register('CommandOrControl+Shift+Space', () => {
      if (!win) return;
      win.isVisible() ? win.hide() : win.show();
    });
  } catch {}
});
app.on('will-quit', () => { try { globalShortcut.unregisterAll(); } catch {} });
app.on('window-all-closed', () => app.quit());

// ---------------- Whisper (tuned for speed) ----------------
const WHISPER_BIN     = process.env.WHISPER_BIN     || 'C:\\dev\\whisper.cpp\\build\\bin\\Release\\whisper-cli.exe';
const WHISPER_MODEL   = process.env.WHISPER_MODEL   || 'C:\\dev\\whisper.cpp\\models\\ggml-tiny.en.bin'; // fastest sensible default
// Fewer threads by default to reduce CPU spikes on live/companion
const WHISPER_THREADS = Number(process.env.WHISPER_THREADS || 2);
const RECENT_TRANSCRIPT_LINES = 10;
const WHISPER_NGL     = String(process.env.WHISPER_NGL || '0'); // GPU offload layers if compiled (e.g. "20")
const LANG            = process.env.WHISPER_LANG || 'en';

async function runWhisper(filePath){
  const fastText = await tryFastLocalTranscribe(filePath);
  if (fastText) return fastText;

  return new Promise((resolve, reject) => {
    try{
      if (!fs.existsSync(filePath)) return reject(new Error('audio not found'));
      const st = fs.statSync(filePath);
      if (!st || st.size < 2000) { send('log','[whisper] skipped empty/small chunk'); return resolve(''); }
      const outTxt = `${filePath}.txt`;
      try { if (fs.existsSync(outTxt)) fs.unlinkSync(outTxt); } catch {}

      const args = [
        '-m', WHISPER_MODEL,
        '-f', filePath,
        '-otxt',
        '-l', LANG,
        '-t', String(WHISPER_THREADS)
      ];
      if (Number(WHISPER_NGL) > 0) {
        args.push('-ngl', String(WHISPER_NGL));
      }

      send('log', `[spawn] ${WHISPER_BIN}\n[args] ${args.join(' ')}`);
      const child = spawn(WHISPER_BIN, args, { windowsHide:true });
      child.stdout.on('data', d => send('log', d.toString()));
      let _stderr='';
      child.stderr.on('data', d => {
        const s = d.toString();
        _stderr += s;
        // Drop noisy timing/blank markers from UI log to reduce spam
        if (!/BLANK_AUDIO/i.test(s) && !/whisper_print_timings/i.test(s) && !/output_txt:/i.test(s)) {
          send('log', `[stderr] ${s}`);
        }
      });
      child.on('close', () => {
        try {
          if (/\b(usage:|Voice Activity Detection|options:)\b/i.test(_stderr)) {
            send('log','[whisper] usage/help detected — treating as empty');
            return resolve('');
          }
          const raw = fs.existsSync(outTxt) ? fs.readFileSync(outTxt, 'utf8').trim() : '';
          const cleaned = raw
            .split(/\r?\n+/)
            .map(s => s.trim())
            .filter(s => s && !/BLANK_AUDIO/i.test(s) && !/^\[\d{2}:\d{2}/.test(s))
            .join('\n');
          resolve(cleaned);
        } catch(e){ reject(e); }
      });
      child.on('error', reject);
    }catch(e){ reject(e); }
  });
}

// ---------------- Web utils (legacy DuckDuckGo helpers, backup only) ----------------
async function duckDuckGoSearch(query, maxResults = 5) {
  const q = encodeURIComponent(query);
  const url = `https://html.duckduckgo.com/html/?q=${q}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  const html = await res.text();
  const $ = cheerio.load(html);
  const links = [];
  $('a.result__a').each((i, el) => {
    if (links.length >= maxResults) return;
    const href = $(el).attr('href'); if (!href) return;
    try { const u = new URL(href, 'https://duckduckgo.com'); links.push(u.href); } catch { links.push(href); }
  });
  if (links.length === 0) $('a').each((i, el) => {
    if (links.length >= maxResults) return;
    const href = $(el).attr('href'); if (href && href.startsWith('http')) links.push(href);
  });
  return links.slice(0, maxResults);
}

async function fetchAndExtract(url) {
  try{
    // Phase 5.14: tighten timeout + minimal HTML scanning
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1500);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
    });
    clearTimeout(timer);
    if (!res.ok) return null;

    const html = await res.text();
    const $ = cheerio.load(html);
    const paras = [];
    // Only scan minimal content-ish nodes
    $('p, article, div.content, section').each((i, el) => {
      let t = $(el).text().replace(/\s+/g,' ').trim();
      if (t.length > 50 && !/cookie|subscribe|advert/i.test(t)) paras.push(t);
    });

    const uniq = Array.from(new Set(paras)).filter(p => p.length > 40).slice(0, 10);
    if (uniq.length === 0) return null;
    return uniq.join('\n\n');
  }catch(e){
    send('log', `[fetchAndExtract error] ${e.message}`);
    return null;
  }
}

function extractiveSummary(text, query, maxSentences = 6) {
  if (!text) return '';
  const qwords = (query || '').toLowerCase().split(/\s+/).filter(Boolean);
  const sents = text.split(/(?<=[.!?])\s+/);
  const scored = sents.map(s => {
    const lw = s.toLowerCase(); let score = 0;
    qwords.forEach(q => { if (lw.includes(q)) score++; });
    return { s: s.trim(), score };
  }).sort((a,b) => b.score-a);
  const chosen = scored.filter(x => x.s.length > 30).slice(0, maxSentences).map(x => x.s);
  return chosen.length ? chosen.join(' ') : sents.slice(0, maxSentences).join(' ').trim();
}

// ---------------- Answering state/funcs ----------------
let docContext = { name:'', text:'', tokens:null };
let webPlus   = false;   // backend flag (UI removed)
let useDoc    = false;   // default OFF so answers are AI-only
let docEnrich = false;   // Phase 5.12: doc-enrichment mode

// Phase 5.15: API preference (Fastest / Cheapest / Most accurate / Local only)
let searchPrefs = { mode: 'fastest' }; // default

// Phase 5.14: simple in-process cache for search results (10 minutes)
const SEARCH_CACHE_TTL_MS = 10 * 60 * 1000;
const searchCache = new Map(); // key -> { ts, results }

async function cachedSmartSearch(query, opts = {}) {
  const key = String(query || '').trim().toLowerCase();
  const now = Date.now();
  const cached = searchCache.get(key);
  if (cached && (now - cached.ts) < SEARCH_CACHE_TTL_MS) {
    send('log', `[api] provider=cache kind=web ms=0`);
    return cached.results;
  }

  const t0 = Date.now();
  const { unifiedWebSearch } = require("./searchRoot/searchRouter");
  const response = await unifiedWebSearch(query, 5);

  const ms = Date.now() - t0;
  const provider = response?.provider || 'router';
  send('log', `[api] provider=${provider} kind=web ms=${ms}`);

  const results = Array.isArray(response)
    ? response
    : Array.isArray(response?.results)
      ? response.results
      : [];

  if (results.length) {
    searchCache.set(key, { ts: now, results });
  }
  return results;
}

// token helpers
const STOP = new Set('a an and are as at be by for from has have in into is it its of on or s t that the their to was were will with your you about this those these which who whom whose when where how why what can could should would may might not no yes more most very just also than then'.split(' '));

function tokenize(s){
  return (s||'')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g,' ')
    .split(/\s+/)
    .filter(w => w && w.length > 1 && !STOP.has(w));
}

function chunkText(text, target=1200){
  const chunks=[]; let buf=''; const paras=text.split(/\n{2,}/);
  for(const p of paras){
    if((buf+'\n\n'+p).length<=target){ buf=buf?buf+'\n\n'+p:p; }
    else {
      if(buf) chunks.push(buf);
      if(p.length<=target) chunks.push(p);
      else {
        for(let i=0;i<p.length;i+=target) chunks.push(p.slice(i,i+target));
      }
      buf='';
    }
  }
  if(buf) chunks.push(buf);
  return chunks;
}

function selectRelevantChunks(question, text, k=5){
  const qTokens=tokenize(question); if(qTokens.length===0) return [];
  const chunks=chunkText(text,1400);
  const scored=chunks.map((c,idx)=>{
    const tks=tokenize(c); const set=new Set(tks);
    let score=0; qTokens.forEach(q=>{ if(set.has(q)) score+=1; });
    score+=Math.min(5,Math.floor(tks.length/120));
    return {idx,c,score};
  }).sort((a,b)=>b.score-a);
  return scored.slice(0,k).map(x=>x.c);
}

function detectIntent(q){
  const s=q.toLowerCase();
  if (/(summari[sz]e|tl;dr|overview)/.test(s)) return 'summarize';
  if (/(key points|highlights|bullets?|action items|takeaways)/.test(s)) return 'highlights';
  return 'qa';
}

// Phase 5.11: doc token match confidence
function ensureDocTokens() {
  if (!docContext.text) {
    docContext.tokens = null;
    return;
  }
  if (!docContext.tokens) {
    docContext.tokens = new Set(tokenize(docContext.text));
  }
}

function docMatchRatio(question) {
  const qTokens = tokenize(question);
  if (!qTokens.length || !docContext.text) return 0;
  ensureDocTokens();
  const set = docContext.tokens || new Set();
  let match = 0;
  for (const t of qTokens) {
    if (set.has(t)) match++;
  }
  return qTokens.length ? (match / qTokens.length) : 0;
}


// --- OpenAI engines ---
async function openAIDocAnswer(question, text) {
  const intent = detectIntent(question);
  const k = intent === 'qa' ? 6 : 12;

  const ctx = intent === 'qa'
    ? selectRelevantChunks(question, text, k).join('\n\n')
    : chunkText(text, 1400).slice(0, k).join('\n\n');

  const sys = `You are Haloryn. Answer ONLY using the provided document.
If the document does not contain the answer, say "I couldn't find this in the document."
Prefer concise bullets.`;

  const user = `Document: """\n${ctx}\n"""\n\nTask: ${
    intent === 'summarize'
      ? 'Provide a concise summary.'
      : intent === 'highlights'
        ? 'List the key points / action items as bullets.'
        : `Answer the question strictly from the document: ${question}`
  }`;

  // --- CLOUD-ONLY OpenAI call ---
  try {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: process.env.FALLBACK_MODEL || 'gpt-4o-mini',
        temperature: 0.3,
        max_tokens: 600,
        messages: [
          { role: 'system', content: sys },
          { role: 'user', content: user }
        ]
      })
    });

    const txt = await r.text();
    let json = null;

    try {
      json = JSON.parse(txt);
    } catch {
      send('log', `[OpenAI raw] ${txt}`);
    }

    // OpenAI error handling
    if (json?.error?.message) {
      send('log', `[OpenAI Error] ${json.error.message}`);
      return `I couldn't find this in the document.`;
    }

    const out = json?.choices?.[0]?.message?.content?.trim();
    if (out) return out;

  } catch (err) {
    send('log', `[OpenAI Exception] ${err.message}`);
  }

  // --- CLOUD FALLBACK ---
  // Brave summary first
  try {
    const brave = await braveWebSummary(question, 4);
    if (brave) return brave;
  } catch (e) {
    send('log', `[Brave fallback error] ${e.message}`);
  }

  // Router fallback (Bing/SerpAPI/PSE)
  try {
    const results = await cachedSmartSearch(question, {
      maxResults: 4,
      log: (line) => send('log', line)
    });

    if (results?.length) {
      const parts = results.map(r => {
        const base = r.snippet?.trim() || r.title?.trim() || '';
        const src = r.url ? ` (${r.url})` : '';
        return `${base}${src}`;
      }).filter(Boolean);

      if (parts.length) {
        return `From the web:\n• ${parts.join('\n• ')}`;
      }
    }
  } catch (e) {
    send('log', `[Router fallback error] ${e.message}`);
  }

  // Last fallback
  return `I couldn't find enough information to answer this from the document or the web.`;
}


async function openAIHybridAnswer(question, text) {
  const intent = detectIntent(question);
  const k = intent === 'qa' ? 6 : 10;

  // --- Document Context ---
  const docCtx = intent === 'qa'
    ? selectRelevantChunks(question, text, k).join('\n\n')
    : chunkText(text, 1400).slice(0, k).join('\n\n');

  // --- Web Search Context ---
  const results = await cachedSmartSearch(question, {
    maxResults: 4,
    log: (line) => send('log', line)
  });

  let webSnips = [];
  if (results && results.length) {
    for (const r of results) {
      const base = r.snippet || r.title || '';
      const sum = extractiveSummary(base, question, 3);
      if (sum) webSnips.push({ url: r.url, sum });
    }
  }

  const webCtx = webSnips
    .map((s, i) => `[${i + 1}] ${s.sum} (source: ${s.url})`)
    .join('\n');

  const sys = `You are Haloryn. Produce the BEST answer by combining the provided document with external knowledge snippets.
Rules:
- Be accurate and concise.
- Prefer the document when it clearly answers; otherwise enrich with the web snippets.
- If something conflicts, say so briefly.
- Use short bullets where helpful.`;

  const user = `Question: ${question}

Document context:
"""
${docCtx}
"""

Web snippets:
"""
${webCtx || '(no web snippets)'}
"""

Write one cohesive answer. If you use web info, reflect it clearly.`;


  // --- CLOUD-ONLY OpenAI ---
  try {
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: process.env.FALLBACK_MODEL || "gpt-4o-mini",
        temperature: 0.4,
        max_tokens: 700,
        messages: [
          { role: "system", content: sys },
          { role: "user", content: user }
        ]
      })
    });

    const txt = await r.text();
    let json = null;

    try {
      json = JSON.parse(txt);
    } catch {
      send("log", `[OpenAI raw] ${txt}`);
    }

    if (json?.error?.message) {
      send("log", `[OpenAI Error] ${json.error.message}`);
    } else {
      const out = json?.choices?.[0]?.message?.content?.trim();
      if (out) return out;
    }

  } catch (err) {
    send("log", `[OpenAI Exception] ${err.message}`);
  }

  // --------------------
  // CLOUD FALLBACK
  // --------------------

  // Brave summary
  try {
    const brave = await braveWebSummary(question, 5);
    if (brave) return brave;
  } catch (e) {
    send("log", `[Brave fallback error] ${e.message}`);
  }

  // Router (Bing / SerpAPI / Google PSE)
  try {
    const fallbackResults = await cachedSmartSearch(question, {
      maxResults: 4,
      log: (line) => send("log", line)
    });

    if (fallbackResults?.length) {
      const parts = fallbackResults.map(r => {
        const base = r.snippet?.trim() || r.title?.trim() || '';
        const src = r.url ? ` (${r.url})` : '';
        return `${base}${src}`;
      }).filter(Boolean);

      if (parts.length) {
        return `From the web:\n• ${parts.join("\n• ")}`;
      }
    }
  } catch (e) {
    send("log", `[Router fallback error] ${e.message}`);
  }

  // Absolute last fallback
  return `I couldn't find enough combined document + web information to answer this.`;
}


// Phase 5.12 — Doc-enrichment mode: doc-first then web
async function docEnrichAnswer(question, text) {
  const hasOpenAIKey = !!(process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim());

  // -------------------------------
  // PHASE A: DOC-FIRST (OpenAI only)
  // -------------------------------
  let docPart = '';

  if (hasOpenAIKey) {
    docPart = await openAIDocAnswer(question, text);
  } else {
    // If no OpenAI key → direct fallback
    const summary = extractiveSummary(text, question, 6);
    docPart = summary || `I couldn't find this in the document.`;
  }

  // -------------------------------
  // PHASE B: WEB ENRICHMENT
  // -------------------------------
  const results = await cachedSmartSearch(question, {
    maxResults: 4,
    log: (line) => send("log", line)
  });

  let webCtx = "";
  if (results && results.length) {
    webCtx = results
      .map((r) => r.snippet || r.title || "")
      .filter(Boolean)
      .join("\n\n");
  }

  const webPart = extractiveSummary(webCtx, question, 6);

  // -------------------------------
  // PHASE C: HYBRID FALLBACK
  // If doc lacks answer AND web lacks answer
  // -------------------------------
  const docEmpty =
    !docPart ||
    /couldn'?t find this in the document/i.test(docPart);

  if (docEmpty && !webPart) {
    // Try full hybrid answer (OpenAI only)
    try {
      const hybrid = await openAIHybridAnswer(question, text);
      if (hybrid) return hybrid;
    } catch (e) {
      send("log", `[Hybrid OpenAI error] ${e.message}`);
    }

    return `I couldn't find enough information in the document or the web to answer this.`;
  }

  // -------------------------------
  // PHASE D: COMBINE DOC + WEB
  // -------------------------------
  let out = "";

  if (docPart) {
    out += `From your document:\n${docPart.trim()}\n\n`;
  }

  if (webPart) {
    out += `From the web:\n${webPart.trim()}`;
  }

  return out.trim();
}


// --- Brave-only web summary helper (used by genericAnswer fallbacks) ---
async function braveWebSummary(userText, maxResults = 5) {
  if (!braveSearch) return null;
  const q = String(userText || '').trim();
  if (!q) return null;

  try {
    const results = await braveSearch.search(q, maxResults);
    if (!results || !results.length) return null;

    const bullets = results
      .map(r => {
        const title = (r.title || '').trim();
        const snippet = (r.snippet || '').trim();
        if (!title && !snippet) return '';
        if (title && snippet) return `${title} — ${snippet}`;
        return title || snippet;
      })
      .filter(Boolean);

    if (!bullets.length) return null;
    return `From the web (Brave):\n• ${bullets.join('\n• ')}`;
  } catch (e) {
    send('log', `[Brave:summary:error] ${e.message}`);
    return null;
  }
}


// --- Generic (no doc) ---
async function genericAnswer(userText){
  const mode = searchPrefs.mode || 'fastest';

  // Phase 8: cloud-only — removed all local LLM logic

  const hasOpenAIKey = !!(process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim());

  // "Cheapest" → avoid OpenAI even if key is present; rely on free web search
  if (!hasOpenAIKey || mode === 'cheapest') {
    const brave = await braveWebSummary(userText, 5);
    if (brave) return brave;

    const results = await cachedSmartSearch(userText, {
      maxResults: 5,
      log: (line) => send('log', line)
    });

    if (!results || !results.length){
      return `I couldn’t find enough public info for “${userText}”. Try rephrasing.`;
    }

    const bullets = results.map(r => {
      const base = (r.snippet && r.snippet.trim())
        ? r.snippet.trim()
        : (r.title || '').trim();
      const src = r.url ? ` (${r.url})` : '';
      return `${base}${src}`;
    });

    return `From the web:\n• ${bullets.join('\n• ')}`;
  }

  // "Fastest" and "Most accurate" → allow OpenAI
  try{
    const r = await fetch('https://api.openai.com/v1/chat/completions',{
      method:'POST',
      headers:{
        'Authorization':`Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type':'application/json'
      },
      body:JSON.stringify({
        model:process.env.FALLBACK_MODEL||'gpt-4o-mini',
        temperature:0.6,
        max_tokens:700,
        messages:[
          {role:'system',content:'You are Haloryn. Provide clear, direct answers.'},
          {role:'user',content:userText}
        ]
      })
    });
    const txt = await r.text(); let json;
    try{ json=JSON.parse(txt); }catch{ send('log',`[OpenAI raw] ${txt}`); }
    if (json?.error?.message){ send('log',`[OpenAI Error] ${json.error.message}`); }
    const out = json?.choices?.[0]?.message?.content?.trim();
    if (out) return out;
  }catch(e){
    send('log', `[OpenAI Exception] ${e.message}`);
  }

  // Fallback → router → Brave
  const results = await cachedSmartSearch(userText, {
    maxResults: 4,
    log: (line) => send('log', line)
  });
  if (results && results.length) {
    const bullets = results.map(r => {
      const base = (r.snippet && r.snippet.trim())
        ? r.snippet.trim()
        : (r.title || '').trim();
      const src = r.url ? ` (${r.url})` : '';
      return `${base}${src}`;
    });
    return `From the web:\n• ${bullets.join('\n• ')}`;
  }

  const brave = await braveWebSummary(userText, 5);
  if (brave) return brave;

  return `I couldn’t find enough public info for “${userText}”.`;
}


// --- Router ---
// ---------------- CLOUD-ONLY ROUTER (Phase 8) ----------------
async function answer(userText) {
  const q = (userText || '').trim();

  if (!q) return '';

  // --------------------------------------
  // 0) DOC CONTEXT (if attached + enabled)
  // --------------------------------------
  if (useDoc && docContext.text) {
    try {
      // Try a doc-focused Groq answer first (doc context + question)
      try {
        const docChunks = selectRelevantChunks(q, docContext.text, 8).filter(Boolean);
        let docCtx = docChunks.join('\n\n');
        if (!docCtx) {
          docCtx = docContext.text.slice(0, 2000);
        }
        const docPrompt = `You are given a document "${docContext.name}". Answer using ONLY this document. If the document truly lacks the answer, say "I couldn't find this in the document." Correct typos in the question based on context.\n\nDocument excerpt:\n${docCtx}\n\nQuestion: ${q}`;
        const docFast = await groqFastAnswer(docPrompt, docCtx, docContext.name);
        if (docFast && docFast.trim().length > 2) {
          send("log", "[Groq] Doc-aware answer succeeded.");
          return docFast.trim();
        }
      } catch (e) {
        send("log", `[Groq doc-aware error] ${e.message}`);
      }

      if (docEnrich) {
        const docEnriched = await docEnrichAnswer(q, docContext.text);
        if (docEnriched && docEnriched.trim()) return docEnriched.trim();
      } else {
        const docOnly = await openAIDocAnswer(q, docContext.text);
        if (docOnly && !/couldn'?t find this in the document/i.test(docOnly)) {
          return docOnly.trim();
        }
      }
    } catch (e) {
      send("log", `[Doc answer error] ${e.message}`);
    }
    // Lightweight fallback if no cloud key or doc answer failed
    const summary = extractiveSummary(docContext.text, q, 6);
    if (summary && summary.trim()) return summary.trim();
  }

  // --------------------------------------
  // 1) GROQ FAST ANSWER (PRIMARY ENGINE)
  // --------------------------------------
  try {
    const fast = await groqFastAnswer(q);

    // More than 2 chars ensures real content (prevents "OK" / blanks)
    if (fast && typeof fast === "string" && fast.trim().length > 2) {
      send("log", "[Groq] Primary engine succeeded.");
      return fast.trim();
    } else {
      send("log", "[Groq] Returned empty/short content, skipping.");
    }
  } catch (err) {
    send("log", `[Groq fast error] ${err.message}`);
  }

  // --------------------------------------
  // 2) BRAVE FALLBACK (SECOND)
  // --------------------------------------
  try {
    const brave = await braveWebSummary(q, 5);

    if (brave && brave.trim().length > 0) {
      send("log", "[Brave] Fallback summary succeeded.");
      return brave;
    }
  } catch (err) {
    send("log", `[Brave error] ${err.message}`);
  }

  // --------------------------------------
  // 3) ROUTED WEB SEARCH (THIRD FALLBACK)
  // --------------------------------------
  try {
    const results = await cachedSmartSearch(q, {
      maxResults: 5,
      log: (line) => send("log", line)
    });

    if (results && results.length) {
      send("log", "[Router] Routed web search succeeded.");

      const bullets = results
        .map(r => {
          const base = r.snippet?.trim() || r.title?.trim() || "";
          const src = r.url ? ` (${r.url})` : "";
          return `${base}${src}`;
        })
        .filter(Boolean);

      if (bullets.length) {
        return `From the web:\n• ${bullets.join("\n• ")}`;
      }
    }
  } catch (err) {
    send("log", `[Router error] ${err.message}`);
  }

  // --------------------------------------
  // 4) OPENAI FINAL RESCUE FALLBACK
  // --------------------------------------
  if (process.env.OPENAI_API_KEY) {
    try {
      send("log", "[OpenAI] Using final fallback.");

      const r = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: process.env.FALLBACK_MODEL || "gpt-4o-mini",
          temperature: 0.5,
          max_tokens: 300,
          messages: [
            { role: "system", content: "You are Haloryn with cloud-only mode." },
            { role: "user", content: q }
          ]
        })
      });

      const txt = await r.text();
      let json;
      try {
        json = JSON.parse(txt);
      } catch {}

      const out = json?.choices?.[0]?.message?.content?.trim();
      if (out) return out;

    } catch (err) {
      send("log", `[OpenAI fallback error] ${err.message}`);
    }
  }

  // --------------------------------------
  // 5) ABSOLUTE LAST RETURN
  // --------------------------------------
  return `I couldn't find information for "${q}".`;
}



// --------------- Live / question classifiers (5.13) ---------------
function isQuestion(text) {
  const s = String(text || '');
  return /(\?|^\s*(who|what|why|when|where|which|how|can|could|should|would)\b|please\b)/i.test(s);
}

function isWebHeavyTopic(text) {
  const s = String(text || '').toLowerCase();
  return /\b(stock|stocks|share price|price today|quote|ticker|earnings|revenue|guidance|forecast|weather|temperature|rain|storm|bitcoin|btc|crypto|ethereum|eth|solana|sol|coinbase|spy|qqq|tsla|aapl|nifty|sensex|nasdaq|dow|news|headline)\b/.test(s);
}

// Live questions: skip doc path, auto-route to web/generic
async function answerLiveQuestion(text) {
  const full = String(text || '').trim();
  if (!full) return '';

  // Build a short context window from recent transcript lines to give the model continuity
  const lines = full.split(/\r?\n/).filter(Boolean);
  const ctx = lines.slice(-RECENT_TRANSCRIPT_LINES).join('\n');
  const lastLine = lines.length ? lines[lines.length - 1] : full;
  const payload = ctx ? `Context:\n${ctx}\n\nQuestion: ${lastLine}` : lastLine;

  // Route through the same answer pipeline used by chat (doc + web aware)
  return await answer(payload);
}

// ---------------- Paths / Recorder ----------------
function tmpDir(){
  const dir=path.join(os.tmpdir(),'haloai');
  if(!fs.existsSync(dir)) fs.mkdirSync(dir,{recursive:true});
  return dir;
}
function tmpWav(idx){ return path.join(tmpDir(), `chunk_${idx}.wav`); }

// Use device + gain from existing config (no UI change needed)
function recordWithSox(outfile, ms, onDone, device = 'default', gainDb = '0'){
  const seconds = Math.max(1, Math.round(ms/1000));
  const devArg = (device && device !== 'default') ? device : 'default';
  const args = [
    '-q','-t','waveaudio', devArg,
    '-r','16000','-b','16','-c','1',
    outfile,
    // No silence detection; fixed chunk, slight gain
    'trim','0', String(seconds),
    'gain', String(gainDb || '10')
  ];

  send('log', `[sox] ${args.join(' ')}`);
  try{
    const child=spawn('sox',args,{windowsHide:true});
    child.on('error',e=>send('log',`[sox:error] ${e.message}`));
    child.on('close',()=>{ try{ onDone&&onDone(); }catch{} });
  }catch(e){
    send('log',`[sox:spawn:failed] ${e.message}`);
    try{ onDone&&onDone(e);}catch{}
  }
}

// ---------------- Live + Companion pipeline ----------------
let live={on:false, idx:0, transcript:''};
let pendingAnswerTimer = null;
let pendingAnswerCtx = '';
// Larger chunk reduces CPU churn; can be overridden via UI config
let recConfig={device:'default', gainDb:'0', chunkMs:2000};

// Live Companion state
const companion = {
  enabled: true,
  intervalMs: 12000,
  timer: null,
  lastLen: 0,
  lastUpdateAt: 0
};

// Compose a rolling “Live Companion” update from transcript
async function generateCompanionUpdate(kind = 'rolling') {
  const tx = live.transcript.trim();
  if (!tx) return;

  const sys = `You are Haloryn Live Companion. Listen to a meeting/conversation transcript and provide:
- A 2–4 line concise summary (no fluff)
- Up to 5 action items with owners if mentioned
- Helpful suggested prompts the user could say to you next
Keep it short. If nothing new since last update, say "No material changes."`;

  const user = `Transcript (${kind}):\n"""${tx.slice(-6000)}"""`;

  let out = '';

  // Phase 8 — CLOUD ONLY (no local LLM)
  if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim()) {
    try {
      const r = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: process.env.FALLBACK_MODEL || 'gpt-4o-mini',
          temperature: 0.3,
          max_tokens: 400,
          messages: [
            { role: 'system', content: sys },
            { role: 'user', content: user }
          ]
        })
      });

      const j = await r.json();
      out = j?.choices?.[0]?.message?.content?.trim() || '';
    } catch (e) {
      send('log', `[Companion(OpenAI) error] ${e.message}`);
    }
  }

  // Fallback summary (if OpenAI fails)
  if (!out) {
    const summary = extractiveSummary(tx, '', 6);
    const bullets = summary
      .split(/(?<=[.!?])\s+/)
      .slice(0, 5)
      .map(s => `• ${s.trim()}`)
      .join('\n');

    out = `Summary:\n${summary}\n\nAction Items (draft):\n${bullets || '• (none)'}\n\nTry asking:\n• “What are the top 3 decisions?”\n• “Any blockers and owners?”`;
  }

  send('live:answer', out);
  companion.lastLen = tx.length;
  companion.lastUpdateAt = Date.now();
}


function startCompanionTimer(){
  if (!companion.enabled) return;
  stopCompanionTimer();
  companion.timer = setInterval(async () => {
    const txLen = live.transcript.length;
    if (txLen - companion.lastLen >= 60) {
      await generateCompanionUpdate('rolling');
    }
  }, companion.intervalMs);
}
function stopCompanionTimer(){
  if (companion.timer) { clearInterval(companion.timer); companion.timer = null; }
}

function startChunk(){
  const dMs=recConfig.chunkMs||1500;
  const thisIdx = live.idx;
  const outfile=tmpWav(thisIdx);
  const after=()=>{ 
    const size=fs.existsSync(outfile)?fs.statSync(outfile).size:0; 
    send('log', `[chunk] ${outfile} size=${size} bytes`);

    if (live.on){ live.idx = thisIdx + 1; setImmediate(startChunk); }

    (async()=>{
      try{
        const text=(await runWhisper(outfile))||'';
        const normalized = text.replace(/\s+/g,' ').trim();
        if(normalized){
          send('live:chunk', normalized);
          // Append each recognized utterance as its own line (no concatenated run-on)
          live.transcript += (live.transcript ? '\n' : '') + normalized;
          // keep transcript lightweight: cap to last 8000 chars
          if (live.transcript.length > 8000) {
            live.transcript = live.transcript.slice(-8000);
          }
          send('live:transcript',live.transcript);

          // Debounce answering until user stops speaking; reset timer on every chunk
          if (pendingAnswerTimer) clearTimeout(pendingAnswerTimer);
          pendingAnswerCtx = live.transcript;
          pendingAnswerTimer = setTimeout(async () => {
            try{
              const answerText = await answerLiveQuestion(pendingAnswerCtx);
              if (answerText) send('live:answer', answerText);
            }catch(e){
              send('log', `[live answer error] ${e.message}`);
            }finally{
              pendingAnswerTimer = null;
            }
          }, 2000); // wait for ~2s of silence before answering
        } else send('log','[whisper] (empty transcript)');
      }catch(e){ send('log', `[whisper:error] ${e.message}`); }
    })();
  };
  recordWithSox(outfile,dMs,after, recConfig.device, recConfig.gainDb);
}
//Activity page Handler
ipcMain.on("start-session", () => {
  isSessionActive = true;

  if (win && !win.isDestroyed()) {
   win.loadFile(path.join(__dirname, "indexRoot.html"))

    .catch(err => console.error("[start-session loadFile error]", err));
  }
});

ipcMain.on("finish-session", (e, summary) => {
  isSessionActive = false;

  // Store summary in memory
  lastSessionSummary = summary;

  try {
    appendActivityHistory({
      ts: Date.now(),
      summary: summary || {},
    });
  } catch (err) {
    console.error("ACTIVITY SAVE FAILED:", err);
  }

  // Load summary page
  win.loadFile(path.join(__dirname, "summaryRoot.html"));
});




ipcMain.handle("get-summary", () => {
  return lastSessionSummary;
});
ipcMain.handle("summary:show-entry", async (_e, summary) => {
  lastSessionSummary = summary || {};
  if (win && !win.isDestroyed()) {
    await win.loadFile(path.join(__dirname, "summaryRoot.html")); 
;
    return { ok: true };
  }
  return { ok: false, error: "window unavailable" };
});
ipcMain.handle("activity:history", () => {
  const owner = currentHistoryOwner || HISTORY_ANON_OWNER;
  return readActivityHistory().filter((entry) => entry.owner === owner);
});
ipcMain.handle("logout", async () => {
  persistUserSession({}, { replace: true });
  isSessionActive = false;
  try {
    const port = await startRendererServer();
    if (win && !win.isDestroyed()) {
      await win.loadURL(`http://127.0.0.1:${port}/login.html`);
      return { ok: true };
    }
  } catch (e) {
    return { ok: false, error: e.message };
  }
  return { ok: false, error: "window unavailable" };
});
ipcMain.handle("load-user-info", async () => {
  if (win && !win.isDestroyed()) {
    await win.loadFile(path.join(__dirname, "userInfo.html"));
    return { ok: true };
  }
  return { ok: false, error: "window unavailable" };
});

ipcMain.handle("incognito:set", async (_e, flag) => {
  const incog = applyIncognito(!!flag);
  return { ok: true, incognito: incog };
});

ipcMain.handle("incognito:get", async () => ({ ok: true, incognito: incognitoOn }));

ipcMain.handle("logout:clear", async () => {
  persistUserSession({}, { replace: true });
  const port = await startRendererServer();
  if (win && !win.isDestroyed()) {
    await win.loadURL(`http://127.0.0.1:${port}/login.html`);
  }
  return { ok: true };
});


// Mirror handlers for Companion overlay API (used by preload.js)
ipcMain.handle('companion:start', async()=>{
  if(live.on){ send('companion:state','on'); return {ok:true}; }
  live={on:true, idx:0, transcript:''};
  companion.lastLen = 0;
  companion.lastUpdateAt = 0;
  startCompanionTimer();
  startChunk();
  send('companion:state','on');
  send('live:answer', '🔊 Live Companion is ON. I’ll drop concise updates every ~12 seconds and a final recap when you stop.');
  return {ok:true};
});
ipcMain.handle('companion:stop', async()=>{
  if(!live.on){ send('companion:state','off'); return {ok:true}; }
  live.on=false;
  stopCompanionTimer();
  await generateCompanionUpdate('final');
  send('companion:state','off');
  return {ok:true};
});
ipcMain.handle('live:start', async()=>{
  if(live.on) return {ok:true};
  live={on:true, idx:0, transcript:''};
  companion.lastLen = 0;
  companion.lastUpdateAt = 0;
  startCompanionTimer();
  startChunk();
  send('companion:state','on');
  send('live:answer', '🔊 Live Companion is ON. I’ll drop concise updates every ~12 seconds and a final recap when you stop.');
  return {ok:true};
});
ipcMain.handle('live:stop', async()=>{
  live.on=false;
  stopCompanionTimer();
  await generateCompanionUpdate('final');
  return {ok:true};
});
// ... existing code above ...
// FAST transcription using Groq Whisper (Phase 7)
ipcMain.handle("groq:transcribe", async (_e, audioBuffer) => {
  try {
    const text = await groqWhisperTranscribe(audioBuffer);
    return { ok: true, text };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});
// FAST answering using Groq LLaMA (Phase 7)
/*ipcMain.handle("groq:ask", async (_e, prompt) => {
  try {
    const ans = await groqFastAnswer(prompt);
    return { ok: true, answer: ans };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});*/

// ------------------ OCR (Native Tesseract CLI) ------------------

console.log("[DEBUG] process.platform =", process.platform);

//const { spawn } = require("child_process");
//const os = require("os");
//const fs = require("fs");
//const path = require("path");

// REMOVE tesseract.js references entirely
// let ocrWorker = null;
// const { createWorker } = require("tesseract.js");
//const sharp = require("sharp");
// --- NEW: Guard against invalid OCR payload BEFORE spawning Tesseract ---
ipcMain.handle("ocr:validate", async (_event, payload) => {
  try {
    let imgBuffer = null;

    if (Buffer.isBuffer(payload)) {
      imgBuffer = payload;
    } else if (typeof payload === "string") {
      imgBuffer = Buffer.from(payload, "base64");
    } else if (payload?.base64) {
      imgBuffer = Buffer.from(payload.base64, "base64");
    } else if (payload?.data) {
      imgBuffer = Buffer.from(payload.data);
    }

    if (!imgBuffer || imgBuffer.length < 1000) {
      return { ok: false, reason: "empty_or_invalid" };
    }

    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err.message };
  }
});

ipcMain.handle("ocr:image", async (_event, payload) => {
  try {
    console.log("[OCR] Received payload for native Tesseract");

    //-------------------------------------------------------
    // 1. Normalize incoming image buffer
    //-------------------------------------------------------
    let imgBuffer = null;

    if (Buffer.isBuffer(payload)) {
      imgBuffer = payload;
    } else if (typeof payload === "string") {
      imgBuffer = Buffer.from(payload, "base64");
    } else if (payload && typeof payload.base64 === "string") {
      imgBuffer = Buffer.from(payload.base64, "base64");
    } else if (payload instanceof Uint8Array || Array.isArray(payload)) {
      imgBuffer = Buffer.from(payload);
    } else if (payload?.data && Array.isArray(payload.data)) {
      imgBuffer = Buffer.from(payload.data);
    }

    if (!imgBuffer || imgBuffer.length === 0) {
      return "OCR Error: Invalid OCR payload";
    }

    //-------------------------------------------------------
    // 2. Write temp PNG file
    //-------------------------------------------------------
    const tempFile = path.join(os.tmpdir(), `ocr_${Date.now()}.png`);
    // macOS Retina fix — downscale 2× images
let finalBuffer = imgBuffer;

if (process.platform === "darwin") {
  try {
    finalBuffer = await sharp(imgBuffer)
      .resize({ 
        width: Math.round((await sharp(imgBuffer).metadata()).width / 2),
        height: Math.round((await sharp(imgBuffer).metadata()).height / 2)
      })
      .png()
      .toBuffer();
    console.log("[OCR] Retina image downscaled");
  } catch (e) {
    console.warn("[OCR] Failed to downscale Retina image:", e.message);
  }
}

fs.writeFileSync(tempFile, finalBuffer);

    console.log("[OCR] Temp image created:", tempFile);

    //-------------------------------------------------------
    // 3. Identify Tesseract binary per OS
    //-------------------------------------------------------
    let tesseractBin = "/usr/local/bin/tesseract";
 // macOS default

    if (process.platform === "win32") {
      tesseractBin = "C:\\Program Files\\Tesseract-OCR\\tesseract.exe";
    }

    console.log("[OCR] Using binary:", tesseractBin);

    //-------------------------------------------------------
    // 4. Run Tesseract via spawn
    //-------------------------------------------------------
    const args = [tempFile, "stdout", "-l", "eng"];
    const proc = spawn(tesseractBin, args);

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (chunk) => (stdout += chunk.toString()));
    proc.stderr.on("data", (chunk) => (stderr += chunk.toString()));

    const exitCode = await new Promise((resolve) => {
      proc.on("close", resolve);
    });

    console.log("[OCR] Tesseract exited with code:", exitCode);

    // Cleanup temp file
    fs.unlink(tempFile, () => {});

    if (exitCode !== 0) {
      console.error("[OCR] ERROR:", stderr);
      return "OCR Error: " + (stderr || "Unknown error");
    }

    const text = (stdout || "").trim();
    console.log("[OCR] Text length:", text.length);

    return text;

  } catch (err) {
    console.error("[OCR] Exception:", err);
    return "OCR Error: " + (err?.message || err);
  }
});







// ---------------- File mode ----------------
ipcMain.handle('pick:audio', async()=>{
  const {canceled,filePaths}=await dialog.showOpenDialog({
    properties:['openFile'],
    filters:[{name:'Audio',extensions:['wav','mp3','m4a','ogg']}]
  });
  return canceled?null:filePaths[0];
});
ipcMain.handle('whisper:transcribe', async(_e, p)=>{
  try{ const t=await runWhisper(p); return {code:0, output:t}; }
  catch(e){ send('log', `[error] ${e.message}`); return {code:-1, output:''}; }
});

// ---------------- Config ----------------
ipcMain.handle('sox:devices', async()=>({items:[], selected:recConfig.device||'default'}));
ipcMain.handle('rec:getConfig', async()=>recConfig);
ipcMain.handle('rec:setConfig', async(_e,cfg)=>{
  if(cfg?.device!==undefined) recConfig.device=String(cfg.device||'default');
  if(cfg?.gainDb!==undefined) recConfig.gainDb=String(cfg.gainDb||'0');
  if(cfg?.chunkMs!==undefined){
    const v=Math.max(500,Math.min(4000,Number(cfg.chunkMs)||1500));
    recConfig.chunkMs=v;
  }
  send('log', `[rec] updated: device=${recConfig.device}, gain=${recConfig.gainDb}dB, chunkMs=${recConfig.chunkMs}`);
  return {ok:true, recConfig};
});

// ---------------- Chat + Doc ingest ----------------
// Phase-10 unified Groq backend endpoint
ipcMain.handle("ask", async (_e, prompt) => {
  try {
    const answer = await unifiedAsk(prompt);
    return { answer: String(answer || "").trim() };
  } catch (err) {
    send("log", `[ask:error] ${err.message}`);
    return { answer: `Error: ${err.message}` };
  }
});



// === RESTORE OLD CHAT PATHWAY (chat:ask) ===
ipcMain.handle("chat:ask", async (_e, prompt) => {
  try {
    // Old behavior → send prompt to unifiedAsk
    const answer = await unifiedAsk(prompt);

    return {
      answer: String(answer || "").trim(),
      streamed: false     // old code expects this field
    };
  } catch (err) {
    return {
      answer: "Error: " + err.message,
      streamed: false
    };
  }
});
ipcMain.handle("activity:clear-range", async (_, range) => {
  try {
    const file = path.join(app.getPath("userData"), "activityHistory.json");
    if (!fs.existsSync(file)) return true;

    const raw = fs.readFileSync(file, "utf8");
    const parsed = JSON.parse(raw || "[]");
    const arr = Array.isArray(parsed) ? parsed : [];
    const owner = currentHistoryOwner || HISTORY_ANON_OWNER;

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const yesterdayStart = todayStart - 86400000;
    const dayOfWeek = now.getDay();
    const mondayThisWeek = new Date(now);
    mondayThisWeek.setHours(0, 0, 0, 0);
    mondayThisWeek.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    const mondayLastWeek = new Date(mondayThisWeek);
    mondayLastWeek.setDate(mondayThisWeek.getDate() - 7);
    const sundayLastWeek = new Date(mondayLastWeek);
    sundayLastWeek.setDate(mondayLastWeek.getDate() + 6);
    const lastWeekStart = mondayLastWeek.getTime();
    const lastWeekEnd = sundayLastWeek.getTime() + 86399999;

    const sanitized = arr.map((item) => ({
      owner: item?.owner || HISTORY_ANON_OWNER,
      ...item
    }));

    const shouldRemove = (ts = 0) => {
      if (range === "today") {
        return ts >= todayStart;
      }
      if (range === "yesterday") {
        return ts >= yesterdayStart && ts < todayStart;
      }
      if (range === "week") {
        return ts >= lastWeekStart && ts <= lastWeekEnd;
      }
      if (range === "all") {
        return true;
      }
      return false;
    };

    const filtered = sanitized.filter((entry) => {
      if (entry.owner !== owner) return true;
      const ts = Number(entry.ts || 0);
      return !shouldRemove(ts);
    });

    fs.writeFileSync(file, JSON.stringify(filtered, null, 2));
    return true;

  } catch (e) {
    console.error("clear-range failed:", e);
    return false;
  }
});





// Phase-10 unified search router endpoint
ipcMain.handle("search:router", async (_e, query) => {
  try {
    const res = await fetch(`${process.env.VERCEL_URL ? "https://" + process.env.VERCEL_URL : "http://localhost:3000"}/api/search/router`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, maxResults: 5 })
    });

    const json = await res.json();
    return json.results || [];
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle('doc:ingestText', async(_e,p)=>{
  const name=(p?.name||'document.txt').toString();
  const raw=(p?.text||'').toString();
  const text=raw.replace(/\u0000/g,'').slice(0,200000);
  docContext={name,text,tokens:null};
  useDoc = true; // auto-enable doc mode when a doc is loaded
  send('log', `[doc] context ready: ${name}`);
  send('log', `[doc] loaded text: ${name}, ${text.length} chars`);
  send('live:answer', `Document loaded: ${name} (${text.length} chars). Ask your question and I'll answer using it.`);
  return {ok:true, name, chars:text.length};
});
ipcMain.handle('doc:ingestBinary', async(_e,p)=>{
  const name=(p?.name||'document.bin').toString();
  const bytes=p?.bytes;
  const mime=(p?.mime||'').toString();
  if(!bytes||!Array.isArray(bytes)) return {ok:false,error:'No bytes'};
  if (name.toLowerCase().endsWith('.pdf')||mime==='application/pdf'){
    try{
      if(!pdfParse){
        try{ pdfParse=require('pdf-parse'); }
        catch{
          const msg='[doc] PDF support not installed. Run: npm i pdf-parse';
          send('log',msg); send('live:answer',msg);
          return {ok:false,error:'Missing pdf-parse'};
        }
      }
      const buff=Buffer.from(bytes);
      const data=await pdfParse(buff);
      const text=(data.text||'').slice(0,200000);
      docContext={name,text,tokens:null};
      useDoc = true; // auto-enable doc mode when a doc is loaded
      send('log', `[doc] context ready: ${name}`);
      send('log', `[doc] loaded PDF: ${name}, ${text.length} chars`);
      send('live:answer', `Document loaded: ${name} (${text.length} chars). Ask your question and I'll answer using it.`);
      return {ok:true, name, chars:text.length, type:'pdf'};
    }catch(e){
      const msg=`[doc] PDF load error: ${e.message}`;
      send('log',msg); send('live:answer',msg);
      return {ok:false,error:e.message};
    }
  }
  return {ok:false, error:'Unsupported binary type. Use PDF or text formats.'};
});
ipcMain.handle('doc:clear', async()=>{
  docContext={name:'',text:'',tokens:null};
  return {ok:true};
});
ipcMain.handle('doc:setUse', async(_e, flag)=>{
  useDoc = !!flag;
  return { ok:true, useDoc };
});

// Phase 5.12: backend doc-enrich toggle
ipcMain.handle('doc:enrich:set', async(_e, flag)=>{
  docEnrich = !!flag;
  send('log', `[doc] enrich=${docEnrich ? 'ON' : 'OFF'}`);
  return { ok:true, docEnrich };
});

// Phase 5.15: search preferences
ipcMain.handle('searchPrefs:set', async(_e, prefs)=>{
  const mode = (prefs && prefs.mode || '').toString().toLowerCase();
  const allowed = ['fastest','cheapest','accurate','local'];
  if (allowed.includes(mode)) {
    searchPrefs.mode = mode;
  }
  send('log', `[search] mode=${searchPrefs.mode}`);
  return { ok:true, mode: searchPrefs.mode };
});

// (Web+ backend toggle kept; UI removed)
ipcMain.handle('webplus:set', async(_e, flag)=>{
  webPlus = !!flag;
  send('log', `[Web+] ${webPlus?'enabled':'disabled'}`);
  return { ok:true, webPlus };
});

// NEW: expose provider stats to the renderer for the API usage panel
ipcMain.handle("search:stats", async () => {
  try {
    const stats = typeof getProviderStats === "function" ? getProviderStats() : {};
    return { ok: true, stats };
  } catch (e) {
    send("log", `[search:stats:error] ${e.message}`);
    return { ok: false, error: e.message };
  }
});

// --------------------------------------------------------
// macOS Native Screen Capture Loader (safe, deduped)
// --------------------------------------------------------
//const fs = require("fs");
//const path = require("path");

function resolveNativeAddon() {
  const candidates = [
    // Running from project root
    path.resolve(process.cwd(), "native-macos-capture/build/Release/macos_capture.node"),

    // Running from electron/
    path.resolve(__dirname, "../native-macos-capture/build/Release/macos_capture.node"),

    // Packaged app (resources)
    path.resolve(process.resourcesPath || "", "native-macos-capture/build/Release/macos_capture.node")
  ];

  for (const p of candidates) {
    if (fs.existsSync(p)) {
      console.log("[mac-native] Using addon at:", p);
      return p;
    }
  }

  console.error("[mac-native] No valid addon found. Candidates:", candidates);
  return null;
}

let macNative = null;

try {
  const addonPath = resolveNativeAddon();

  if (addonPath) {
    macNative = require(addonPath);
    console.log("[mac-native] addon loaded OK");
  } else {
    console.log("[mac-native] addon unavailable — fallback will be used");
  }
} catch (err) {
  console.error("[mac-native] preload failed:", err);
}


// Background screen capture (no snipping tool)
ipcMain.handle("screenread:capture-below", async (_event, region) => {
  try {
    const target = BrowserWindow.getFocusedWindow() || win;
    if (!target || target.isDestroyed()) {
      return { ok: false, error: "window unavailable" };
    }

    const bounds = target.getBounds();
    const display = screen.getDisplayNearestPoint({
      x: bounds.x + bounds.width / 2,
      y: bounds.y + bounds.height / 2
    });

    console.log("[screenread] display", { id: display.id, bounds: display.bounds });

    //--------------------------------------------------------------------
    // 🔹 Compute the region (shared across mac + fallback)
    //--------------------------------------------------------------------
    let captureRegion = null;

    // ❌ OLD (buggy) lines – keep as comments so nothing is "removed"
    // const imgBase64 = nativeAddon.captureScreenRegion(scaled);
    // await new Promise(r => setTimeout(r, 80));

    if (region && typeof region.x === "number" && region.width > 0) {
      captureRegion = {
        x: region.x,
        y: region.y,
        width: region.width,
        height: region.height
      };
    } else {
      const availableBelow =
        display.bounds.y + display.bounds.height - (bounds.y + bounds.height);

      const height = Math.max(
        200,
        Math.min(400, availableBelow > 0 ? availableBelow : 400)
      );

      const regionTop = Math.min(
        display.bounds.y + display.bounds.height - height,
        Math.max(display.bounds.y, bounds.y + bounds.height)
      );

      const regionHeight = Math.max(
        1,
        Math.min(height, display.bounds.y + display.bounds.height - regionTop)
      );

      const regionWidth = Math.max(
  1,
  Math.min(bounds.width, display.bounds.width)
);


      const regionLeft = Math.max(
        display.bounds.x,
        Math.min(bounds.x, display.bounds.x + display.bounds.width - regionWidth)
      );

      if (regionHeight <= 0 || regionWidth <= 0) {
        return { ok: false, error: "capture region unavailable" };
      }

      captureRegion = {
        x: regionLeft,
        y: regionTop,
        width: regionWidth,
        height: regionHeight
      };
    }

    //--------------------------------------------------------------------
    // 🔥🔥🔥 macOS NATIVE CAPTURE (native-macos-capture)
    //--------------------------------------------------------------------
    if (process.platform === "darwin") {
      console.log("[mac-native] attempting native capture");
      const nativeAddon = macNative; // preload at top of main.js

      if (!nativeAddon || typeof nativeAddon.captureScreenRegion !== "function") {
        console.error("[mac-native] addon missing or invalid, falling back to Electron");
      } else {
        try {
          // small delay so overlay / window state settles
          await new Promise(r => setTimeout(r, 80));

          console.log(
            "[mac-native] addon loaded. has captureScreenRegion =",
            typeof nativeAddon.captureScreenRegion
          );

          const scale = screen.getPrimaryDisplay().scaleFactor || 1;

          // Apply generous padding before scaling (fixes clipped multi-line)
          const pad = 30;
          const padded = {
            x: captureRegion.x - pad,
            y: captureRegion.y - pad,
            width: captureRegion.width + pad * 2,
            height: captureRegion.height + pad * 2
          };

          const scaled = {
            x: Math.round(padded.x * scale),
            y: Math.round(padded.y * scale),
            width: Math.round(padded.width * scale),
            height: Math.round(padded.height * scale)
          };

          console.log("[mac-native] scaled region:", scaled);

          const imgBase64 = nativeAddon.captureScreenRegion(scaled);

          if (imgBase64) {
            console.log("[mac-native] capture success");
            const normalized = await normalizeMacImage(imgBase64);
            return { ok: true, base64: normalized.toString("base64") };
          } else {
            console.error("[mac-native] addon returned empty image");
          }
        } catch (err) {
          console.error("[mac-native] failed, falling back:", err);
        }
      }
    }

    //--------------------------------------------------------------------
    // 🔹 FALLBACK (Electron desktopCapturer) — unchanged
    //--------------------------------------------------------------------

    const displayWidth = Math.max(
      1,
      Number(display?.size?.width) || Number(display?.bounds?.width) || 1
    );
    const displayHeight = Math.max(
      1,
      Number(display?.size?.height) || Number(display?.bounds?.height) || 1
    );
    const scaleFactor = Number(display?.scaleFactor) || 1;

    const thumbSize = {
      width: Math.max(1, Math.floor(displayWidth * scaleFactor)),
      height: Math.max(1, Math.floor(displayHeight * scaleFactor))
    };

    const sources = await desktopCapturer.getSources({
      types: ["screen"],
      thumbnailSize: thumbSize
    });

    const screenSource =
      sources.find(src => src.display_id === String(display.id)) || sources[0];

    if (!screenSource) {
      return { ok: false, error: "fallback capture failed: no source" };
    }

    const fullImg = screenSource.thumbnail;
    if (!fullImg || fullImg.isEmpty()) {
      return { ok: false, error: "fallback capture failed: empty image" };
    }

    const cropped = fullImg.crop(captureRegion);
    return {
      ok: true,
      base64: cropped.toDataURL().replace(/^data:image\/png;base64,/, "")
    };

  } catch (err) {
    console.error("[screenread:capture-below] error", err);
    return { ok: false, error: err.message };
  }
});




// ---------------- Window controls / env ----------------
ipcMain.handle('window:minimize', ()=>{ if(win && !win.isDestroyed()) win.minimize(); });
ipcMain.handle('window:maximize', ()=>{ if(!win||win.isDestroyed()) return; if(win.isMaximized()) win.unmaximize(); else win.maximize(); });
ipcMain.handle("window:close", async () => {
  if (isSessionActive) {
    isSessionActive = false;

    try { send('trigger:end-session'); } catch {}

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("finishSession");  
    }

    return;
  }

  app.quit();
});

ipcMain.on("exit-app", () => {
  app.quit();
});




ipcMain.handle('window:restore', () => {
  if (win && win.isMinimized()) win.restore();
});
ipcMain.handle('env:get', ()=>({
  APP_NAME: process.env.APP_NAME || 'Haloryn',
  OPENAI_API_KEY: !!process.env.OPENAI_API_KEY,
  FALLBACK_MODEL: process.env.FALLBACK_MODEL || 'gpt-4o-mini'
}));
