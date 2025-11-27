window.addEventListener("DOMContentLoaded", async () => {
  // Fetch summary from main.js (non-blocking for close button)
  let summary = null;
  try {
    summary = await window.sessionAPI?.get?.();
    const detail = document.getElementById("sessionDetail");
    const t = document.getElementById("detailTranscript");
    const r = document.getElementById("detailResponses");

    if (summary) {
      document.getElementById("dur").innerText   = summary.duration || "";
      document.getElementById("qs").innerText    = summary.questions ?? "";
      document.getElementById("as").innerText    = summary.answers ?? "";
      document.getElementById("words").innerText = summary.words ?? "";
    }

    if (detail && t) {
      const stripLabel = (s = "") => s.replace(/^(You:|Haloryn:)\s*/i, "").trim();

      const pairs = Array.isArray(summary?.pairs) ? summary.pairs : null;
      const frag = document.createDocumentFragment();

      if (pairs && pairs.length) {
        pairs.forEach(({ prompt, response }) => {
          const userLine = document.createElement("div");
          userLine.className = "pair-line";
          const userLabel = document.createElement("span");
          userLabel.className = "label";
          userLabel.textContent = "You:";
          const userText = document.createElement("span");
          userText.className = "pair-text";
          userText.textContent = stripLabel(prompt || "");
          userLine.appendChild(userLabel);
          userLine.appendChild(userText);
          frag.appendChild(userLine);

          if (response) {
            const aiLine = document.createElement("div");
            aiLine.className = "pair-line";
            const aiLabel = document.createElement("span");
            aiLabel.className = "label";
            aiLabel.textContent = "Haloryn:";
            const aiText = document.createElement("span");
            aiText.className = "pair-text";
            aiText.textContent = stripLabel(response || "");
            aiLine.appendChild(aiLabel);
            aiLine.appendChild(aiText);
            frag.appendChild(aiLine);
          }
        });
      } else {
        const prompts = (summary?.transcript || "")
          .split(/\r?\n+/)
          .map(s => stripLabel(s))
          .filter(Boolean);
        let respArr = [];
        if (Array.isArray(summary?.responses) && summary.responses.length) {
          respArr = summary.responses.slice();
        } else if (summary?.answersText) {
          respArr = summary.answersText
            .split(/\n\s*\n/)
            .map(s => s.trim())
            .filter(Boolean);
        }

        const maxLen = Math.max(prompts.length, respArr.length);
        for (let i = 0; i < maxLen; i++) {
          const userLine = document.createElement("div");
          userLine.className = "pair-line";
          const userLabel = document.createElement("span");
          userLabel.className = "label";
          userLabel.textContent = "You:";
          const userText = document.createElement("span");
          userText.className = "pair-text";
          userText.textContent = stripLabel(prompts[i] || "");
          userLine.appendChild(userLabel);
          userLine.appendChild(userText);
          frag.appendChild(userLine);

          const aiLine = document.createElement("div");
          aiLine.className = "pair-line";
          const aiLabel = document.createElement("span");
          aiLabel.className = "label";
          aiLabel.textContent = "Haloryn:";
          const aiText = document.createElement("span");
          aiText.className = "pair-text";
          aiText.textContent = stripLabel(respArr[i] || "");
          aiLine.appendChild(aiLabel);
          aiLine.appendChild(aiText);
          frag.appendChild(aiLine);
        }
      }

      t.innerHTML = "";
      if (frag.children.length) {
        t.appendChild(frag);
      } else {
        t.textContent = "(none)";
      }
      if (r) {
        r.textContent = "";
        r.parentElement?.classList.add("hidden");
      }
      detail.classList.remove("hidden");
    }
  } catch {}

  // Close summary + quit app
  const closeBtn = document.getElementById("closeSummary");
  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      try {
        if (window.windowCtl?.exitApp) {
          window.windowCtl.exitApp();
          return;
        }
        window.electron?.send?.("exit-app");
        window.close();
        setTimeout(() => { try { window.close(); } catch {} }, 100);
      } catch (e) {
        try { window.close(); } catch {}
      }
    });
  }
});
