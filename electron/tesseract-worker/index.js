// Custom wrapper to disable global fetch before tesseract worker boots
try {
  if (typeof global.fetch !== 'undefined') {
    global.fetch = undefined;
  }
  if (typeof global.Headers !== 'undefined') {
    global.Headers = undefined;
  }
  if (typeof global.Request !== 'undefined') {
    global.Request = undefined;
  }
  if (typeof global.Response !== 'undefined') {
    global.Response = undefined;
  }
} catch (err) {
  console.warn('[tesseract-worker] unable to patch globals:', err?.message);
}

require('tesseract.js/src/worker-script/node/index.js');