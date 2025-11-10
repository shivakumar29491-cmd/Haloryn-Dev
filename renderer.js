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
  if (el) el.textContent = txt;
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

const liveTranscript = $('#liveTranscript');
const liveAnswer     = $('#liveAnswer');
const liveStatus      = $('#liveStatus');
const companionToggle = $('#companionToggle');
const transcriptEl    = $('#liveTranscript');
const answerEl        = $('#liveAnswer');   // existing
const chatFeed        = $('#chatFeed');     // existing

function setTranscriptText(s) {
  if (liveTranscript) {
    liveTranscript.value = s || '';
    liveTranscript.scrollTop = liveTranscript.scrollHeight;
  }
  // bubble fallback in chat feed
  const feed = $('#chatFeed');
  if (!feed) return;
  let b = $('#live-bubble');
  if (!b) {
    b = document.createElement('div');
    b.id = 'live-bubble';
    b.className = 'bubble tx';
    b.textContent = '🎙 Listening…';
    feed.appendChild(b);
  }
  b.textContent = '🎙 ' + (s || '');
  feed.scrollTop = feed.scrollHeight;
}

on(btnStart, 'click', async () => {
  setState('starting…');
  try { await pushConfig(); } catch {}
  try {
    const r = await window.electron?.invoke('live:start');
    if (r?.ok) {
      setState('listening');
      setTranscriptText('Listening…');
    } else {
      setState('error');
    }
  } catch (e) {
    appendLog(`[ui] live:start error: ${e.message}`);
    setState('error');
  }
});

on(btnStop, 'click', async () => {
  try { await window.electron?.invoke('live:stop'); } catch {}
  setState('idle');
});

// Backend → UI
window.electron?.on('log', (t) => appendLog(t));
window.electron?.on('live:transcript', (t) => setTranscriptText(String(t || '')));
window.electron?.on('live:answer', (t) => {
  const txt = String(t || '').trim();
  if (!txt) return;
  if (liveAnswer) {
    liveAnswer.value = (liveAnswer.value ? liveAnswer.value + '\n---\n' : '') + txt;
    liveAnswer.scrollTop = liveAnswer.scrollHeight;
  }
  const feed = $('#chatFeed');
  if (feed) {
    const b = document.createElement('div');
    b.className = 'bubble ai';
    b.textContent = txt;
    feed.appendChild(b);
    feed.scrollTop = feed.scrollHeight;
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
    if (inpGain && cfg?.gainDb) inpGain.value = cfg.gainDb;
    if (inpChunk && cfg?.chunkMs) inpChunk.value = String(cfg.chunkMs);
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
    const r = await window.electron.invoke('rec:test'); // optional in main.js; ignore if missing
    if (r?.file) appendLog(`[test] file=${r.file} size=${r.size} bytes`);
    if (r?.transcript && liveTranscript) {
      liveTranscript.value = r.transcript;
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
  chatInput.value = '';
  try {
    const ans = await window.electron.invoke('chat:ask', val);
    if (ans && liveAnswer) {
      liveAnswer.value = (liveAnswer.value ? liveAnswer.value + '\n---\n' : '') + ans;
      liveAnswer.scrollTop = liveAnswer.scrollHeight;
    }
  } catch (e) { appendLog(`[ui] chat:ask error: ${e.message}`); }
});
on(chatInput, 'keydown', (e) => {
  if (e.key === 'Enter') chatSend?.click();
});
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
  // Start/stop via the dedicated toggle
  on(companionToggle, 'click', async () => {
    const isOn = companionToggle.classList.contains('active');
    try {
      if (isOn) { await window.companion.stop(); }
      else      { await window.companion.start(); }
    } catch (e) { appendLog(`[companion] toggle error: ${e.message}`); }
  });

  // Reflect state in UI (fading status + pulsing toggle)
  window.companion.onState((s) => {
    const on = s === 'on';
    if (on) {
      liveStatus?.classList.remove('hidden');
      companionToggle?.classList.add('active','pulsing');
      companionToggle.textContent = 'Companion • ON';
    } else {
      liveStatus?.classList.add('hidden');
      companionToggle?.classList.remove('active','pulsing');
      companionToggle.textContent = 'Companion';
    }
  });

  // Rolling mic transcript goes only to Transcript box
  window.companion.onTranscript((t) => {
    if (!transcriptEl) return;
    transcriptEl.value += (t.endsWith('\n') ? t : (t + '\n'));
    transcriptEl.scrollTop = transcriptEl.scrollHeight;
  });

  // Companion suggestions/answers go to Answer — filter noisy status banners
  window.companion.onSuggestion((s) => {
    const msg = (typeof s === 'string') ? s : (s?.message || '');
    if (!msg) return;
    // Drop the “Live Companion is ON…” banner from appearing as blocks
    if (msg.startsWith('Live Companion is ON')) return;

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
})();
