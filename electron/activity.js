const startBtn = document.getElementById("startSessionBtn");
const cards = Array.from(document.querySelectorAll(".card"));

function startSession() {
  const wrapper = document.getElementById("activityWrapper");
  if (wrapper) wrapper.classList.add("slide-up");

  // Fallback to electron IPC if companion bridge is missing
  setTimeout(() => {
    if (window.companion && typeof window.companion.startSession === "function") {
      window.companion.startSession();
    } else if (window.electron && typeof window.electron.send === "function") {
      window.electron.send("start-session");
    }
  }, 450);
}

if (startBtn) startBtn.addEventListener("click", startSession);
cards.forEach(c => c.addEventListener("click", startSession));

// Populate basic activity timeline with history from main
async function loadHistory() {
  try {
    const history = await window.electron?.invoke?.("activity:history");
    if (!history || !Array.isArray(history) || history.length === 0) return;

    const today = document.getElementById("timeline-today");
    const yesterday = document.getElementById("timeline-yesterday");
    const older = document.getElementById("timeline-older");
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;

    history.forEach((entry) => {
      const ts = entry?.ts || now;
      const when = now - ts;
      const target = when < oneDay ? today : when < 2 * oneDay ? yesterday : older;
      if (!target) return;
      const item = document.createElement("div");
      item.className = "timeline-item";
      const s = entry?.summary || {};
      const label = `Session — duration ${s.duration || "n/a"}, questions ${s.questions ?? "0"}, AI responses ${s.answers ?? "0"}, transcript length ${s.words ?? "0"}`;
      const link = document.createElement("a");
      link.href = "#";
      link.textContent = label;
      link.addEventListener("click", (e) => {
        e.preventDefault();
        // Open the summary page with this entry loaded
        window.electron?.invoke?.("summary:show-entry", s);
      });
      item.appendChild(link);
      target.appendChild(item);
    });
  } catch (e) {
    console.error("history load error", e);
  }
}

window.addEventListener("DOMContentLoaded", loadHistory);
