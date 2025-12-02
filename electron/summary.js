window.addEventListener("DOMContentLoaded", async () => {
  console.log("SUMMARY SCRIPT ACTIVE");

  // Attach Summary Close Handler
  const closeBtn = document.getElementById("closeSummary");
  console.log("CLOSE BUTTON FOUND:", closeBtn);

  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      console.log("SUMMARY CLOSE CLICKED");
      window.electronAPI.exitApp();
    });
  }

  console.log("SUMMARY DOM READY");

  let summary = null;

  try {
    summary = await window.electronAPI.getSummary();


    const detail = document.getElementById("sessionDetail");
    const t = document.getElementById("detailTranscript");
    const r = document.getElementById("detailResponses");

    if (!detail || !t) return;

    const stripLabel = (s = "") =>
      s.replace(/^(You:|Haloryn:)\s*/i, "").trim();

    const frag = document.createDocumentFragment();

    // ============================================================
    // BLOCK MODE — Build blocks from summary.pairs[]
    // Each block = { you: "...", haloryn: "..." }
    // ============================================================

    const rawPairs = Array.isArray(summary?.pairs) ? summary.pairs : [];
    const blocks = [];

    // Build blocks: every user + next assistant becomes ONE turn
    for (let i = 0; i < rawPairs.length; i++) {
      const turn = rawPairs[i];

      if (turn.role === "user") {
        const next = rawPairs[i + 1];
        const userText = stripLabel(turn.text || "");
        let aiText = "";

        if (next && next.role === "assistant") {
          aiText = stripLabel(next.text || "");
          i++; // skip assistant
        }

        blocks.push({
          you: userText,
          haloryn: aiText
        });
      }
    }

    // ============================================================
    // RENDER BLOCKS
    // ============================================================

    for (const block of blocks) {
      // ---------------- USER LINE ----------------
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

      // ---------------- AI LINE ----------------
      const aiLine = document.createElement("div");
      aiLine.className = "pair-line";

      const aiLabel = document.createElement("span");
      aiLabel.className = "label";
      aiLabel.textContent = "Haloryn:";

      const aiText = document.createElement("span");
      aiText.className = "pair-text";

      // preserve multi-lines
      aiText.innerHTML = (block.haloryn || "").replace(/\n/g, "<br>");

      aiLine.appendChild(aiLabel);
      aiLine.appendChild(aiText);
      frag.appendChild(aiLine);
    }

    // ============================================================
    // RENDER UI
    // ============================================================
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

  } catch (e) {
    console.error("SUMMARY ERROR:", e);
  }
});
