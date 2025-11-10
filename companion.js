// companion.js
const { EventEmitter } = require('events');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

class LiveCompanion extends EventEmitter {
  constructor(opts) {
    super();
    this.opts = Object.assign({
      soxBin: process.env.SOX_BIN || 'sox',
      whisperBin: process.env.WHISPER_BIN || 'whisper.exe', // or whisper
      whisperModel: process.env.WHISPER_MODEL || 'base.en',
      chunkSec: 8,
      maxSummaryChars: 4000,
      openaiKey: process.env.OPENAI_API_KEY || '',
      useWebFallback: true
    }, opts || {});
    this._running = false;
    this._rec = null;
    this._timer = null;
    this._tmp = path.join(os.tmpdir(), 'halo_live_companion');
    if (!fs.existsSync(this._tmp)) fs.mkdirSync(this._tmp, { recursive: true });
  }

  isRunning() { return this._running; }

  start() {
    if (this._running) return;
    this._running = true;
    this.emit('state', { running: true });

    // continuous short files: file-0001.wav, file-0002.wav...
    let idx = 0;
    const loop = async () => {
      if (!this._running) return;
      const wav = path.join(this._tmp, `chunk-${String(++idx).padStart(4,'0')}.wav`);

      // Record a short chunk
      await this._recordChunk(wav);

      // Transcribe
      const text = await this._whisper(wav).catch(() => '');
      if (text && text.trim().length) {
        this.emit('transcript', { text, wav });
        // Summarize/hint (OpenAI if key, else web fallback via your existing pipeline)
        const suggestion = await this._summarize(text).catch(() => '');
        if (suggestion) this.emit('suggestion', { suggestion, source: 'ai' });
      }

      // next chunk
      if (this._running) setImmediate(loop);
    };
    loop();
  }

  stop() {
    this._running = false;
    if (this._rec) { try { this._rec.kill('SIGKILL'); } catch {} }
    this.emit('state', { running: false });
  }

  async _recordChunk(outWav) {
    // Windows waveaudio device; adjust if you have a selected device string already in your baseline
    const args = ['-q', '-t', 'waveaudio', 'default', outWav, 'trim', '0', String(this.opts.chunkSec), 'silence', '1', '0.1', '1%'];
    await new Promise((resolve) => {
      this._rec = spawn(this.opts.soxBin, args);
      this._rec.on('close', () => resolve());
      this._rec.on('error', () => resolve());
    });
  }

  async _whisper(wavPath) {
    return await new Promise((resolve) => {
      const outTxt = wavPath.replace(/\.wav$/i, '.txt');
      const args = ['-m', this.opts.whisperModel, '-f', wavPath, '-otxt', '-of', wavPath.replace(/\.wav$/i, '')];
      const p = spawn(this.opts.whisperBin, args);
      p.on('close', () => {
        try {
          const text = fs.readFileSync(outTxt, 'utf8');
          resolve(text.trim());
        } catch { resolve(''); }
      });
      p.on('error', () => resolve(''));
    });
  }

  async _summarize(text) {
    // Simple prompt to convert raw transcript -> helpful suggestion for the chat box
    const prompt = `You are a real-time assistant. Given this fresh transcript chunk, return a SHORT suggestion the user might want to do next (max 1–2 sentences). Transcript:\n"""${text.slice(-this.opts.maxSummaryChars)}"""`;

    if (this.opts.openaiKey) {
      // Use your existing OpenAI call (reuse the helper you have in main.js if available)
      const fetch = require('node-fetch');
      const r = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.opts.openaiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.2
        })
      });
      const j = await r.json();
      return j?.choices?.[0]?.message?.content?.trim() || '';
    } else if (this.opts.useWebFallback) {
      // Minimal fallback: just echo a concise action line
      return `Heard: “${text.slice(0, 120)}…”. You can ask: “Summarize and extract action items.”`;
    } else {
      return '';
    }
  }
}

module.exports = { LiveCompanion };
