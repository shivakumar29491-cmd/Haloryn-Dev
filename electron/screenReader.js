// screenReader.js
// Dedicated module for Screen Reading (screenshot + Tesseract OCR)

const os = require('os');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
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
async function captureScreenToPng(region) {
  const { desktopCapturer, screen } = require('electron');
  const fs = require('fs');
  const path = require('path');

  const dir = getTmpDir();
  const file = path.join(dir, `screen_${Date.now()}.png`);

  // 1. Get primary display size (Retina-safe)
  const primary = screen.getPrimaryDisplay();
  const { width, height } = primary.size;

  // 2. Ask Electron to capture the screen
  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: { width, height }   // FULL resolution
  });

  const source = sources[0];
  let img = source.thumbnail;

  // 3. Crop to region
  if (region) {
    const { x, y, width, height } = region;
    img = img.crop({ x, y, width, height });
  }

  // 4. Save
  fs.writeFileSync(file, img.toPNG());
  return file;
}


// Run Tesseract on the PNG and return extracted text
function runTesseract(pngPath) {
  const tessBin = process.env.TESSERACT_BIN || 'tesseract';
  const outBase = pngPath.replace(/\.png$/i, '');
  const txtPath = `${outBase}.txt`;
  const lang = process.env.TESS_LANG || 'eng';

  return new Promise((resolve, reject) => {
    const args = [
      pngPath,
      outBase,
      '-l', lang,
      '--psm', '6',      // ⭐ Best for multiline text
      '--oem', '1',      // ⭐ LSTM OCR engine
      '--dpi', '300',    // ⭐ Treat image as high resolution
    ];

    log(`[screen] running: ${tessBin} ${args.join(' ')}`);

    let child;
    try {
      child = spawn(tessBin, args, { stdio: 'ignore' });
    } catch (e) {
      return reject(e);
    }

    child.on('error', (err) => reject(err));
    child.on('exit', (code) => {
      if (code !== 0) {
        return reject(new Error(`tesseract exited with code ${code}`));
      }
      try {
        const text = fs.existsSync(txtPath) ? fs.readFileSync(txtPath, 'utf8') : '';
        resolve((text || '').trim());
      } catch (e) {
        reject(e);
      }
    });
  });
}

// Initialize IPC handler
async function initScreenReader({ ipcMain, log }) {
  logFn = typeof log === 'function' ? log : null;
  if (!ipcMain) return;

  ipcMain.handle('screen:readOnce', async () => {
    try {
      // 1. Capture raw PNG
      const pngPath = await captureScreenToPng();

      // 2. Load & upscale PNG (2x resolution for sharper text)
      const upscaledPngPath = await upscalePngForOCR(pngPath);

      // 3. Run optimized Tesseract
      const text = await runTesseract(upscaledPngPath);

      log(`[screen] OCR complete (${text.length} chars)`);
      return { ok: true, text };

    } catch (err) {
      const msg = err?.message || String(err);
      log(`[screen] ERROR: ${msg}`);
      return { ok: false, error: msg };
    }
  });
}
async function upscalePngForOCR(pngPath) {
  const outPath = pngPath.replace(".png", "-x2.png");

  await sharp(pngPath)
    .resize({ width: null, height: null, fit: "contain", kernel: "lanczos3", multiplier: 2 })
    .toFile(outPath);

  return outPath;
}

module.exports = {
  initScreenReader
};

