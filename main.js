// =====================================================
// HaloAI — main.js (Recorder + Whisper + Chat + Doc QA + Live Companion)
// =====================================================
require('dotenv').config();

const { app, BrowserWindow, ipcMain, dialog, globalShortcut } = require('electron');
const { spawn } = require('child_process');
const fs   = require('fs');
const os   = require('os');
const path = require('path');
const fetch = require('node-fetch');
const cheerio = require('cheerio');
const { URL } = require('url');
let pdfParse = null; // lazy-load for PDFs

process.env.PATH = [
  'C:\\Program Files\\sox',
  'C:\\Program Files (x86)\\sox-14-4-2',
  process.env.PATH || ''
].join(';');

// ---------------- Window ----------------
let win;
function send(ch, payload) {
  if (win && !win.isDestroyed()) {
    try { win.webContents.send(ch, payload); } catch {}
  }
}
function createWindow() {
  win = new BrowserWindow({
    width: 920,
    height: 750,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    titleBarStyle: 'hidden',
    backgroundMaterial: 'mica',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  win.loadFile('index.html').catch(e => console.error('[boot] loadFile error', e));
  win.on('closed', () => { win = null; });
}
app.whenReady().then(() => {
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
const WHISPER_THREADS = Number(process.env.WHISPER_THREADS || 4);
const WHISPER_NGL     = String(process.env.WHISPER_NGL || '0'); // GPU offload layers if compiled (e.g. "20")
const LANG            = process.env.WHISPER_LANG || 'en';

function runWhisper(filePath){
  return new Promise((resolve, reject) => {
    try {
      if (!fs.existsSync(filePath)) return reject(new Error('audio not found'));
      const outTxt = `${filePath}.txt`;
      try { if (fs.existsSync(outTxt)) fs.unlinkSync(outTxt); } catch {}

      const args = [
        '-m', WHISPER_MODEL,
        '-f', filePath,
        '-otxt',
        '-l', LANG,
        '-t', String(WHISPER_THREADS),
        '-ngl', WHISPER_NGL
      ];

      send('log', `[spawn] ${WHISPER_BIN}\n[args] ${args.join(' ')}`);
      const child = spawn(WHISPER_BIN, args, { windowsHide: true });

      let lastPartial = '';

      child.stdout.on('data', (buf) => {
        const chunk = buf.toString();
        // keep logging stdout so you can see raw whisper output
        send('log', chunk);

        // 1) timestamped format: [00:00:01.11 -> 00:00:03.22] text...
        const timeStamped = chunk.match(/\[\d{2}:\d{2}:\d{2}\.\d{2}\s*->\s*\d{2}:\d{2}:\d{2}\.\d{2}\]\s*(.*)/);
        if (timeStamped && timeStamped[1]) {
          lastPartial = timeStamped[1].trim();
          send('live:transcript', lastPartial);
          return;
        }

        // 2) key:value format: text: ...
        const keyVal = chunk.match(/(?:text|result)\s*:\s*(.+)/i);
        if (keyVal && keyVal[1]) {
          lastPartial = keyVal[1].trim();
          send('live:transcript', lastPartial);
          return;
        }

        // 3) fallback: printable words
        const maybeWords = chunk.trim();
        if (maybeWords && /[a-zA-Z0-9]/.test(maybeWords)) {
          lastPartial = maybeWords;
          send('live:transcript', lastPartial);
        }
      });

      child.stderr.on('data', d => {
        send('log', `[stderr] ${d.toString()}`);
      });

      child.on('error', (e) => {
        send('log', `[whisper:error] ${e.message}`);
        reject(e);
      });

      child.on('close', () => {
        // flush last partial so UI shows what we heard
        if (lastPartial) send('live:transcript', lastPartial);
        try {
          const text = fs.existsSync(outTxt) ? fs.readFileSync(outTxt, 'utf8').trim() : '';
          resolve(text);
        } catch (e) {
          reject(e);
        }
      });
    } catch (e) {
      reject(e);
    }
  });
}


// ---------------- Web utils ----------------
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
    const res = await fetch(url, { timeout: 8000, headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } });
    if (!res.ok) return null;
    const html = await res.text();
    const $ = cheerio.load(html);
    const paras = [];
    $('p, article p, div p, section p').each((i, el) => {
      let t = $(el).text().replace(/\s+/g,' ').trim();
      if (t.length > 50 && !/cookie|subscribe|advert/i.test(t)) paras.push(t);
    });
    if (paras.length === 0) $('div').each((i, el) => {
      const t = $(el).text().replace(/\s+/g,' ').trim();
      if (t.length > 80 && t.split(' ').length > 10) paras.push(t);
    });
    const uniq = Array.from(new Set(paras)).filter(p => p.length > 40).slice(0, 10);
    if (uniq.length === 0) return null;
    return uniq.join('\n\n');
  }catch(e){ send('log', `[fetchAndExtract error] ${e.message}`); return null; }
}
function extractiveSummary(text, query, maxSentences = 6) {
  if (!text) return '';
  const qwords = (query || '').toLowerCase().split(/\s+/).filter(Boolean);
  const sents = text.split(/(?<=[.!?])\s+/);
  const scored = sents.map(s => {
    const lw = s.toLowerCase(); let score = 0;
    qwords.forEach(q => { if (lw.includes(q)) score++; });
    return { s: s.trim(), score };
  }).sort((a,b) => b.score - a.score);
  const chosen = scored.filter(x => x.s.length > 30).slice(0, maxSentences).map(x => x.s);
  return chosen.length ? chosen.join(' ') : sents.slice(0, maxSentences).join(' ').trim();
}

// ---------------- Answering state/funcs ----------------
let docContext = { name:'', text:'' };
let webPlus = false; // backend flag (UI removed)
let useDoc = false;  // default OFF so answers are AI-only

// token helpers
const STOP = new Set('a an and are as at be by for from has have in into is it its of on or s t that the their to was were will with your you about this those these which who whom whose when where how why what can could should would may might not no yes more most very just also than then'.split(' '));
function tokenize(s){ return (s||'').toLowerCase().replace(/[^a-z0-9\s]/g,' ').split(/\s+/).filter(w=>w&&w.length>1&&!STOP.has(w)); }
function chunkText(text, target=1200){
  const chunks=[]; let buf=''; const paras=text.split(/\n{2,}/);
  for(const p of paras){
    if((buf+'\n\n'+p).length<=target){ buf=buf?buf+'\n\n'+p:p; }
    else { if(buf) chunks.push(buf); if(p.length<=target) chunks.push(p); else { for(let i=0;i<p.length;i+=target) chunks.push(p.slice(i,i+target)); } buf=''; }
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

// --- Local LLM via Ollama (Llama 3) ---
async function askLocalLLM(promptText) {
  try {
    const body = {
      model: 'llama3',
      prompt: promptText,
      stream: false,
      options: { num_predict: 256, temperature: 0.5, top_k: 40, top_p: 0.9 }
    };
    const res = await fetch('http://127.0.0.1:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const raw = await res.text();
    try {
      const j = JSON.parse(raw);
      if (typeof j?.response === 'string') return j.response.trim();
    } catch {}
    const merged = raw.split('\n').map(l => {
      try { return JSON.parse(l).response || ''; } catch { return ''; }
    }).join('').trim();
    return merged || raw.trim() || '(no reply)';
  } catch (e) {
    return `(local LLM error) ${e.message}`;
  }
}

async function askLocalDocAnswer(question, text){
  const intent=detectIntent(question);
  const k=intent==='qa'?6:10;
  const ctx=intent==='qa' ? selectRelevantChunks(question,text,k).join('\n\n') : chunkText(text,1400).slice(0,k).join('\n\n');
  const prompt = `You are HaloAI. Use ONLY the document below to respond.
If the document lacks the answer, say "I couldn't find this in the document."

Document:
"""
${ctx}
"""

Task: ${
    intent==='summarize' ? 'Provide a concise summary.' :
    intent==='highlights' ? 'List key points / action items as bullets.' :
    `Answer the question strictly from the document: ${question}`
  }`;
  return await askLocalLLM(prompt);
}

// --- Local doc/web engines (no API key) ---
async function localHybridAnswer(question, text){
  const intent = detectIntent(question);
  const docCtx = intent==='qa' ? selectRelevantChunks(question,text,6).join('\n\n') : chunkText(text,1400).slice(0,8).join('\n\n');
  const links = await duckDuckGoSearch(question, 3);
  let webCtx = '';
  for (const u of links){ const t = await fetchAndExtract(u); if (t) webCtx += t + '\n\n'; }
  const docPart = intent==='summarize' ? extractiveSummary(text,'',10) :
                  intent==='highlights' ? extractiveSummary(text,'',12) :
                  extractiveSummary(docCtx, question, 7);
  const webPart = extractiveSummary(webCtx, question, 6);
  if (!docPart && !webPart) return `I couldn't find enough in the document or the web for “${question}”. Try rephrasing.`;
  let out = '';
  if (docPart) out += `From your document:\n${docPart}\n\n`;
  if (webPart) out += `From the web:\n${webPart}`;
  return out.trim();
}
async function localDocAnswer(question, text){
  const intent=detectIntent(question);
  if (intent==='summarize'){ const s=extractiveSummary(text,'',10); return s||'I read the document but could not extract a clean summary.'; }
  if (intent==='highlights'){ const s=extractiveSummary(text,'',12); if(!s) return 'No clear highlights found.'; const bullets=s.split(/(?<=[.!?])\s+/).slice(0,8).map(x=>`• ${x.trim()}`).join('\n'); return `Here are the key points:\n${bullets}`; }
  const ctx=selectRelevantChunks(question,text,6).join('\n\n');
  const ans=extractiveSummary(ctx,question,8);
  return ans || 'I checked the document but didn’t find a clear answer.';
}

// --- OpenAI engines ---
async function openAIDocAnswer(question, text){
  const intent=detectIntent(question);
  const k=intent==='qa'?6:12;
  const ctx=intent==='qa' ? selectRelevantChunks(question,text,k).join('\n\n') : chunkText(text,1400).slice(0,k).join('\n\n');
  const sys=`You are HaloAI. Answer ONLY using the provided document. If the document does not contain the answer, say "I couldn't find this in the document." Prefer concise bullets.`;
  const user=`Document: """\n${ctx}\n"""\n\nTask: ${
    intent==='summarize'?'Provide a concise summary.':
    intent==='highlights'?'List the key points / action items as bullets.':
    `Answer the question strictly from the document: ${question}`
  }`;
  try{
    const r = await fetch('https://api.openai.com/v1/chat/completions',{
      method:'POST',
      headers:{ 'Authorization':`Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type':'application/json' },
      body:JSON.stringify({ model:process.env.FALLBACK_MODEL||'gpt-4o-mini', temperature:0.3, max_tokens:600,
        messages:[{role:'system',content:sys},{role:'user',content:user}] })
    });
    const txt = await r.text(); let json;
    try{ json=JSON.parse(txt); }catch{ send('log',`[OpenAI raw] ${txt}`); }
    if (json?.error?.message){ send('log',`[OpenAI Error] ${json.error.message}`); return localDocAnswer(question,text); }
    return json?.choices?.[0]?.message?.content?.trim() || localDocAnswer(question,text);
  }catch(e){ send('log', `[OpenAI Exception] ${e.message}`); return localDocAnswer(question,text); }
}
async function openAIHybridAnswer(question, text){
  const intent=detectIntent(question);
  const k=intent==='qa'?6:10;
  const docCtx=intent==='qa'? selectRelevantChunks(question,text,k).join('\n\n') : chunkText(text,1400).slice(0,k).join('\n\n');

  const links = await duckDuckGoSearch(question, 4);
  let webSnips = [];
  for (const u of links){
    const t = await fetchAndExtract(u);
    if (t){
      const sum = extractiveSummary(t, question, 3);
      if (sum) webSnips.push({url:u, sum});
    }
  }
  const webCtx = webSnips.map((s,i)=>`[${i+1}] ${s.sum} (source: ${s.url})`).join('\n');

  const sys = `You are HaloAI. Produce the BEST answer by combining the provided document with external knowledge snippets.
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

  try{
    const r = await fetch('https://api.openai.com/v1/chat/completions',{
      method:'POST',
      headers:{ 'Authorization':`Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type':'application/json' },
      body:JSON.stringify({ model:process.env.FALLBACK_MODEL||'gpt-4o-mini', temperature:0.4, max_tokens:700,
        messages:[{role:'system',content:sys},{role:'user',content:user}] })
    });
    const txt = await r.text(); let json;
    try{ json=JSON.parse(txt); }catch{ send('log',`[OpenAI raw] ${txt}`); }
    if (json?.error?.message){ send('log',`[OpenAI Error] ${json.error.message}`); return await localHybridAnswer(question,text); }
    const out = json?.choices?.[0]?.message?.content?.trim();
    return out || await localHybridAnswer(question,text);
  }catch(e){ send('log', `[OpenAI Exception] ${e.message}`); return await localHybridAnswer(question,text); }
}

// --- Generic (no doc) ---
async function genericAnswer(userText){
  const useLocal = String(process.env.AI_MODE || '').toLowerCase() === 'local';
  if (useLocal) {
    return await askLocalLLM(userText);
  }

  if (!process.env.OPENAI_API_KEY || !process.env.OPENAI_API_KEY.trim()){
    const links = await duckDuckGoSearch(userText, 4);
    const combined = [];
    for (const u of links){
      const t=await fetchAndExtract(u);
      const s=extractiveSummary(t||'',userText,4);
      if (s) combined.push(s);
    }
    return combined.length? `From the web:\n• ${combined.join('\n• ')}` : `I couldn’t find enough public info for “${userText}”. Try rephrasing.`;
  }
  try{
    const r = await fetch('https://api.openai.com/v1/chat/completions',{
      method:'POST',
      headers:{ 'Authorization':`Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type':'application/json' },
      body:JSON.stringify({ model:process.env.FALLBACK_MODEL||'gpt-4o-mini', temperature:0.7, max_tokens:350,
        messages:[{role:'system',content:'You are HaloAI. Provide clear, direct answers.'},{role:'user',content:userText}] })
    });
    const txt = await r.text(); let json;
    try{ json=JSON.parse(txt); }catch{ send('log',`[OpenAI raw] ${txt}`); }
    if (json?.error?.message){ send('log',`[OpenAI Error] ${json.error.message}`); }
    const out = json?.choices?.[0]?.message?.content?.trim();
    if (out) return out;
  }catch(e){ send('log', `[OpenAI Exception] ${e.message}`); }
  const links = await duckDuckGoSearch(userText, 4);
  const pieces=[];
  for (const u of links){
    const t=await fetchAndExtract(u);
    const s=extractiveSummary(t||'',userText,4);
    if (s) pieces.push(s);
  }
  return pieces.length? `From the web:\n• ${pieces.join('\n• ')}` : `I couldn’t find enough public info for “${userText}”.`;
}

// --- Router ---
async function answer(userText){
  const q = (userText || '').trim();
  if (!q) return '';

  // If AI_MODE=local, prefer Llama3 for both generic and doc flows
  const useLocal = String(process.env.AI_MODE || '').toLowerCase() === 'local';
  if (useLocal) {
    if (useDoc && docContext.text) return await askLocalDocAnswer(q, docContext.text);
    return await askLocalLLM(q);
  }

  // Cloud/OpenAI path
  if (useDoc && docContext.text){
    const wantsWeb = webPlus || /^web:\s*/i.test(q) || /\b(latest|price|202[4-9]|202\d)\b/i.test(q);
    if (wantsWeb){
      if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim()) return await openAIHybridAnswer(q, docContext.text);
      return await localHybridAnswer(q, docContext.text);
    }
    if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim()) return await openAIDocAnswer(q, docContext.text);
    return await localDocAnswer(q, docContext.text);
  }

  // AI-only (default)
  return await genericAnswer(q);
}

// ---------------- Paths / Recorder ----------------
function tmpDir(){ const dir=path.join(os.tmpdir(),'haloai'); if(!fs.existsSync(dir)) fs.mkdirSync(dir,{recursive:true}); return dir; }
function tmpWav(idx){ return path.join(tmpDir(), `chunk_${idx}.wav`); }

// Use device + gain from existing config (no UI change needed)
function recordWithSox(outfile, ms, onDone, device = 'default', gainDb = '0'){
  const seconds = Math.max(1, Math.round(ms/1000));
  const devArg = (device && device !== 'default') ? device : 'default';
  const args=[
    '-q','-t','waveaudio', devArg,
    '-r','16000','-b','16','-c','1',
    outfile,
    'trim','0',String(seconds),
    'silence','1','0.1','1%','-1','0.5','1%',
    'gain', String(gainDb || '0')
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
let recConfig={device:'default', gainDb:'0', chunkMs:1500};

// Live Companion state
const companion = {
  enabled: true,
  intervalMs: 12000,
  timer: null,
  lastLen: 0,
  lastUpdateAt: 0
};

// Compose a rolling “Live Companion” update from transcript
async function generateCompanionUpdate(kind='rolling'){
  const tx = live.transcript.trim();
  if (!tx) return;

  // Prefer OpenAI/local LLM if available; otherwise extractive fallback
  const sys = `You are HaloAI Live Companion. Listen to a meeting/conversation transcript and provide:
- A 2–4 line concise summary (no fluff)
- Up to 5 action items with owners if mentioned
- Helpful suggested prompts the user could say to you next
Keep it short. If nothing new since last update, say "No material changes."`;
  const user = `Transcript (${kind}):\n"""${tx.slice(-6000)}"""`;

  let out = '';
  if (String(process.env.AI_MODE || '').toLowerCase() === 'local') {
    out = await askLocalLLM(`${sys}\n\n${user}`);
  } else if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim()) {
    try{
      const r = await fetch('https://api.openai.com/v1/chat/completions',{
        method:'POST',
        headers:{ 'Authorization':`Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type':'application/json' },
        body:JSON.stringify({
          model: process.env.FALLBACK_MODEL || 'gpt-4o-mini',
          temperature: 0.3,
          max_tokens: 400,
          messages: [{ role:'system', content: sys }, { role:'user', content: user }]
        })
      });
      const j = await r.json();
      out = j?.choices?.[0]?.message?.content?.trim() || '';
    }catch(e){ send('log', `[Companion(OpenAI) error] ${e.message}`); }
  }

  if (!out) {
    // Fallback extractive summary
    const summary = extractiveSummary(tx, '', 6);
    const bullets = summary.split(/(?<=[.!?])\s+/).slice(0,5).map(s=>`• ${s.trim()}`).join('\n');
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
    // Only update if transcript grew meaningfully (>= 60 chars) since last update
    if (txLen - companion.lastLen >= 60) {
      await generateCompanionUpdate('rolling');
    }
  }, companion.intervalMs);
}
function stopCompanionTimer(){
  if (companion.timer) { clearInterval(companion.timer); companion.timer = null; }
}

function startChunk(){
  const dMs=recConfig.chunkMs||1500; const thisIdx = live.idx; const outfile=tmpWav(thisIdx);
  const after=()=>{ 
    const size=fs.existsSync(outfile)?fs.statSync(outfile).size:0; 
    send('log', `[chunk] ${outfile} size=${size} bytes`);

    // schedule next chunk immediately to maximize overlap
    if (live.on){ live.idx = thisIdx + 1; setImmediate(startChunk); }

    // process this chunk
    (async()=>{
      try{
        const text=(await runWhisper(outfile))||'';
        if(text){
          live.transcript+=(live.transcript?' ':'')+text;
          send('live:transcript',live.transcript);

          // Only answer direct questions immediately; the companion handles summaries on a timer.
          const looksLikeQuestion = /(\?|please|can you|how do|what|why|when|where|which)\b/i.test(text);
          if (looksLikeQuestion) {
            const a=await answer(text);
            if(a) send('live:answer',a);
          }
        } else send('log','[whisper] (empty transcript)');
      }catch(e){ send('log', `[whisper:error] ${e.message}`); }
    })();
  };
  recordWithSox(outfile,dMs,after, recConfig.device, recConfig.gainDb);
}

ipcMain.handle('live:start', async()=>{
  if(live.on) return {ok:true};
  live={on:true, idx:0, transcript:''};
  companion.lastLen = 0;
  companion.lastUpdateAt = 0;
  startCompanionTimer();
  startChunk();
  // let the chat know companion is active
  send('live:answer', '🔊 Live Companion is ON. I’ll drop concise updates every ~12 seconds and a final recap when you stop.');
  return {ok:true};
});
ipcMain.handle('live:stop', async()=>{
  live.on=false;
  stopCompanionTimer();
  await generateCompanionUpdate('final'); // flush a final recap
  return {ok:true};
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
ipcMain.handle('chat:ask', async(_e, text)=>{
  const q=(text||'').toString().trim(); if(!q) return '';
  return await answer(q);
});
ipcMain.handle('doc:ingestText', async(_e,p)=>{
  const name=(p?.name||'document.txt').toString();
  const raw=(p?.text||'').toString();
  const text=raw.replace(/\u0000/g,'').slice(0,200000);
  docContext={name,text};
  send('log', `[doc] loaded text: ${name}, ${text.length} chars`);
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
      docContext={name,text};
      send('log', `[doc] loaded PDF: ${name}, ${text.length} chars`);
      return {ok:true, name, chars:text.length, type:'pdf'};
    }catch(e){
      const msg=`[doc] PDF load error: ${e.message}`;
      send('log',msg); send('live:answer',msg);
      return {ok:false,error:e.message};
    }
  }
  return {ok:false, error:'Unsupported binary type. Use PDF or text formats.'};
});
ipcMain.handle('doc:clear', async()=>{ docContext={name:'',text:''}; return {ok:true}; });
ipcMain.handle('doc:setUse', async(_e, flag)=>{ useDoc = !!flag; return { ok:true, useDoc }; });

// (Web+ backend toggle kept; UI removed)
ipcMain.handle('webplus:set', async(_e, flag)=>{ webPlus = !!flag; send('log', `[Web+] ${webPlus?'enabled':'disabled'}`); return { ok:true, webPlus }; });

// ---------------- Window controls / env ----------------
ipcMain.handle('window:minimize', ()=>{ if(win && !win.isDestroyed()) win.minimize(); });
ipcMain.handle('window:maximize', ()=>{ if(!win||win.isDestroyed()) return; if(win.isMaximized()) win.unmaximize(); else win.maximize(); });
ipcMain.handle('window:close', ()=>app.exit(0));
ipcMain.handle('env:get', ()=>({
  APP_NAME: process.env.APP_NAME || 'HaloAI',
  OPENAI_API_KEY: !!process.env.OPENAI_API_KEY,
  FALLBACK_MODEL: process.env.FALLBACK_MODEL || 'gpt-4o-mini'
}));
