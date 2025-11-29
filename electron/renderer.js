const DEBUG_RENDERER = false;       // flip to true for verbose console logs

const ALLOW_UI_LOGS = false;        // keeps the UI log quiet in companion mode

const MAX_UI_LOG_LINES = 200;       // cap log size to avoid main-thread churn

const debugLog = (...args) => { if (DEBUG_RENDERER) console.log(...args); };



debugLog("LOADED HTML:", window.location.pathname);



document.addEventListener("DOMContentLoaded", () => {

    debugLog("DOM READY");

document.addEventListener("DOMContentLoaded", () => {

  debugLog("DOM fully loaded");

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



// Force textarea as the single transcript sink

const transcriptSink = document.getElementById('liveTranscript');

const transcriptContainer = document.getElementById('transcript-container');

const answerBox = document.querySelector('.answer-box');

window.__useGroqFastMode = true;

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


function renderActionButtons(text) {
  const wrap = document.createElement("div");
  wrap.className = "answer-actions";

  const mk = (label, handler) => {
    const btn = document.createElement("button");
    btn.className = "answer-action-btn";
    btn.textContent = label;
    btn.onclick = handler;
    return btn;
  };

  wrap.appendChild(
    mk("Follow up questions", async () => {
      const q = `Give 2 follow-up questions for: ${text}`;
      const res = await window.electronAPI.ask(q);
      appendAnswerBlock(res.answer || res);
    })
  );

  wrap.appendChild(
    mk("Detailed explanation", async () => {
      const q = `Give a detailed explanation for: ${text}`;
      const res = await window.electronAPI.ask(q);
      appendAnswerBlock(res.answer || res);
    })
  );

  return wrap;
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
    wrap.appendChild(renderActionButtons(ans.text));

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
    if (ALL_ANSWERS.length) {
      ALL_ANSWERS[ALL_ANSWERS.length - 1].text = finalNorm;
    } else if (finalNorm) {
      ALL_ANSWERS.push({ text: finalNorm, maxLen: activeStream.maxLen });
    }
    activeStream = null;

    chunkBuffer = '';

    renderAnswersVirtualized();


    return;

  }

  if (finalText) {

    appendAnswerBlock(finalText, DEFAULT_MAX_LEN);

  }

}

window.__askDirect = async function(prompt) {
  try {
    const clean = String(prompt || "").trim();
    if (!clean) return;

    setState("answering");
    const res = await window.electronAPI.ask(clean);

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

on($('#btn-close'), 'click', () => window.windowCtl?.close());



// ------------------ Live controls ------------------

const btnStart = pickFirst($('#startBtn'), $('[data-action="start"]'), $('[title="Start"]'));

const btnStop  = pickFirst($('#stopBtn'),  $('[data-action="stop"]'),  $('[title="Stop"]'));



const liveTranscript = $('#liveTranscript') || document.querySelector('#tab-live textarea');

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

//---------------------------------------------

// SCREEN READ (Snipping Tool ΓåÆ Clipboard ΓåÆ OCR)

//---------------------------------------------

on(screenReadBtn, "click", async () => {

  try {

    // UI: Button ON + status

    screenReadBtn.classList.add("active");

    setState("screen: capturingΓÇª");



    // 1) Minimize Haloryn immediately

    window.windowCtl?.minimize();



    // 2) Launch Snipping Tool (handled in main.js)

    await window.electron.invoke("screenread:start");



    // 3) Poll clipboard for image placed by Snipping Tool

    let tries = 0;

    let found = false;



    while (tries < 20) {

      const res = await window.electron.invoke("screenread:getClipboardImage");



      if (res.ok && res.img) {

        window.electron.send("ocr:image", res.img);

        found = true;

        break;

      }

      await new Promise(r => setTimeout(r, 300));

      tries++;

    }



    if (!found) appendLog("[screen] no screenshot detected");



  } catch (err) {

    appendLog(`[screen] unexpected error: ${err.message}`);

  } finally {

    // Restore window right away after OCR (added later in OCR handler)

    screenReadBtn.classList.remove("active");

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

window.electron.on("ocr:text", async (event, textRaw) => {

  try {

    const text = (textRaw || "").trim();



    if (!text) {

      appendLog("[screen] no text detected by OCR");

      setState("idle");

      return;

    }



    // 1) Show OCR text in Transcript box

    if (liveTranscript) {

      const existing = (liveTranscript.value || "").trim();

      const prefix = "[SCREEN OCR]\n";

      liveTranscript.value =

        (existing ? existing + "\n\n" : "") + prefix + text;

      liveTranscript.scrollTop = liveTranscript.scrollHeight;

    }



    // 2) Ingest OCR text as a temporary document

    try {

      const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");

      const name = `ScreenCapture-${ts}.txt`;

      await window.electron.invoke("doc:ingestText", { name, text });

    } catch (e) {

      appendLog(`[screen] doc ingest error: ${e.message}`);

    }



    // 3) Ask QA engine to summarize + suggest follow-up questions

  // 3) Store OCR text as screen-read context and answer normally

try {

  lastScreenReadContext = text;

  await unifiedAsk(text);

} catch (e) {

  appendLog(`[screen] QA error: ${e.message}`);

} finally {

    window.windowCtl?.restore();

    setState("idle");

}

  } catch (err) {

    appendLog(`[screen] unexpected OCR error: ${err.message || err}`);

    setState("error");

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



on(btnStop, 'click', async () => {

  try { await window.electron?.invoke('live:stop'); } catch {}

  setState('idle');

  resetSpeechQueue();

  document.body.classList.remove('companion-on');

  btnStart?.classList.remove('recording');

});

const SPEECH_IDLE_MS = 650;            // slightly longer pause to avoid mid-sentence triggers

const MAX_SPEECH_BUFFER_CHARS = 6000; // allow longer speech before trimming

let _speechBuffer = [];

let _speechIdleTimer = null;



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

    const prompt = _speechBuffer.join(' ').trim();

    _speechBuffer = [];

    _speechIdleTimer = null;

    if (prompt) unifiedAsk(prompt);

  }, SPEECH_IDLE_MS);

}



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



// AI answers -> Answer box

window.electron?.on('live:answer', (event, t) => {



  if (!t) return;

  if (isStatusyBanner(t)) {

    try { setState('listening'); } catch {}

    return;

  }

  appendAnswerBlock(t);

});

// Generic answer push from main.js

window.electron?.on("answer:push", (event, text) => {

  if (!text) return;

  appendAnswerBlock(text);

});



window.electron?.on('answer:stream-start', (_event, payload) => {

  handleStreamStart(payload);

});



window.electron?.on('answer:stream-chunk', (_event, payload) => {

  handleStreamChunk(payload);

});



window.electron?.on('answer:stream-final', (_event, payload) => {

  handleStreamFinal(payload);

});



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



on(chatInput, 'keydown', (e) => {

  if (e.key === 'Enter') {

    const val = chatInput.value.trim();

    if (val) {

      revealPanels();

      unifiedAsk(val);

    }

    chatInput.value = "";

  }

});

// Reveal panels as soon as the user starts typing or focuses the box

on(chatInput, 'input', () => {

  if (chatInput.value.trim().length > 0) revealPanels();

});

on(chatInput, 'focus', () => revealPanels());

on(chatSend, 'click', () => {

  const val = chatInput.value.trim();

  if (val) {

    revealPanels();

    unifiedAsk(val);

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

    if (r?.output) unifiedAsk(r.output);



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

// =====================================================

//   UNIVERSAL ANSWER PIPELINE (SAFE + NO RECURSION)

// =====================================================

async function unifiedAsk(promptText) {

  try {

    const userPrompt = String(promptText || "").trim();

    if (!userPrompt) return;



    appendTranscriptLine(`You: ${userPrompt}`);

    setState("answering");

    const response = await window.electronAPI.ask(userPrompt);

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

// ==============================================

//  SESSION SUMMARY COLLECTOR  (Haloryn Summary)

// ==============================================



// Track session start

let __sessionStart = Date.now();

let __questions = 0;

let __answers = 0;

const __answerLog = [];

const __pairs = []; // { prompt, response }



function countWords(text) {

  return (text || "").split(/\s+/).filter(Boolean).length;

}





function appendAnswerBlock(text) {
  revealPanels();

  const normalized = normalizeAnswer(text);
  if (!normalized) return;

  ALL_ANSWERS.push({ text: normalized });

  setTimeout(() => {
    const container = document.getElementById("liveAnswer");
    if (container) {
      container.scrollTop = container.scrollHeight + 9999;
    }
    renderAnswersVirtualized();
  }, 5);
}




// Prepare + send summary object

async function sendSessionSummary() {

  const now = Date.now();

  const durationMs = now - __sessionStart;



  const transcriptText = document.getElementById("liveTranscript")?.value || "";

  const wordCount = countWords(transcriptText);

  const answersText = document.getElementById("liveAnswer")?.innerText?.trim() || "";



  const summary = {

    duration: msToHuman(durationMs),

    questions: __questions,

    answers: __answers,

    words: wordCount,

    transcript: transcriptText,

    responses: __answerLog.slice(0, 50), // cap to reasonable count

    pairs: __pairs.slice(0, 200),

    answersText

  };



  debugLog("SUMMARY BUILT:", summary);

  window.windowCtl.endSession(summary);

}



function msToHuman(ms) {

  const sec = Math.floor(ms / 1000);

  if (sec < 60) return sec + " sec";

  const m = Math.floor(sec / 60);

  const s = sec % 60;

  return `${m}m ${s}s`;

}



// ==============================================

//  INTERCEPT OS WINDOW X ΓåÆ send summary

// ==============================================

window.electron.on("trigger:end-session", () => {

  sendSessionSummary();

});



});





