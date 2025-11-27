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
