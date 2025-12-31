// ===== Summary Renderer =====
window.addEventListener("DOMContentLoaded", async () => {
  console.log("SUMMARY SCRIPT ACTIVE");

  const closeBtn = document.getElementById("closeSummary");
  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      window.electronAPI.exitApp();
    });
  }

  try {
    const summary = await window.electronAPI.getSummary();
    const detail = document.getElementById("sessionDetail");
    const transcriptEl = document.getElementById("detailTranscript");
    const responsesEl = document.getElementById("detailResponses");

    if (!detail || !transcriptEl) return;

    const stripLabel = (s = "") => s.replace(/^(You:|Haloryn:)\s*/i, "").trim();
    const frag = document.createDocumentFragment();
    const rawPairs = Array.isArray(summary?.pairs) ? summary.pairs : [];
    const blocks = [];

    for (let i = 0; i < rawPairs.length; i++) {
      const turn = rawPairs[i];
      if (turn.role === "user") {
        const next = rawPairs[i + 1];
        const userText = stripLabel(turn.text || "");
        let aiText = "";
        if (next && next.role === "assistant") {
          aiText = stripLabel(next.text || "");
          i++;
        }
        blocks.push({ you: userText, haloryn: aiText });
      }
    }

    for (const block of blocks) {
      const userLine = document.createElement("div");
      userLine.className = "pair-line";
      const userLabel = document.createElement("span");
      userLabel.className = "label";
      userLabel.textContent = "You:";
      const userText = document.createElement("span");
      userText.className = "pair-text";
      userText.textContent = block.you;
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
      aiText.innerHTML = (block.haloryn || "").replace(/\n/g, "<br>");
      aiLine.appendChild(aiLabel);
      aiLine.appendChild(aiText);
      frag.appendChild(aiLine);
    }

    transcriptEl.innerHTML = "";
    if (frag.children.length) {
      transcriptEl.appendChild(frag);
    } else {
      const fallbackText =
        (summary?.transcript || summary?.answersText || "").trim() || "(none)";
      transcriptEl.textContent = fallbackText;
    }

    if (responsesEl) {
      responsesEl.textContent = "";
      responsesEl.parentElement?.classList.add("hidden");
    }

    detail.classList.remove("hidden");
  } catch (e) {
    console.error("SUMMARY ERROR:", e);
  }
});
