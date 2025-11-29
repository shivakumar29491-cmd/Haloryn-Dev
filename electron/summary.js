window.addEventListener("DOMContentLoaded", async () => {
  console.log("SUMMARY SCRIPT ACTIVE");

  // 🔹 Attach Summary Close Handler FIRST (so it always works)
  const closeBtn = document.getElementById("closeSummary");
  console.log("CLOSE BUTTON FOUND:", closeBtn);

  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      console.log("SUMMARY CLOSE CLICKED");
      window.electronAPI.exitApp();
    });
  }

  console.log("SUMMARY DOM READY");

  // 🔹 Fetch summary from main.js
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
  } catch (e) {
    console.error("SUMMARY ERROR:", e);
  }
});
