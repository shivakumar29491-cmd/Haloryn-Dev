const DEBUG_RENDERER = false;       // flip to true for verbose console logs

const ALLOW_UI_LOGS = false;        // keeps the UI log quiet in companion mode

const MAX_UI_LOG_LINES = 200;       // cap log size to avoid main-thread churn

const debugLog = (...args) => { if (DEBUG_RENDERER) console.log(...args); };

const ACTIVE_CHANNEL = {
  current: null,
  queue: []
};

window.ACTIVE_CHANNEL = ACTIVE_CHANNEL;

function processActiveChannelQueue() {
  if (ACTIVE_CHANNEL.current || !ACTIVE_CHANNEL.queue.length) return;
  const job = ACTIVE_CHANNEL.queue.shift();
  if (!job) return;
  ACTIVE_CHANNEL.current = job.channel;
  debugLog(`[channel] start ${job.channel} (queued=${ACTIVE_CHANNEL.queue.length})`);

  Promise.resolve()
    .then(() => job.task())
    .then(
      (result) => job.resolve(result),
      (error) => job.reject(error)
    )
    .finally(() => {
      debugLog(`[channel] done ${job.channel}`);
      ACTIVE_CHANNEL.current = null;
      processActiveChannelQueue();
    });
}

function enqueueChannelRequest(channel, task) {
  if (!channel || typeof task !== "function") {
    return Promise.reject(new Error("Invalid channel task"));
  }
  return new Promise((resolve, reject) => {
    ACTIVE_CHANNEL.queue.push({ channel, task, resolve, reject });
    processActiveChannelQueue();
  });
}

window.enqueueChannelRequest = enqueueChannelRequest;



debugLog("LOADED HTML:", window.location.pathname);


document.addEventListener("DOMContentLoaded", () => {

    debugLog("DOM READY");

    // ⭐ REQUIRED ⭐
    window.electronAPI.onTriggerFinishSession(() => {
    console.log("FINISH SESSION → building summary");
    sendSessionSummary();
});



});




let answerFooter;
let followUpBtn;
let detailSummaryBtn;
let footerVisible = false;
let lastAnswerText = "";

const DERIVED_PROMPTS = {
  follow: "Give 2 follow-up questions for: ",
  detail: "Give a detailed explanation for: "
};

function setupAnswerFooterControls() {
  answerFooter = document.getElementById("answerFooterFixed");
  followUpBtn = document.getElementById("followUpBtn");
  detailSummaryBtn = document.getElementById("detailSummaryBtn");
  if (followUpBtn) on(followUpBtn, "click", () => requestDerivedAnswer("follow"));
  if (detailSummaryBtn) on(detailSummaryBtn, "click", () => requestDerivedAnswer("detail"));
  monitorAnswerContainer();
}

function showAnswerFooter() {
  if (footerVisible) return;
  if (!answerFooter) answerFooter = document.getElementById("answerFooterFixed");
  if (!answerFooter) return;
  answerFooter.classList.remove("hidden");
  footerVisible = true;
}

function monitorAnswerContainer() {
  const container = document.getElementById("liveAnswer");
  if (!container) return;
  const refresh = () => {
    const lastChild = container.lastElementChild;
    if (lastChild) {
      lastAnswerText = String(lastChild.textContent || "").trim() || lastAnswerText;
      showAnswerFooter();
    }
  };
  refresh();
  const observer = new MutationObserver(() => {
    if (container.childElementCount > 0) refresh();
  });
  observer.observe(container, { childList: true, subtree: false });
}

async function requestDerivedAnswer(type) {
  const prefix = DERIVED_PROMPTS[type];
  if (!prefix || !lastAnswerText) return;
  try {
    setState("answering");
    const response = await window.enqueueChannelRequest("chat", () =>
      window.electronAPI.ask(`${prefix}${lastAnswerText}`)
    );
    const final = response?.answer || response?.text || response || "";
    appendAnswerBlock(final);
  } catch (err) {
    appendAnswerBlock("Error: " + (err?.message || err));
  } finally {
    setState("idle");
  }
}

document.addEventListener("DOMContentLoaded", () => {

  debugLog("DOM fully loaded");
  setupAnswerFooterControls();

});



// ------------------ Helpers ------------------

const $  = (sel) => document.querySelector(sel);

const $$ = (sel) => Array.from(document.querySelectorAll(sel));

const on = (el, ev, fn) => el && el.addEventListener(ev, fn);

function initiateLocationDetection() {
  const api = window.electronAPI;
  if (!api) return;
  if (!navigator.geolocation) {
    api.requestIpLocation();
    return;
  }
  let resolved = false;
  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      if (resolved) return;
      resolved = true;
      await api.setLocation({
        lat: pos.coords.latitude,
        lon: pos.coords.longitude,
        source: "browser"
      });
    },
    async () => {
      if (resolved) return;
      resolved = true;
      await api.requestIpLocation();
    },
    { timeout: 7000, maximumAge: 5 * 60 * 1000 }
  );
}
// =====================================================

//   UNIVERSAL ANSWER PIPELINE (SAFE + NO RECURSION)

// =====================================================

async function unifiedAsk(promptText) {

  try {

    const userPrompt = String(promptText || "").trim();

    if (!userPrompt) return;



    appendTranscriptLine(`You: ${userPrompt}`);

    setState("answering");

    const response = await window.enqueueChannelRequest("chat", () =>
      window.electronAPI.ask(userPrompt)
    );

    let final = '';
    if (typeof response === "string") {
      final = response;
    } else if (response?.answer) {
      final = response.answer;
    } else if (response?.text) {
      final = response.text;
    } else if (response) {
      final = JSON.stringify(response);
    }

    const cleaned = String(final || '').trim();
    appendAnswerBlock(cleaned || "I couldn't generate an answer. Please try again.");

    setState("idle");



  } catch (err) {

    debugLog("[Renderer unifiedAsk ERROR]", err);

    appendAnswerBlock("Error: " + err.message);

    setState("idle");

  }

}


// Force textarea as the single transcript sink

const transcriptSink = document.getElementById('liveTranscript');

const transcriptContainer = document.getElementById('transcript-container');

const answerBox = document.querySelector('.answer-box');

window.__useGroqFastMode = true;
let __turns = [];
let screenRegionCache = null;
let overlayInjected = false;
let overlayActive = false;

function ensureRegionStyle() {
  if (overlayInjected) return;
  overlayInjected = true;
  const style = document.createElement("style");
  style.id = "screen-region-style";
  style.textContent = `
.screen-region-overlay {
  position: fixed;
  inset: 0;
  background: rgba(5, 8, 16, 0.5);
  z-index: 99999;
  display: flex;
  justify-content: center;
  align-items: center;
}
.screen-region-selector {
  position: absolute;
  border: 2px dashed #40c4ff;
  background: rgba(64, 196, 255, 0.15);
  box-shadow: 0 0 12px rgba(64, 196, 255, 0.6);
  cursor: move;
}
.screen-region-selector .handle {
  position: absolute;
  width: 14px;
  height: 14px;
  background: #fff;
  border: 1px solid #40c4ff;
  border-radius: 3px;
}
.screen-region-selector .handle[data-dir="nw"] { top: -7px; left: -7px; cursor: nwse-resize; }
.screen-region-selector .handle[data-dir="ne"] { top: -7px; right: -7px; cursor: nesw-resize; }
.screen-region-selector .handle[data-dir="sw"] { bottom: -7px; left: -7px; cursor: nesw-resize; }
.screen-region-selector .handle[data-dir="se"] { bottom: -7px; right: -7px; cursor: nwse-resize; }
.screen-region-controls {
  position: absolute;
  bottom: 30px;
  right: 30px;
  display: flex;
  gap: 8px;
}
.screen-region-controls button {
  padding: 8px 12px;
  border: none;
  border-radius: 4px;
  background: #111c2a;
  color: #fff;
  font-weight: 500;
  cursor: pointer;
}
.screen-region-hint {
  position: absolute;
  top: 20px;
  left: 20px;
  padding: 6px 10px;
  background: rgba(0, 0, 0, 0.7);
  color: #fff;
  border-radius: 4px;
  font-size: 13px;
  max-width: 260px;
}
.screen-region-controls-panel {
  position: fixed;
  bottom: 20px;
  right: 20px;
  display: flex;
  gap: 8px;
  z-index: 100000;
}
.screen-region-controls-panel button {
  padding: 8px 14px;
  border: none;
  border-radius: 4px;
  background: #0d1b33;
  color: #fff;
  font-weight: 600;
  cursor: pointer;
}

.screenread-clean #liveLog {
  display: none !important;
}
`;
  document.head.appendChild(style);
}

function setCaptureClean(enable) {
  document.documentElement.classList.toggle("screenread-clean", !!enable);
}

function clampSelection(sel, bounds) {
  const clamped = { ...sel };
  clamped.width = Math.max(40, Math.min(clamped.width, bounds.width));
  clamped.height = Math.max(40, Math.min(clamped.height, bounds.height));
  clamped.x = Math.max(0, Math.min(clamped.x, bounds.width - clamped.width));
  clamped.y = Math.max(0, Math.min(clamped.y, bounds.height - clamped.height));
  return clamped;
}

async function showRegionSelector(initialRegion = null) {
  if (overlayActive) return null;
  overlayActive = true;
  ensureRegionStyle();
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "screen-region-overlay";
    overlay.tabIndex = -1;

    const selector = document.createElement("div");
    selector.className = "screen-region-selector";
    overlay.appendChild(selector);

    const hint = document.createElement("div");
    hint.className = "screen-region-hint";
    hint.textContent = "Drag the box or draw a new area. Resize with the corners, then Confirm.";
    overlay.appendChild(hint);

    const controls = document.createElement("div");
    controls.className = "screen-region-controls-panel";
    controls.innerHTML = `<button data-action="confirm">Confirm</button><button data-action="cancel">Cancel</button>`;
    document.body.appendChild(controls);

    const handles = ["nw", "ne", "sw", "se"].map((dir) => {
      const handle = document.createElement("div");
      handle.className = "handle";
      handle.dataset.dir = dir;
      selector.appendChild(handle);
      return handle;
    });

    document.body.appendChild(overlay);

    const bounds = overlay.getBoundingClientRect();
    let selection = {
      x: bounds.width / 2 - 150,
      y: bounds.height / 2 - 100,
      width: 300,
      height: 200
    };
    if (initialRegion && typeof initialRegion.x === "number") {
      const relX = initialRegion.x - window.screenX;
      const relY = initialRegion.y - window.screenY;
      selection = {
        x: relX,
        y: relY,
        width: initialRegion.width,
        height: initialRegion.height
      };
    }
    let action = null;
    let pointerId = null;
    let startCoord = null;
    let startSelection = null;

    function updateSelection() {
      const clamped = clampSelection(selection, bounds);
      selection = clamped;
      selector.style.left = `${selection.x}px`;
      selector.style.top = `${selection.y}px`;
      selector.style.width = `${selection.width}px`;
      selector.style.height = `${selection.height}px`;
    }

    updateSelection();

    function cleanup(result) {
      overlay.remove();
      overlayActive = false;
      controls.remove();
      resolve(result);
    }

    function toRelative(e) {
      return {
        x: e.clientX - bounds.left,
        y: e.clientY - bounds.top
      };
    }

    function onPointerDown(e) {
      if (e.pointerType !== "mouse") return;
      const target = e.target;
      pointerId = e.pointerId;
      startCoord = toRelative(e);
      startSelection = { ...selection };
      if (target.dataset?.dir) {
        action = { type: "resize", dir: target.dataset.dir };
      } else if (target === selector) {
        action = { type: "move" };
      } else {
        action = { type: "draw" };
        selection = {
          x: startCoord.x,
          y: startCoord.y,
          width: 0,
          height: 0
        };
        updateSelection();
      }
      overlay.setPointerCapture(pointerId);
    }

    function onPointerMove(e) {
      if (!action || e.pointerId !== pointerId) return;
      const current = toRelative(e);
      const dx = current.x - startCoord.x;
      const dy = current.y - startCoord.y;
      if (action.type === "draw") {
        selection = {
          x: Math.min(startCoord.x, current.x),
          y: Math.min(startCoord.y, current.y),
          width: Math.abs(dx),
          height: Math.abs(dy)
        };
      } else if (action.type === "move") {
        selection = {
          ...selection,
          x: startSelection.x + dx,
          y: startSelection.y + dy
        };
      } else if (action.type === "resize") {
        const sel = { ...selection };
        switch (action.dir) {
          case "nw":
            sel.x = startSelection.x + dx;
            sel.y = startSelection.y + dy;
            sel.width = startSelection.width - dx;
            sel.height = startSelection.height - dy;
            break;
          case "ne":
            sel.y = startSelection.y + dy;
            sel.width = startSelection.width + dx;
            sel.height = startSelection.height - dy;
            break;
          case "sw":
            sel.x = startSelection.x + dx;
            sel.width = startSelection.width - dx;
            sel.height = startSelection.height + dy;
            break;
          case "se":
            sel.width = startSelection.width + dx;
            sel.height = startSelection.height + dy;
            break;
        }
        selection = sel;
      }
      updateSelection();
    }

    function onPointerUp(e) {
      if (e.pointerId !== pointerId) return;
      action = null;
      pointerId = null;
      overlay.releasePointerCapture(e.pointerId);
    }

    overlay.addEventListener("pointerdown", onPointerDown);
    overlay.addEventListener("pointermove", onPointerMove);
    overlay.addEventListener("pointerup", onPointerUp);
    overlay.addEventListener("pointerleave", onPointerUp);

    function releasePointer() {
      if (pointerId) {
        overlay.releasePointerCapture(pointerId);
        pointerId = null;
        action = null;
      }
    }

    controls.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-action]");
      if (!button) return;
      const actionType = button.dataset.action;
      console.log("[screen] selector action", actionType);
      releasePointer();
      if (actionType === "confirm") {
        const region = {
          x: Math.max(0, Math.min(selection.x, bounds.width - selection.width)),
          y: Math.max(0, Math.min(selection.y, bounds.height - selection.height)),
          width: selection.width,
          height: selection.height
        };
        const savedRegion = clampToWindow({
          x: window.screenX + region.x,
          y: window.screenY + region.y,
          width: region.width,
          height: region.height
        });
        console.log("[screen] selector confirmed region", savedRegion);
        cleanup(savedRegion);
      } else if (actionType === "cancel") {
        console.log("[screen] selection canceled by user");
        cleanup(null);
      }
    });
  });
}

function clampToWindow(region) {
  if (!region) return region;
  const appBounds = {
    x: window.screenX,
    y: window.screenY,
    width: window.innerWidth,
    height: window.innerHeight
  };
  const result = { ...region };
  result.x = Math.max(appBounds.x, Math.min(region.x, appBounds.x + appBounds.width - region.width));
  result.y = Math.max(appBounds.y, Math.min(region.y, appBounds.y + appBounds.height - region.height));
  result.width = Math.max(10, Math.min(region.width, appBounds.width - (result.x - appBounds.x)));
  result.height = Math.max(10, Math.min(region.height, appBounds.height - (result.y - appBounds.y)));
  return result;
}

async function persistScreenRegion(region) {
  if (!region || typeof region.x !== "number" || region.width <= 0 || region.height <= 0) {
    return null;
  }
  try {
    const result = await window.electronAPI.saveScreenReadRegion(region);
    console.log("[screen] save region result", result);
  } catch (err) {
    console.error("[screen] save region error", err);
  }
  screenRegionCache = region;
  return screenRegionCache;
}

async function inlineScreenRegion(initialRegion = null) {
  const selected = await showRegionSelector(initialRegion);
  if (!selected) return null;
  await persistScreenRegion(selected);
  return selected;
}

async function selectScreenRegion() {
  let storedRegion = null;
  try {
    const stored = await window.electronAPI.getScreenReadRegion();
    storedRegion = stored?.region || null;
    console.log("[screen] stored region response", stored);
  } catch (err) {
    console.error("[screen] read region error", err);
  }

  const initialRegion = screenRegionCache || storedRegion || null;
  if (initialRegion && !screenRegionCache) {
    screenRegionCache = initialRegion;
  }

  if (window.electronAPI?.openScreenOverlay) {
    try {
      const overlayRes = await window.electronAPI.openScreenOverlay(initialRegion);
      console.log("[screen] overlay helper response", overlayRes);
      if (overlayRes?.ok && overlayRes.region?.width > 4 && overlayRes.region?.height > 4) {
        return await persistScreenRegion(overlayRes.region);
      }
    } catch (err) {
      console.error("[screen] overlay helper error", err);
    }
  }

  const inlineSelection = await inlineScreenRegion(initialRegion);
  if (inlineSelection) return inlineSelection;
  return storedRegion || screenRegionCache || null;
}

function recordSummaryTurn(role, text) {
  if (!role) return;
  const normalized = String(text || "").trim();
  if (!normalized) return;
  const entry = { role, text: normalized };
  const last = __turns[__turns.length - 1];
  if (last?.role === entry.role && last?.text === entry.text) return;
  __turns.push(entry);
}

window.__recordSummaryTurn = recordSummaryTurn;

function normalizeCapturedText(text) {
  if (!text) return "";
  const lines = String(text)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const filtered = [];
  for (const line of lines) {
    if (/^\[?screen/i.test(line)) continue;
    if (/^ln\s*\d+/i.test(line)) continue;
    if (/^col\s*\d+/i.test(line)) continue;
    if (/^{/.test(line)) continue;
    filtered.push(line);
  }
  return filtered.join("\n");
}
// collapse transcript/answer until user interacts

if (transcriptContainer) transcriptContainer.classList.add('panel-collapsed');

if (answerBox) answerBox.classList.add('panel-collapsed');



function revealPanels() {

  transcriptContainer?.classList.remove('panel-collapsed');

  answerBox?.classList.remove('panel-collapsed');

}

// In case there is prefilled content (restored state), reveal on load

document.addEventListener('DOMContentLoaded', () => {

  const transcriptHasText = (transcriptSink?.value || '').trim().length > 0;

  const answerHasChildren = !!document.getElementById('liveAnswer')?.children.length;

  if (transcriptHasText || answerHasChildren) revealPanels();
  initiateLocationDetection();

});



// --- Harden transcript as display-only (no typing/paste/drop) ---

function hardenTranscript(el) {

  if (!el) return;

  el.readOnly = true;

  el.setAttribute('aria-readonly', 'true');

  el.setAttribute('contenteditable', 'false');

  el.setAttribute('spellcheck', 'false');

  el.setAttribute('autocomplete', 'off');

  el.setAttribute('autocorrect', 'off');

  el.setAttribute('autocapitalize', 'off');



  el.addEventListener('keydown', (e) => {

    const k = e.key.toLowerCase();

    const allowNav = ['arrowleft','arrowright','arrowup','arrowdown','home','end','pageup','pagedown','tab','escape'].includes(k);

    const allowCopyAll = (e.ctrlKey || e.metaKey) && (k === 'c' || k === 'a');

    if (!(allowNav || allowCopyAll)) e.preventDefault();

  });

  el.addEventListener('paste', (e) => e.preventDefault());

  el.addEventListener('drop',  (e) => e.preventDefault());

  el.addEventListener('cut',   (e) => e.preventDefault());

}



// call it once

hardenTranscript(transcriptSink);



// Make transcript display-only (defensive)

if (transcriptSink) {

  if ('readOnly' in transcriptSink) transcriptSink.readOnly = true;

  transcriptSink.setAttribute('contenteditable', 'false');

}



// --- Unified transcript helpers (used for both typed + spoken lines) ---

function _appendTranscript(line, cls) {

  if (!transcriptSink) return;

  const s = String(line || '').trim();

  if (!s) return;



  if ('value' in transcriptSink) {

    const ta = transcriptSink;

    const needsSep = ta.value && !ta.value.endsWith('\n');

    ta.value += (needsSep ? '\n' : '') + s + '\n';

    ta.scrollTop = ta.scrollHeight;

  } else {

    const div = document.createElement('div');

    div.className = cls || 'bubble me';

    div.textContent = s;

    transcriptSink.style.height = "115px";

    transcriptSink.appendChild(div);

    transcriptSink.scrollTop = transcriptSink.scrollHeight;

  }

}

// --- Answer rendering: virtualized list + streaming helpers ---

const ALL_ANSWERS = []; // { text, maxLen }

const MAX_RENDERED = 10;

const DEFAULT_MAX_LEN = 150;

const DETAIL_MAX_LEN = 300;

const STREAM_MAX_LEN = 150;

const STREAM_LINE_LIMIT = 6;

let activeStream = null;

let chunkBuffer = '';

let chunkTimer = null;

let currentStreamRequestId = null;

function ensureStreamActive(id) {
  if (!id) return false;
  if (currentStreamRequestId && currentStreamRequestId !== id) return false;
  if (!currentStreamRequestId) {
    currentStreamRequestId = id;
    beginStreamingAnswer();
  }
  return true;
}


function normalizeAnswer(text) {
  return String(text || "").trim();
}




function shouldRenderSlot(index) {

  return (index % 4) < 2; // 2 on / 2 off pattern

}



function maybeAutoScroll(container) {

  const host = document.getElementById('liveAnswerContainer') || container;

  if (!host) return;

  const buffer = 120;

  const nearBottom = (host.scrollHeight - host.scrollTop - host.clientHeight) < buffer;

  if (!nearBottom) return;

  requestAnimationFrame(() => { host.scrollTop = host.scrollHeight; });

}

// ---- Virtualized Chat Renderer ----

const VIRTUAL_WINDOW = 3; // render 1 above, 1 current, 1 below
let lastScrollTop = 0;

function renderAnswersVirtualized() {
  const container = document.getElementById("liveAnswer");
  if (!container) return;

  const h = container.clientHeight;
  const st = container.scrollTop;

  // Estimate which answer index is visible (rough approximation)
  const avgHeight = 250; // adjust if needed
  const visibleIndex = Math.floor(st / avgHeight);

  const start = Math.max(0, visibleIndex - 1);
  const end = Math.min(ALL_ANSWERS.length - 1, visibleIndex + 1);

  // Clear container
  container.innerHTML = "";

  // Render only 3 items
  for (let i = start; i <= end; i++) {
    const ans = ALL_ANSWERS[i];
    const wrap = document.createElement("div");
    wrap.className = "answer-entry v-item";

    const div = document.createElement("div");
    div.className = "answer-block";
    div.textContent = ans.text;
    div.style.whiteSpace = "pre-wrap";

    wrap.appendChild(div);

    // Fill vertical space as if all answers existed
    wrap.style.paddingTop = i === start ? (start * avgHeight) + "px" : "0px";
    wrap.style.paddingBottom = (ALL_ANSWERS.length - end - 1) * avgHeight + "px";

    container.appendChild(wrap);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const container = document.getElementById("liveAnswer");
  if (!container) return;

  container.addEventListener("scroll", () => {
    const st = container.scrollTop;
    if (Math.abs(st - lastScrollTop) > 100) {
      lastScrollTop = st;
      renderAnswersVirtualized();
    }
  });
});




function beginStreamingAnswer() {

  finalizeStreamingAnswer('');

  activeStream = { text: '', maxLen: STREAM_MAX_LEN };

  chunkBuffer = '';

  chunkTimer = null;

  appendAnswerBlock('...', STREAM_MAX_LEN);

}



function flushStream() {
  if (!activeStream || !chunkBuffer) {
    chunkBuffer = '';
    chunkTimer = null;
    return;
  }

  const combined = (activeStream.text || '') + chunkBuffer;

  // FIX: Correct line splitting
  const linesArr = combined.split(/\r?\n/);
  const lastLines = linesArr.slice(-STREAM_LINE_LIMIT).join('\n');

  activeStream.text = normalizeAnswer(lastLines, activeStream.maxLen);

  if (ALL_ANSWERS.length) {
    ALL_ANSWERS[ALL_ANSWERS.length - 1].text = activeStream.text;
    renderAnswersVirtualized();

  }

  chunkBuffer = '';
  chunkTimer = null;
}



function appendStreamingChunk(chunk) {

  if (!activeStream) return;

  chunkBuffer += chunk || '';

  if (!chunkTimer) {

    chunkTimer = setTimeout(flushStream, 80);

  }

}



function finalizeStreamingAnswer(finalText) {
  if (chunkTimer) {
    clearTimeout(chunkTimer);
    chunkTimer = null;
  }

  if (activeStream) {
    let textCandidate = finalText || activeStream.text || '';
    let finalNorm = normalizeAnswer(textCandidate, activeStream.maxLen);

    if (!finalNorm) {
      finalNorm = 'No answer (stream returned empty).';
    }

    lastAnswerText = finalNorm;
    showAnswerFooter();

    // Update internal ALL_ANSWERS list
    if (ALL_ANSWERS.length) {
      ALL_ANSWERS[ALL_ANSWERS.length - 1].text = finalNorm;
    } else if (finalNorm) {
      ALL_ANSWERS.push({ text: finalNorm, maxLen: activeStream.maxLen });
    }

    // -------------------------------------------------------
    // NEW: Save to the last turn block
    // -------------------------------------------------------
    if (__turns.length > 0) {
      __turns[__turns.length - 1].haloryn = finalNorm;
    }

    activeStream = null;
    chunkBuffer = '';

    // Update UI
    renderAnswersVirtualized();
    return;
  }

  // Non-stream fallback
  if (finalText) {
    appendAnswerBlock(finalText);

    // Also save fallback to last turn
    if (__turns.length > 0) {
      __turns[__turns.length - 1].haloryn = finalText;
    }
  }
}


window.__askDirect = async function(prompt) {
  try {
    const clean = String(prompt || "").trim();
    if (!clean) return;

    setState("answering");
    const res = await window.enqueueChannelRequest("chat", () =>
      window.electronAPI.ask(clean)
    );

    const final = res?.answer || res?.text || res || "";
    appendAnswerBlock(final);

    setState("idle");
  } catch (e) {
    appendAnswerBlock("Error: " + e.message);
    setState("idle");
  }
};


function handleStreamStart(payload) {
  ensureStreamActive(payload?.id);
}


function handleStreamChunk(payload) {
  if (!payload) return;
  if (!ensureStreamActive(payload.id)) return;
  appendStreamingChunk(payload.chunk || '');
}



function handleStreamFinal(payload) {

  if (!payload) return;
  const text = payload.text || '';
  if (!ensureStreamActive(payload.id)) {
    if (text) appendAnswerBlock(text);
    return;
  }

  finalizeStreamingAnswer(text || '');
  currentStreamRequestId = null;

  if (!text) {
    appendAnswerBlock('No answer (stream returned empty).');
  }

}

function handleStreamError(payload) {

  if (payload?.id === currentStreamRequestId) {

    finalizeStreamingAnswer(payload?.text || '');

    currentStreamRequestId = null;

  }

  if (payload?.error) {

    appendAnswerBlock(`Error: ${payload.error}`);

  }

}









// De-dupe helper to avoid double lines (from IPC + companion overlap)

let __lastLine = '';

function _appendDedup(prefix, text, cls) {

  const body = String(text || '').trim();

  if (!body) return;

  const line = prefix ? `${prefix} ${body}` : body;

  if (line === __lastLine) return;

  __lastLine = line;

  _appendTranscript(line, cls);

}



function pickFirst(...els) { return els.find(Boolean) || null; }



function appendLog(line) {

  if (!ALLOW_UI_LOGS) return;

  const liveLog = $('#liveLog');

  if (!liveLog) return;

  const s = String(line ?? '');

  liveLog.value += (s.endsWith('\n') ? s : s + '\n');

  const lines = liveLog.value.split(/\r?\n/);

  if (lines.length > MAX_UI_LOG_LINES) {

    liveLog.value = lines.slice(-MAX_UI_LOG_LINES).join('\n');

  }

  liveLog.scrollTop = liveLog.scrollHeight;

}











// ------------------ API usage panel helpers ------------------

const apiStats = {};



function renderApiUsagePanel(){

  const panel = $('#apiUsagePanel');

  if (!panel) return;

  const statsArr = Object.values(apiStats);

  if (!statsArr.length){

    panel.innerHTML = '<div class="api-usage-empty">No API calls yet in this session.</div>';

    return;

  }

  statsArr.sort((a,b) => a.provider.localeCompare(b.provider));

  panel.innerHTML = statsArr.map(s => `

    <div class="api-usage-row">

      <div class="api-usage-name">${s.provider}</div>

      <div class="api-usage-metrics">

        <span class="api-usage-pill">Calls: ${s.calls}</span>

        ${s.limit != null && s.remaining != null ? `<span class="api-usage-pill">Remaining: ${s.remaining}/${s.limit}</span>` : ''}

        ${s.lastMs != null ? `<span class="api-usage-pill">Last: ${s.lastMs} ms</span>` : ''}

        ${s.lastKind ? `<span class="api-usage-pill kind">${s.lastKind}</span>` : ''}

        ${s.lastAt ? `<span class="api-usage-pill time">${s.lastAt}</span>` : ''}

      </div>

    </div>

  `).join('');

}

// NEW: periodically pull provider stats from main.js (searchRouter.getProviderStats)

async function refreshApiUsageFromBackend(){

  if (!window.electron?.invoke) return;

  try{

    const res = await window.electron.invoke('search:stats');

    if (!res || !res.ok || !res.stats) return;

    const stats = res.stats;

    Object.entries(stats).forEach(([provider, s]) => {

      if (!apiStats[provider]) {

        apiStats[provider] = {

          provider,

          calls: 0,

          lastKind: '',

          lastMs: null,

          lastAt: '',

          limit: null,

          remaining: null

        };

      }

      const st = apiStats[provider];

      // Prefer backend "used" count but don't overwrite if it's missing

      if (s && typeof s.used === 'number') {

        st.calls = s.used;

      }

    });

    renderApiUsagePanel();

  }catch(e){

    // silent fail ΓÇö we don't want to spam the log for polling errors

  }

}



function handleApiLogLine(line){

  const raw = String(line || '');

  if (!/^\s*\[api\]/i.test(raw)) return;

  const s = raw.replace(/^\s*\[api\]\s*/i,'').trim();

  const parts = s.split(/\s+/);

  const kv = {};

  for (const tok of parts){

    const idx = tok.indexOf('=');

    if (idx <= 0) continue;

    const k = tok.slice(0, idx).toLowerCase();

    let v = tok.slice(idx+1);

    v = v.replace(/^"+|"+$/g, '');

    kv[k] = v;

  }

  const provider = kv.provider || 'unknown';

  if (!apiStats[provider]){

    apiStats[provider] = {

      provider,

      calls: 0,

      lastKind: '',

      lastMs: null,

      lastAt: '',

      limit: null,

      remaining: null

    };

  }

  const st = apiStats[provider];

  st.calls += 1;

  if (kv.kind) st.lastKind = kv.kind;

  if (kv.ms && !Number.isNaN(Number(kv.ms))) st.lastMs = Number(kv.ms);

  if (kv.limit && !Number.isNaN(Number(kv.limit))) st.limit = Number(kv.limit);

  if (kv.remaining && !Number.isNaN(Number(kv.remaining))) st.remaining = Number(kv.remaining);

  try{

    const now = new Date();

    st.lastAt = now.toLocaleTimeString();

  }catch{}

  renderApiUsagePanel();

}



// ------------------ Doc toggle + DocEnrich wiring ------------------

const docToggle       = $('#docToggle');

const docEnrichToggle = $('#docEnrichToggle');

const searchModeSelect = $('#searchMode');



function setDocToggle(on) {

  if (!docToggle) return;

  const active = !!on;

  docToggle.classList.toggle('active', active);

  docToggle.textContent = active ? 'Doc ΓÇó ON' : 'Doc';

}



function setDocEnrichToggle(on) {

  if (!docEnrichToggle) return;

  const active = !!on;

  docEnrichToggle.classList.toggle('active', active);

  docEnrichToggle.textContent = active ? 'Enrich ΓÇó ON' : 'Enrich';

}



// If the button exists, wire click ΓåÆ backend doc:setUse

on(docToggle, 'click', async () => {

  if (!docToggle) return;

  const next = !docToggle.classList.contains('active');

  setDocToggle(next);

  try {

    const res = await window.electron.invoke('doc:setUse', next);

    appendLog(`[doc] mode ${res?.useDoc ? 'ON' : 'OFF'}`);

  } catch (e) {

    appendLog(`[doc] toggle error: ${e.message}`);

  }

});



// DocEnrich toggle ΓåÆ backend doc:enrich:set

on(docEnrichToggle, 'click', async () => {

  if (!docEnrichToggle) return;

  const next = !docEnrichToggle.classList.contains('active');

  setDocEnrichToggle(next);

  try {

    const res = await window.electron.invoke('doc:enrich:set', next);

    appendLog(`[doc] enrich ${res?.docEnrich ? 'ON' : 'OFF'}`);

  } catch (e) {

    appendLog(`[doc] enrich toggle error: ${e.message}`);

  }

});



// Search mode dropdown ΓåÆ backend searchPrefs:set

on(searchModeSelect, 'change', async () => {

  if (!searchModeSelect) return;

  const mode = searchModeSelect.value || 'fastest';

  try {

    const res = await window.electron.invoke('searchPrefs:set', { mode });

    appendLog(`[search] mode=${res?.mode || mode}`);

  } catch (e) {

    appendLog(`[search] prefs error: ${e.message}`);

  }

});



function setState(txt) {

  const el = $('#liveState');

  if (el) {

    el.textContent = txt;

    const on = /listening|starting/i.test(String(txt || ''));

    el.classList.toggle('pulsing', on);

  }

}



// Drop ΓÇ£banner/statusΓÇ¥ lines from Answer/Companion sinks

function isStatusyBanner(t) {

  if (!t) return false;

  const s = String(t);

  return (

    /Live Companion is ON/i.test(s) ||

    /^\s*No material changes\./i.test(s) ||

    /^(Summary:|Action Items|From the web:)/i.test(s) ||

    /\b(PDF support not installed|PDF load error|Web\+\s+(enabled|disabled))\b/i.test(s) ||

    /^\s*Tip:\s+/i.test(s) ||

    /^\s*Status:\s+/i.test(s)

  );

}



// ------------------ Tabs ------------------

(function wireTabs(){

  const tabs = $$('.tab');

  const panels = {

    live: $('#tab-live'),

    pre:  $('#tab-pre'),

    logs: $('#tab-logs')

  };

  tabs.forEach(t => on(t, 'click', () => {

    tabs.forEach(x => x.classList.remove('active'));

    t.classList.add('active');

    Object.values(panels).forEach(p => p && p.classList.remove('show'));

    const key = t.dataset.tab;

    const target = panels[key] || panels.live;

    if (target) target.classList.add('show');

    if (key === 'live') revealPanels();

  }));

})();



// ------------------ Window controls ------------------

on($('#btn-min'), 'click', () => window.windowCtl?.minimize());

on($('#btn-max'), 'click', () => window.windowCtl?.maximize());

on($('#btn-close'), 'click', async () => { await sendSessionSummary();   });




// ------------------ Live controls ------------------

const btnStart = pickFirst($('#startBtn'), $('[data-action="start"]'), $('[title="Start"]'));

const btnStop  = pickFirst($('#stopBtn'),  $('[data-action="stop"]'),  $('[title="Stop"]'));



const liveTranscript = $('#liveTranscript') || document.querySelector('#tab-live textarea');
const liveTranscriptStream = document.getElementById('liveTranscriptStream');
const liveTranscriptStreamText = document.getElementById('liveTranscriptStreamText');

const liveStatus = $('#liveStatus');



const incognitoToggle = $('#incognitoToggle');

const companionToggle = $('#companionToggle');

const micIcon = '🎤';

if (companionToggle) companionToggle.textContent = micIcon;

const transcriptEl    = $('#liveTranscript');

const answerEl        = $('#liveAnswer');

const screenReadBtn = $('#screenReadBtn');

const clearAnswer     = $('#clearAnswer');

const chatInput = $('#chatInput');

const chatSend = $('#chatSend');

const userChip = $('#userChip');

const userName = $('#userName');

const userProvider = $('#userProvider');

const chrome = document.querySelector('.window-chrome');

const userMenu = document.getElementById("userMenu");

const menuAccount = document.getElementById("menuAccount");

const menuSignout = document.getElementById("menuSignout");









// --- Single Transcript helpers ---

let _txSeenLen = 0;

let _txLastLine = '';



function _ensureTrailingNewline(el){

  if (el && !el.value.endsWith('\n')) el.value += '\n';

}



function appendTranscriptLine(line) {

  revealPanels();

  const box = document.getElementById("transcript");

  if (!box) return;



  const text = typeof line === "string" ? line : JSON.stringify(line);

  const s = text.trim();

  if (!s) return;



  box.value += (box.value ? "\n" : "") + s;

  box.scrollTop = box.scrollHeight;

}



function appendTranscriptChunk(chunk){

  const parts = String(chunk || '').split(/\r?\n+/).map(p => p.trim()).filter(Boolean);

  parts.forEach(p => appendTranscriptLine(`≡ƒÄÖ ${p}`));

}



function setTranscriptText(s) {

  if (liveTranscript) {

    liveTranscript.value = (s || '');

    _ensureTrailingNewline(liveTranscript);

    liveTranscript.scrollTop = liveTranscript.scrollHeight;

  }

}

const LIVE_STREAM_CHUNK_WORDS = 8;
const LIVE_STREAM_INTERVAL_MS = 120;
const LIVE_STREAM_QUEUE_LIMIT = 160;
const LIVE_STREAM_PULSE_MS = 200;

let liveStreamQueue = [];
let liveStreamTimer = null;

function updateLiveTranscriptStream(text, active = true) {
  if (!liveTranscriptStreamText) return;
  const payload = active && text ? `You: ${text}` : (text || 'Listening…');
  liveTranscriptStreamText.textContent = payload;
  if (liveTranscriptStream && active) {
    liveTranscriptStream.classList.add('is-active');
    setTimeout(() => liveTranscriptStream?.classList.remove('is-active'), LIVE_STREAM_PULSE_MS);
  }
}

function resetLiveTranscriptStream(placeholder = 'Listening…') {
  liveStreamQueue = [];
  if (liveStreamTimer) {
    clearTimeout(liveStreamTimer);
    liveStreamTimer = null;
  }
  updateLiveTranscriptStream(placeholder, false);
}

function queueLiveTranscriptWords(text) {
  const words = String(text || '').split(/\s+/).map(w => w.trim()).filter(Boolean);
  if (!words.length) return;
  liveStreamQueue.push(...words);
  if (liveStreamQueue.length > LIVE_STREAM_QUEUE_LIMIT) {
    liveStreamQueue.splice(0, liveStreamQueue.length - LIVE_STREAM_QUEUE_LIMIT);
  }
  if (!liveStreamTimer) {
    flushLiveTranscriptStream();
  }
}

function flushLiveTranscriptStream() {
  if (!liveTranscriptStreamText) {
    liveStreamQueue = [];
    liveStreamTimer = null;
    return;
  }

  if (!liveStreamQueue.length) {
    liveStreamTimer = null;
    return;
  }

  const chunkWords = liveStreamQueue.splice(0, LIVE_STREAM_CHUNK_WORDS);
  const joined = chunkWords.join(' ');
  updateLiveTranscriptStream(joined, !!joined);
  liveStreamTimer = setTimeout(flushLiveTranscriptStream, LIVE_STREAM_INTERVAL_MS);
}

resetLiveTranscriptStream();

//---------------------------------------------

// SCREEN READ (Background capture)
// ---------------------------------------------
on(screenReadBtn, "click", async () => {
  if (!screenReadBtn) return;
  screenReadBtn.disabled = true;
  screenReadBtn.classList.add("active");
  setState("screen: capturing...");
  console.log("[screen] capture requested");
  window.windowCtl?.minimize();
  const region = await selectScreenRegion();
  window.windowCtl?.restore();
  if (!region) {
    appendLog("[screen] region not configured");
    screenReadBtn.disabled = false;
    screenReadBtn.classList.remove("active");
    setState("idle");
    return;
  }
  window.windowCtl?.minimize();
  try {
    setCaptureClean(true);
    const res = await window.electronAPI.captureScreenBelow(region);
    console.log("[screen] capture response", res);
    if (res?.base64) {
      console.log("[screen] base64 length", res.base64.length);
    }
    if (!res?.ok) {
      appendLog("[screen] capture failed: " + (res?.error || "no data"));
      return;
    }
    if (!res?.base64 || typeof res.base64 !== "string" || res.base64.length < 10) {
      appendLog("[screen] invalid or empty capture — skipping OCR");
      console.log("[screen] invalid capture payload:", res);
      return;
    }

    console.log("[screen] sending capture to OCR");
    window.electron.send("ocr:image", { base64: res.base64 });

  } catch (err) {
    appendLog("[screen] capture error: " + (err?.message || err));
  } finally {
    setCaptureClean(false);
    screenReadBtn.disabled = false;
    screenReadBtn.classList.remove("active");
    window.windowCtl?.restore();
    setState("idle");
  }
});

// --- Incognito (hide taskbar/tray + block screen capture; keep app visible) ---

function setIncognitoUI(on) {

  if (!incognitoToggle) return;

  const active = !!on;

  incognitoToggle.classList.toggle("active", active);

  incognitoToggle.title = active

    ? "Incognito on. Press Ctrl+Shift+I to turn off."

    : "Hide taskbar/tray icons and block screen capture";

  document.body.classList.toggle("incognito", active);

  chrome?.classList.toggle("incognito", active);

}



if (incognitoToggle && window.electron?.invoke) {

  on(incognitoToggle, "click", async () => {

    const next = !incognitoToggle.classList.contains("active");

    try {

      const res = await window.electron.invoke("incognito:set", next);

      setIncognitoUI(res?.incognito);

      appendLog(res?.incognito

        ? "[incognito] ON (hidden from taskbar/tray; screen-share protected). Use Ctrl+Shift+I to turn off."

        : "[incognito] OFF");

    } catch (e) {

      appendLog(`[incognito] toggle error: ${e.message}`);

    }

  });



  (async () => {

    try {

      const res = await window.electron.invoke("incognito:get");

      setIncognitoUI(res?.incognito);

    } catch {}

  })();

}



// --- User session badge + logout ---

async function hydrateUserChip() {

  if (!userChip || !window.electron?.invoke) return;

  try {

    const session = await window.electron.invoke("get-user-session");

    const display = session?.displayName || session?.email || session?.phone || "";

    const provider = session?.provider ? session.provider.replace(/^[a-z]/, c => c.toUpperCase()) : "";

    if (display) {

      userName.textContent = display;

      userProvider.textContent = provider || "";

      userChip.classList.remove("hidden");

      if (menuAccount) menuAccount.textContent = `${display}${provider ? " ΓÇó " + provider : ""}`;

    } else {

      userChip.classList.add("hidden");

    }

  } catch (e) {

    appendLog(`[user] unable to load session: ${e.message}`);

  }

}

hydrateUserChip();



function toggleUserMenu(show) {

  if (!userMenu) return;

  const next = show ?? userMenu.classList.contains("hidden");

  if (next) userMenu.classList.remove("hidden"); else userMenu.classList.add("hidden");

}



on(userChip, "click", async () => {

  toggleUserMenu(true);

});



on(menuAccount, "click", async () => {

  toggleUserMenu(false);

  try {

    await window.electron?.invoke?.("load-user-info");

  } catch (e) {

    appendLog(`[user] account load failed: ${e.message}`);

  }

});



on(menuSignout, "click", async () => {

  toggleUserMenu(false);

  try {

    await window.electron.invoke("logout");

  } catch (e) {

    appendLog(`[user] logout failed: ${e.message}`);

  }

});



document.addEventListener("click", (e) => {

  if (!userMenu || userMenu.classList.contains("hidden")) return;

  if (userMenu.contains(e.target) || userChip?.contains(e.target)) return;

  toggleUserMenu(false);

});



//--------------------------------------------------

// HANDLE OCR TEXT RETURNED FROM main.js

//--------------------------------------------------

// ---------------- OCR → Transcript + AI ----------------
window.electron.on("ocr:text", async (_event, textRaw) => {
  try {
    // Ensure valid text
    if (!textRaw || typeof textRaw !== "string") {
      appendLog("[screen] invalid or null OCR textRaw");
      console.log("[screen] OCR received invalid payload:", textRaw);
      return;
    }

    const text = textRaw.trim();
    if (!text || text.length < 2) {
      appendLog("[screen] OCR returned empty - no AI call");
      console.log("[screen] ocr empty textRaw", textRaw);
      return;
    }

    const normalized = normalizeCapturedText(text);
    console.log("[screen] normalized OCR text", normalized);

    if (!normalized) {
      console.log("[screen] normalized text empty, skipping transcript");
      return;
    }

    if (liveTranscript) {
      const existing = (liveTranscript.value || "").trim();
      liveTranscript.value = (existing ? existing + "\n\n" : "") + normalized;
      liveTranscript.scrollTop = liveTranscript.scrollHeight;
    }

    if (chatInput) {
      chatInput.value = normalized;
      chatInput.focus();
    }

  } catch (err) {
    appendLog("[screen] OCR handler error: " + err.message);
    console.error("[screen] OCR handler full error:", err);
  } finally {
    window.windowCtl?.restore();
    setState("idle");
  }
});












// Start/Stop

on(btnStart, 'click', async () => {

  setState('startingΓÇª');

  try { await pushConfig(); } catch {}

  try {

    const r = await window.electron?.invoke('live:start');

    if (r?.ok) {

      _txSeenLen = 0;

      _txLastLine = '';

      setState('listening');

      setTranscriptText('ListeningΓÇª');
      resetLiveTranscriptStream();

    } else {

      setState('error');

    }

    document.body.classList.add('companion-on');

    btnStart?.classList.add('recording');

  } catch (e) {

    appendLog(`[ui] live:start error: ${e.message}`);

    setState('error');

  }

});



// STOP BUTTON HANDLER
on(btnStop, 'click', async () => {
  try { await window.electron?.invoke('live:stop'); } catch {}

  setState('idle');
  resetLiveTranscriptStream('Listening…');
  resetSpeechQueue();
  document.body.classList.remove('companion-on');
  btnStart?.classList.remove('recording');

  // 🟩 Build + send summary here
  sendSessionSummary();
});


// SPEECH SETTINGS
const SPEECH_IDLE_MS = 650;            // slightly longer pause to avoid mid-sentence triggers
const MAX_SPEECH_BUFFER_CHARS = 6000;  // allow longer speech before trimming

let _speechBuffer = [];
let _speechIdleTimer = null;


// SPEECH QUEUE HANDLER
function queueSpeechPrompt(text) {
  const clean = String(text || '').trim();
  if (!clean) return;

  _speechBuffer.push(clean);

  const joined = _speechBuffer.join(' ');
  if (joined.length > MAX_SPEECH_BUFFER_CHARS) {
    _speechBuffer = [joined.slice(-MAX_SPEECH_BUFFER_CHARS)];
  }

  if (_speechIdleTimer) clearTimeout(_speechIdleTimer);

  _speechIdleTimer = setTimeout(() => {
    const raw = _speechBuffer.join(' ');
    const prompt = raw.trim();

    _speechBuffer = [];
    _speechIdleTimer = null;

    if (!prompt || prompt.replace(/\s+/g, '').length < 2) return;

    // USER TURN
    recordSummaryTurn('user', prompt);

    window.enqueueChannelRequest("live", async () => {
      const res = await window.electronAPI.ask(prompt);
      const answerText = (res?.answer || res || "").trim();

      appendAnswerBlock(answerText);

      // ASSISTANT TURN
      recordSummaryTurn("assistant", answerText);
      return res;
    }).catch((err) => {
      appendLog(`[live] ask error: ${err?.message || err}`);
    });

  }, SPEECH_IDLE_MS);
}



// RESET SPEECH QUEUE
function resetSpeechQueue() {
  _speechBuffer = [];

  if (_speechIdleTimer) {
    clearTimeout(_speechIdleTimer);
    _speechIdleTimer = null;
  }
}


// ======================================================

//   Companion / Live Mode Transcription Listener

// ======================================================

window.electron.on("live:chunk", (_e, text) => {

  if (!text || !text.trim()) return;



  const raw = text.trim();

  appendTranscriptLine(`You: ${raw}`);
  queueLiveTranscriptWords(raw);

  queueSpeechPrompt(raw);

});



// Backend ΓåÆ UI

window.electron?.on("log", (event, t) => {

  const msg = typeof t === "string" ? t : JSON.stringify(t, null, 2);

  appendLog(msg);

  handleApiLogLine(msg);

});





// Live speech -> Transcript (append lines with ≡ƒÄÖ prefix)

window.electron?.on("live:transcript", (e, data) => {

  if (!transcriptSink) return;



  // Accept either text or structured object

  const raw = typeof data === "string" ? data : data?.text || "";

  if (!raw.trim()) return;



  const parts = raw.split(/\r?\n+/).map(x => x.trim()).filter(Boolean);

  parts.forEach((p) => _appendDedup("You:", p, "bubble tx"));

});


// 🟦 STREAMING MODE FIX — ONLY stream-final produces the real answer

// Disable live-mode from pairing (still updates UI if needed)
window.electron?.on('live:answer', (event, t) => {
  if (!t) return;

  if (isStatusyBanner(t)) {
    try { setState('listening'); } catch {}
    return;
  }

  // ❌ DO NOT pair here in streaming mode
  appendAnswerBlock(t);  
});


// Disable push-mode completely in streaming setup
window.electron?.on("answer:push", (event, text) => {
  // ❌ ignore — not used in streaming mode
});


// Stream START — do nothing except UI preparation
window.electron?.on('answer:stream-start', (_event, payload) => {
  handleStreamStart(payload);  // builds empty UI block
});


// Stream CHUNK — do not pair
window.electron?.on('answer:stream-chunk', (_event, payload) => {
  handleStreamChunk(payload);  // updates current block live
});


// Stream FINAL — REAL ANSWER HERE
window.electron?.on('answer:stream-final', (_event, payload) => {
  const finalText = payload?.text || payload;

  if (finalText) {
    recordSummaryTurn('assistant', finalText);
  }

  handleStreamFinal(payload);
});




// Stream ERROR — no pairing
window.electron?.on('answer:stream-error', (_event, payload) => {
  handleStreamError(payload);
});




// ------------------ Config / Devices (optional UI) ------------------

const selDevice  = $('#soxDevice');

const inpGain    = $('#gainDb');

const inpChunk   = $('#chunkMs');

const btnRefresh = $('#refreshDevices');

const btnTest    = $('#testMic');



async function listDevices() {

  try {

    const r = await window.electron.invoke('sox:devices');

    if (!r?.items || !selDevice) return;

    selDevice.innerHTML = '';

    r.items.forEach(d => {

      const opt = document.createElement('option');

      opt.value = d.id;

      opt.textContent = d.label || d.id;

      if (r.selected && r.selected === d.id) opt.selected = true;

      selDevice.appendChild(opt);

    });

  } catch (e) {

    appendLog(`[ui] sox:devices error: ${e.message}`);

  }

}



async function loadConfigToUI() {

  try {

    const cfg = await window.electron.invoke('rec:getConfig');

    if (inpGain && cfg?.gainDb !== undefined) inpGain.value = cfg.gainDb;

    if (inpChunk && cfg?.chunkMs !== undefined) inpChunk.value = String(cfg.chunkMs);

    if (selDevice && cfg?.device) selDevice.value = cfg.device;

  } catch {}

}



async function pushConfig() {

  if (!selDevice && !inpGain && !inpChunk) return;

  const cfg = {

    device: selDevice?.value ?? 'default',

    gainDb: inpGain?.value ?? '0',

    chunkMs: Math.max(500, Number(inpChunk?.value || 1500))

  };

  try { await window.electron.invoke('rec:setConfig', cfg); }

  catch (e) { appendLog(`[ui] rec:setConfig error: ${e.message}`); }

}



on(btnRefresh, 'click', async () => { await listDevices(); appendLog('[ui] refreshed input device list'); });

on(selDevice, 'change', async () => { await pushConfig(); appendLog(`[ui] set device=${selDevice.value}`); });

on(inpGain, 'change', async () => { await pushConfig(); appendLog(`[ui] set gain=${inpGain.value}dB`); });

on(inpChunk, 'change', async () => { await pushConfig(); appendLog(`[ui] set chunkMs=${inpChunk.value}`); });

on(btnTest, 'click', async () => {

  await pushConfig();

  appendLog('[test] recording 3sΓÇª');

  try {

    const r = await window.electron.invoke('rec:test');

    if (r?.file) appendLog(`[test] file=${r.file} size=${r.size} bytes`);

    if (r?.transcript && liveTranscript) {

      liveTranscript.value = r.transcript;

      _ensureTrailingNewline(liveTranscript);

      liveTranscript.scrollTop = liveTranscript.scrollHeight;

    }

  } catch {}

});



// --- Live Companion UX wiring ---

const companionAPI = window.companion;



function setCompanionUI(onState) {

  const active = !!onState;

  if (active) {

    setState('listening');

    revealPanels();

    document.body.classList.add('companion-on');

    companionToggle?.classList.add('active','pulsing');

  } else {

    setState('');

    document.body.classList.remove('companion-on');

    companionToggle?.classList.remove('active','pulsing');

    resetSpeechQueue();

    if (liveTranscript && liveTranscript.value.trim() === 'Listening?') {

      liveTranscript.value = '';

    }

  }

  if (companionToggle) companionToggle.textContent = micIcon;

}



if (companionAPI || window.electron?.invoke) {

  on(companionToggle, 'click', async () => {

    const isOn = companionToggle?.classList.contains('active');

    try {

      companionToggle?.classList.add('busy');

      if (companionAPI?.start && companionAPI?.stop) {

        if (isOn) { await companionAPI.stop(); }

        else      { await companionAPI.start(); }

      } else if (window.electron?.invoke) {

        if (isOn) { await window.electron.invoke('live:stop'); }

        else      { await window.electron.invoke('live:start'); }

      } else {

        throw new Error('companion API unavailable');

      }

      revealPanels();

      // Optimistic UI update; onState will correct if needed

      setCompanionUI(!isOn);

    } catch (e) {

      console.error('[companion] toggle error', e);

      appendLog(`[companion] toggle error: ${e.message || e}`);

    } finally {

      companionToggle?.classList.remove('busy');

    }

  });



  if (companionAPI?.onState) {

    companionAPI.onState((s) => {

      setCompanionUI(s === 'on');

    });

  }



  if (companionAPI?.onTranscript) {

    companionAPI.onTranscript((t) => {

      const parts = String(t || '').split(/\r?\n+/).map(x => x.trim()).filter(Boolean);

      parts.forEach(p => _appendDedup('You:', p, 'bubble tx'));

    });

  }





  if (companionAPI?.onSuggestion) {

    companionAPI.onSuggestion((s) => {

      const msg = (typeof s === 'string') ? s : (s?.message || '');

      if (!msg || isStatusyBanner(msg)) return;

      appendAnswerBlock(msg);

    });

  }

}



// ------------------ Chat + Doc QA (file ingest + chat-to-answer) ------------------

const fileBtn   = $('#fileBtn');

const docInput  = $('#docInput');

const docBadge  = $('#docBadge');



function showDocBadge(name, count) {

  if (!docBadge) return;

  const pretty = name.length > 28 ? 'ΓÇª' + name.slice(-28) : name;

  docBadge.textContent = `${pretty} ΓÇó ${count} chars  ├ù`;

  docBadge.title = 'Click to remove';

  docBadge.classList.remove('hidden');

}

on(docBadge, 'click', async () => {

  await window.electron.invoke('doc:clear');

  docBadge?.classList.add('hidden');

  if (docBadge) docBadge.textContent = '';

});

// CHAT INPUT HANDLER (ENTER KEY)
// =====================================================
// CHAT INPUT HANDLER (ENTER KEY)
// =====================================================
on(chatInput, 'keydown', async (e) => {
  if (e.key === 'Enter') {
    const val = chatInput.value.trim();
    if (!val) return;

    revealPanels();

    // SAVE USER TURN
    recordSummaryTurn('user', val);

    try {
      const res = await window.enqueueChannelRequest('chat', () =>
        window.electronAPI.ask(val)
      );
      const final = (res?.answer || res?.text || res || "").trim();

      appendAnswerBlock(final);

      // SAVE ASSISTANT TURN
      recordSummaryTurn('assistant', final);
    } catch (err) {
      appendLog(`[chat] keydown ask error: ${err?.message || err}`);
    }

    chatInput.value = "";
  }
});



// TYPING REVEAL LOGIC
on(chatInput, 'input', () => {
  if (chatInput.value.trim().length > 0) revealPanels();
});

on(chatInput, 'focus', () => revealPanels());


// =====================================================
// CHAT SEND BUTTON
// =====================================================
on(chatSend, 'click', async () => {
  const val = chatInput.value.trim();
  if (!val) return;

  revealPanels();

  // SAVE USER TURN
  recordSummaryTurn('user', val);

  try {
    const res = await window.enqueueChannelRequest('chat', () =>
      window.electronAPI.ask(val)
    );
    const final = (res?.answer || res?.text || res || "").trim();

    appendAnswerBlock(final);

    // SAVE ASSISTANT TURN
    recordSummaryTurn('assistant', final);
  } catch (err) {
    appendLog(`[chat] button ask error: ${err?.message || err}`);
  }

  chatInput.value = "";
});







on(fileBtn, 'click', () => {

  if (docInput) {

    docInput.value = '';

    docInput.click();

  }

});

on(docInput, 'change', async () => {

  const f = docInput?.files?.[0];

  if (!f) return;

  const name = f.name.toLowerCase();

  try {

    if (name.endsWith('.txt')) {

      const text = await f.text();

      const res = await window.electron.invoke('doc:ingestText', { name: f.name, text });

      if (res?.ok) showDocBadge(f.name, res.chars);

    } else if (name.endsWith('.pdf')) {

      const ab = await f.arrayBuffer();

      const bytes = Array.from(new Uint8Array(ab));

      const res = await window.electron.invoke('doc:ingestBinary', { name: f.name, bytes, mime: f.type || 'application/pdf' });

      if (res?.ok) showDocBadge(f.name, res.chars);

    }

  } finally {

    if (docInput) docInput.value = '';

  }

});



// ------------------ Pre-recorded ------------------

const pickAudioBtn  = $('#pickAudioBtn');

const transcribeBtn = $('#transcribeBtn');

const clearBtn      = $('#clearBtn');

const pickedPathEl  = $('#pickedPath');

const fileOutput    = $('#fileOutput');

let pickedPath = '';



on(pickAudioBtn, 'click', async () => {

  try {

    const p = await window.electron.invoke('pick:audio');

    if (p) { pickedPath = p; if (pickedPathEl) pickedPathEl.textContent = p; }

  } catch {}

});

on(transcribeBtn, 'click', async () => {

  if (!pickedPath) {

    if (fileOutput) fileOutput.value += 'Pick a file first.\n';

    return;

  }

  const r = await window.electron.invoke('whisper:transcribe', pickedPath);

  if (fileOutput) fileOutput.value += (r?.output || '') + '\n';

  if (r?.output) {
    try {
      const res = await window.enqueueChannelRequest("chat", () =>
        window.electronAPI.ask(r.output)
      );
      const final = res?.answer || res?.text || res || "";
      appendAnswerBlock(final);
    } catch (err) {
      appendLog(`[pre-recorded] ask error: ${err?.message || err}`);
    }
  }




});

on(clearAnswer, 'click', () => {

  ALL_ANSWERS.length = 0;
renderAnswersVirtualized();


});







// ------------------ Init ------------------

(async function init(){

  if (selDevice || inpGain || inpChunk) {

    await listDevices();

    await loadConfigToUI();

  }

  if (!liveTranscript) {

    appendLog('[ui] WARNING: #liveTranscript not found in DOM');

  }

  // Default search mode

  if (searchModeSelect) {

    searchModeSelect.value = 'fastest';

  }

  // Periodically sync backend provider stats into the API usage panel

  refreshApiUsageFromBackend();

  setInterval(refreshApiUsageFromBackend, 10000);

})();



// --- Screen Read Context Memory ---

let lastScreenReadContext = "";



// ==============================================

//  SESSION SUMMARY COLLECTOR  (Haloryn Summary)

// ==============================================



// Track session start

let __sessionStart = Date.now();

let __questions = 0;

let __answers = 0;

const __answerLog = [];





function countWords(text) {

  return (text || "").split(/\s+/).filter(Boolean).length;

}




function appendAnswerBlock(text) {
  revealPanels();

  const normalized = normalizeAnswer(text);
  if (!normalized) return;

  lastAnswerText = normalized;
  showAnswerFooter();

  // Add new answer to virtual list
  ALL_ANSWERS.push({ text: normalized });

  // Re-render the virtualized list
  setTimeout(() => {
    const container = document.getElementById("liveAnswer");
    if (container) {
      renderAnswersVirtualized();
      container.scrollTop = container.scrollHeight + 9999;
    }
  }, 5);
}





// Prepare + send summary object
async function sendSessionSummary() {
  const now = Date.now();
  const durationMs = now - __sessionStart;

  const transcriptText = document.getElementById("liveTranscript")?.value || "";
  const wordCount = countWords(transcriptText);
  const answersText = document.getElementById("liveAnswer")?.innerText?.trim() || "";

  console.log("DEBUG __turns BEFORE SUMMARY →", __turns);

  // ✅ FIXED GUARD — allow index.html or indexRoot.html
  if (!window.location.pathname.includes("index")) {
    console.warn("sendSessionSummary called in non-live window — ignored");
    return;
  }

  const summary = {
    duration: msToHuman(durationMs),
    questions: __questions,
    answers: __answers,
    words: wordCount,
    transcript: transcriptText,
    responses: __answerLog.slice(0, 50),

    // NEW: block-based system
    pairs: __turns.slice(0, 200),

    answersText
  };

  debugLog("SUMMARY BUILT:", summary);

  // Send full summary to main
  window.electronAPI.finishSession(summary);
}


// Convert milliseconds to readable time
function msToHuman(ms) {
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return sec + " sec";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}m ${s}s`;
}
