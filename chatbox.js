class ChatBox {
  constructor({ inputEl, sendBtn, answerArea, fileBtn, fileInput, badge }) {
    this.input     = inputEl;
    this.sendBtn   = sendBtn;
    this.answer    = answerArea;
    this.fileBtn   = fileBtn;
    this.fileInput = fileInput;
    this.badge     = badge;
    this.bind();
  }

  bind() {
    if (this.sendBtn) {
      this.sendBtn.addEventListener('click', () => this.submit());
    }
    if (this.input) {
      this.input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') this.submit();
      });
    }
    if (this.fileBtn && this.fileInput) {
      this.fileBtn.addEventListener('click', () => this.fileInput.click());
      this.fileInput.addEventListener('change', () => this.ingest());
    }
    if (this.badge) {
      this.badge.addEventListener('click', async () => {
        await window.electron.invoke('doc:clear');
        this.badge.classList.add('hidden');
        this.badge.textContent = '';
      });
    }
  }

  async submit() {
    const q = this.input?.value?.trim();
    if (!q) return;
    this.input.value = '';
    const ans = await window.electron.invoke('chat:ask', q);
    if (this.answer) {
      this.answer.value = (this.answer.value ? this.answer.value + '\n---\n' : '') + (ans || '');
      this.answer.scrollTop = this.answer.scrollHeight;
    }
  }

  async ingest() {
    const f = this.fileInput?.files?.[0];
    if (!f) return;
    try {
      if (f.name.toLowerCase().endsWith('.txt')) {
        const text = await f.text();
        const res = await window.electron.invoke('doc:ingestText', { name: f.name, text });
        if (res?.ok) this.showBadge(f.name, res.chars);
      } else if (f.name.toLowerCase().endsWith('.pdf')) {
        const ab = await f.arrayBuffer();
        const bytes = Array.from(new Uint8Array(ab));
        const res = await window.electron.invoke('doc:ingestBinary', { name: f.name, bytes, mime: f.type || 'application/pdf' });
        if (res?.ok) this.showBadge(f.name, res.chars);
      }
    } finally {
      if (this.fileInput) this.fileInput.value = '';
    }
  }

  showBadge(name, count) {
    if (!this.badge) return;
    const pretty = name.length > 28 ? '…' + name.slice(-28) : name;
    this.badge.textContent = `${pretty} • ${count} chars  ×`;
    this.badge.title = 'Click to remove';
    this.badge.classList.remove('hidden');
  }
}

(() => {
  const inputEl = document.getElementById('chatInput');
  const sendBtn = document.getElementById('chatSend');
  const ans     = document.getElementById('liveAnswer');
  const fileBtn = document.getElementById('fileBtn');
  const fileInp = document.getElementById('docInput');
  const badge   = document.getElementById('docBadge');

  if (inputEl && sendBtn) new ChatBox({
    inputEl, sendBtn, answerArea: ans, fileBtn, fileInput: fileInp, badge
  });
})();
