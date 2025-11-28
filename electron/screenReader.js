// screenReader.js
// Dedicated module for Screen Reading (screenshot + Tesseract OCR)

const os = require('os');
const path = require('path');
const fs = require('fs');
const { nativeOcr } = require("./ocrNative");
const screenshot = require('screenshot-desktop');

let logFn = null;

function log(msg) {
  if (!logFn) return;
  try { logFn(msg); } catch {}
}

function getTmpDir() {
  const base = process.env.HALO_TMPDIR || os.tmpdir();
  const dir = path.join(base, 'haloai-screen');
  try {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  } catch (e) {
    log(`[screen] tmpdir error: ${e.message}`);
  }
  return dir;
}

// Capture the primary screen to a PNG file and return its path
async function captureScreenToPng() {
  const dir = getTmpDir();
  const file = path.join(dir, `screen_${Date.now()}.png`);
  log(`[screen] capturing to ${file}`);
  await screenshot({ filename: file });
  return file;
}

// Initialize IPC handler
function initScreenReader({ ipcMain, log }) {
  logFn = typeof log === 'function' ? log : null;
  if (!ipcMain) return;

  ipcMain.handle('screen:readOnce', async () => {
    try {
      const pngPath = await captureScreenToPng();
      const text = await nativeOcr(pngPath);
      log(`[screen] OCR complete (${text.length} chars)`);
      return { ok: true, text };
    } catch (err) {
      const msg = err && err.message ? err.message : String(err);
      log(`[screen] ERROR: ${msg}`);
      return { ok: false, error: msg };
    }
  });
}

module.exports = {
  initScreenReader
};
