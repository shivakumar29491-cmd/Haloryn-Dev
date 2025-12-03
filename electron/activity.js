const startBtn = document.getElementById("startSessionBtn");
const cards = Array.from(document.querySelectorAll(".card"));
const heroUserName = document.getElementById("heroUserName");
const heroUserMeta = document.getElementById("heroUserMeta");
const welcomeLine = document.getElementById("welcomeLine");
const activityUserChip = document.getElementById("activityUserChip");
const activityUserMenu = document.getElementById("activityUserMenu");
const activityAccount = document.getElementById("activityAccount");
const activitySignout = document.getElementById("activitySignout");
const activityLogin = document.getElementById("activityLogin");

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
      const target =
        when < oneDay ? today :
        when < 2 * oneDay ? yesterday :
        older;

      if (!target) return;

      const s = entry?.summary || {};
      const label = `Session — duration ${s.duration || "n/a"}, questions ${s.questions ?? "0"}, AI responses ${s.answers ?? "0"}, transcript length ${s.words ?? "0"}`;

      // ---------- NEW ROW STRUCTURE ----------
      const row = document.createElement("div");
      row.className = "activity-item";
      row.dataset.ts = ts;

      const left = document.createElement("div");
      left.className = "item-left";

      const link = document.createElement("a");
      link.href = "#";
      link.className = "session-link";
      link.textContent = label;

      link.addEventListener("click", (e) => {
        e.preventDefault();
        window.electron?.invoke?.("summary:show-entry", s);
      });

      left.appendChild(link);

      // Timestamp
      const right = document.createElement("div");
      right.className = "item-right";
      right.textContent = formatTimestamp(ts);

      row.appendChild(left);
      row.appendChild(right);

      target.appendChild(row);
    });

  } catch (e) {
    console.error("history load error", e);
  }
}

window.addEventListener("DOMContentLoaded", loadHistory);
// ------- Filter & Clear Logic -------

const rangeDropdown = document.getElementById("historyRange");
const clearBtn = document.getElementById("clearHistoryBtn");

// Filter display only (frontend)
rangeDropdown?.addEventListener("change", () => {
    applyHistoryFilter(rangeDropdown.value);
});

// Clear history for selected range (backend delete)
clearBtn?.addEventListener("click", async () => {
    const range = rangeDropdown.value;
    const ok = confirm(`Clear ${range} history?`);
    if (!ok) return;

    try {
        await window.electronAPI.clearHistoryByRange(range);
        window.location.reload(); // refresh UI
    } catch (e) {
        console.error("Clear history failed:", e);
    }
});

// Frontend filtering
function applyHistoryFilter(range) {
    const allItems = document.querySelectorAll(".activity-item");
    const now = new Date();

    // TODAY START
    const todayStart = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate()
    ).getTime();

    // YESTERDAY START
    const yesterdayStart = todayStart - 86400000;

    // -------- CALENDAR WEEK (MONDAY → SUNDAY) --------
    const dayOfWeek = now.getDay();   // 0=Sun,1=Mon,...6=Sat

    // Calculate this week's Monday
    const mondayThisWeek = new Date(now);
    mondayThisWeek.setHours(0, 0, 0, 0);
    mondayThisWeek.setDate(
        now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1)
    );

    // Last week's Monday
    const mondayLastWeek = new Date(mondayThisWeek);
    mondayLastWeek.setDate(mondayThisWeek.getDate() - 7);

    // Last week's Sunday (end of week)
    const sundayLastWeek = new Date(mondayLastWeek);
    sundayLastWeek.setDate(mondayLastWeek.getDate() + 6);

    const lastWeekStart = mondayLastWeek.getTime();
    const lastWeekEnd = sundayLastWeek.getTime() + 86399999; // end of Sunday 23:59:59

    // --------------------------------------------------

    allItems.forEach(item => {
        const ts = Number(item.dataset.ts || 0);

        let show = true;

        if (range === "today") {
            show = ts >= todayStart;

        } else if (range === "yesterday") {
            show = ts >= yesterdayStart && ts < todayStart;

        } else if (range === "week") {
            // SHOW ONLY entries from last calendar week (Mon–Sun)
            show = ts >= lastWeekStart && ts <= lastWeekEnd;

        } else {
            show = true;
        }

        item.style.display = show ? "flex" : "none";
    });
}

// Populate hero user info
window.addEventListener("DOMContentLoaded", async () => {
  try {
    const session = await window.electronAPI?.getUserSession?.();
    const name = session?.displayName || session?.email || "User";
    const meta = session?.email || session?.phone || session?.provider || "";
    if (heroUserName) heroUserName.textContent = name;
    if (heroUserMeta) heroUserMeta.textContent = meta;
    if (welcomeLine) welcomeLine.textContent = `Welcome back, ${name}`;
    if (activityAccount) activityAccount.textContent = `Account (${name})`;
  } catch {}
});

function toggleActivityMenu(show) {
  if (!activityUserMenu) return;
  const next = show ?? activityUserMenu.classList.contains("hidden");
  if (next) activityUserMenu.classList.remove("hidden");
  else activityUserMenu.classList.add("hidden");
}

if (activityUserChip) {
  activityUserChip.addEventListener("click", () => toggleActivityMenu(true));
}

if (activitySignout) {
  activitySignout.addEventListener("click", async () => {
    toggleActivityMenu(false);
    try { await window.electron?.invoke?.("logout"); } catch {}
  });
}

if (activityAccount) {
  activityAccount.addEventListener("click", async () => {
    toggleActivityMenu(false);
    try { await window.electron?.invoke?.("load-user-info"); } catch {}
  });
}

if (activityLogin) {
  activityLogin.addEventListener("click", async () => {
    toggleActivityMenu(false);
    try { await window.electron?.invoke?.("logout:clear"); } catch {}
  });
}

document.addEventListener("click", (e) => {
  if (!activityUserMenu || activityUserMenu.classList.contains("hidden")) return;
  if (activityUserMenu.contains(e.target) || activityUserChip?.contains(e.target)) return;
  toggleActivityMenu(false);
});
function formatTimestamp(ts) {
    if (!ts) return "";

    const d = new Date(ts);
    const date = d.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric"
    });

    const time = d.toLocaleTimeString(undefined, {
        hour: "2-digit",
        minute: "2-digit"
    });

    return `${date} • ${time}`;
}
