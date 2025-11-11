// ------------------ Helpers ------------------
const $  = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));
const on = (el, ev, fn) => el && el.addEventListener(ev, fn);

function pickFirst(...els) { return els.find(Boolean) || null; }

function appendLog(line) {
  const liveLog = $('#liveLog');
  if (!liveLog) return;
  const s = String(line ?? '');
  liveLog.value += (s.endsWith('\n') ? s : s + '\n');
  liveLog.scrollTop = liveLog.scrollHeight;
}

function setState(txt) {
  const el = $('#liveState');
  if (el) {
    el.textContent = txt;
    // pulse class when starting/listening
    const on = /listening|starting/i.test(String(txt || ''));
    el.classList.toggle('pulsing', on);
  }
}

// Drop “banner/status” lines from Answer/Companion sinks
function isStatusyBanner(t) {
  if (!t) return false;
  const s = String(t);
  return (
    /^\s*🔊\s*Live Companion is ON/i.test(s) ||
    /^\s*No material changes\./i.test(s) ||
    /^\s*(Summary:|Action Items|From the web:)/i.test(s) ||
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
const liveAnswer      = $('#liveAnswer');
const liveStatus      = $('#liveStatus');
const companionToggle = $('#companionToggle');
const transcriptEl    = $('#liveTranscript');
const answerEl        = $('#liveAnswer');   // existing
// NOTE: chat feed intentionally not used; we’re keeping Live ultra-clean

// --- Single Transcript helpers ---
let _txSeenLen = 0;
let _txLastLine = '';

function _ensureTrailingNewline(el){
  if (el && !el.value.endsWith('\n')) el.value += '\n';
}

function appendTranscriptLine(line) {
  if (!liveTranscript) return;
  const s = String(line ?? '').trim();
  if (!s || s === _txLastLine) return;     // de-dupe consecutive duplicates
  _txLastLine = s;
  liveTranscript.value += (liveTranscript.value ? '\n' : '') + s;
  _ensureTrailingNewline(liveTranscript);
  liveTranscript.scrollTop = liveTranscript.scrollHeight;
}

function appendTranscriptChunk(chunk){
  // Split on newlines and append each cleanly
  const parts = String(chunk || '').split(/\r?\n+/).map(p => p.trim()).filter(Boolean);
  parts.forEach(p => appendTranscriptLine(`🎙 ${p}`));
}

function setTranscriptText(s) {
  if (liveTranscript) {
    liveTranscript.value = (s || '');
    _ensureTrailingNewline(liveTranscript);
    liveTranscript.scrollTop = liveTranscript.scrollHeight;
  }
}

// Start/Stop
on(btnStart, 'click', async () => {
  setState('starting…');
  try { await pushConfig(); } catch {}
  try {
    const r = await window.electron?.invoke('live:start');
    if (r?.ok) {
      _txSeenLen = 0;
      _txLastLine = '';
      setState('listening');
      setTranscriptText('Listening…');
    } else {
      setState('error');
    }
    // Pulse + LED active
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
  // Stop pulse + LED
  document.body.classList.remove('companion-on');
  btnStart?.classList.remove('recording');
});

// Backend → UI
window.electron?.on('log', (t) => appendLog(t));
// Backend → UI (Transcript appends line-by-line)
window.electron?.on('live:transcript', (t) => {
  if (!liveTranscript) return;
  const full = String(t || '');

  const lines = full.split(/\r?\n+/).map(l => l.trim()).filter(Boolean);

  const existingText = (liveTranscript.value || '').trim();
  const existing = existingText ? existingText.split(/\r?\n+/) : [];

  const newLines = lines.slice(existing.length);
  if (newLines.length) {
    liveTranscript.value += (existingText ? '\n' : '') + newLines.join('\n');
    liveTranscript.scrollTop = liveTranscript.scrollHeight;
  }
});

window.electron?.on('live:answer', (t) => {
  if (!t) return;
  if (isStatusyBanner(t)) {
    try { setState('listening'); } catch {}
    return;
  }
  if (liveAnswer) {
    liveAnswer.value = (liveAnswer.value ? liveAnswer.value + '\n---\n' : '') + t;
    liveAnswer.scrollTop = liveAnswer.scrollHeight;
  }
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
  appendLog('[test] recording 3s…');
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

// ------------------ Chat + Doc QA (optional UI) ------------------
const chatInput = $('#chatInput');
const chatSend  = $('#chatSend');
const fileBtn   = $('#fileBtn');
const docInput  = $('#docInput');
const docBadge  = $('#docBadge');

function showDocBadge(name, count) {
  if (!docBadge) return;
  const pretty = name.length > 28 ? '…' + name.slice(-28) : name;
  docBadge.textContent = `${pretty} • ${count} chars  ×`;
  docBadge.title = 'Click to remove';
  docBadge.classList.remove('hidden');
}
on(docBadge, 'click', async () => {
  await window.electron.invoke('doc:clear');
  docBadge?.classList.add('hidden');
  if (docBadge) docBadge.textContent = '';
});

on(chatSend, 'click', async () => {
  const val = chatInput?.value?.trim();
  if (!val) return;
  appendTranscriptLine(`You: ${val}`);
  chatInput.value = '';
  try {
    const ans = await window.electron.invoke('chat:ask', val);
    if (ans && liveAnswer) {
      if (!isStatusyBanner(ans)) {
        liveAnswer.value = (liveAnswer.value ? liveAnswer.value + '\n---\n' : '') + ans;
        liveAnswer.scrollTop = liveAnswer.scrollHeight;
      }
    }
  } catch (e) { appendLog(`[ui] chat:ask error: ${e.message}`); }
});
on(chatInput, 'keydown', (e) => { if (e.key === 'Enter') chatSend?.click(); });
on(fileBtn, 'click', () => docInput?.click());
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

// --- Live Companion UX wiring ---
if (window.companion) {
  on(companionToggle, 'click', async () => {
    const isOn = companionToggle.classList.contains('active');
    try {
      if (isOn) { await window.companion.stop(); }
      else      { await window.companion.start(); }
    } catch (e) { appendLog(`[companion] toggle error: ${e.message}`); }
  });

  window.companion.onState((s) => {
    const onState = s === 'on';
    if (onState) {
      setState('listening');                          // show while ON
      document.body.classList.add('companion-on');    // keep pulse styles active
      companionToggle?.classList.add('active','pulsing');
      companionToggle.textContent = 'Companion • ON';
    } else {
      setState('');                                   // <— CLEAR when OFF
      document.body.classList.remove('companion-on'); // stop pulse styles
      companionToggle?.classList.remove('active','pulsing');
      companionToggle.textContent = 'Companion';
      // if the textarea was showing a placeholder "Listening…", wipe it
      if (liveTranscript && liveTranscript.value.trim() === 'Listening…') {
        liveTranscript.value = '';
      }
    }
  });

  window.companion.onTranscript((t) => {
    if (!transcriptEl) return;
    appendTranscriptChunk(String(t || ''));
  });

  window.companion.onSuggestion((s) => {
    const msg = (typeof s === 'string') ? s : (s?.message || '');
    if (!msg || isStatusyBanner(msg)) return;
    if (answerEl) {
      answerEl.value += (answerEl.value ? '\n' : '') + msg + '\n';
      answerEl.scrollTop = answerEl.scrollHeight;
    }
  });
}

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
});
on(clearBtn, 'click', () => { if (fileOutput) fileOutput.value = ''; });

// ------------------ Init ------------------
(async function init(){
  if (selDevice || inpGain || inpChunk) {
    await listDevices();
    await loadConfigToUI();
  }
  if (!liveTranscript) {
    appendLog('[ui] WARNING: #liveTranscript not found in DOM');
  }
})();
