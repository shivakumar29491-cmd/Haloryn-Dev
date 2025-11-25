window.addEventListener("DOMContentLoaded", async () => {

  // Fetch summary from main.js
  const summary = await window.sessionAPI.get();

  if (summary) {
    document.getElementById("dur").innerText   = summary.duration;
    document.getElementById("qs").innerText    = summary.questions;
    document.getElementById("as").innerText    = summary.answers;
    document.getElementById("words").innerText = summary.words;
  }

  // Close summary → quit app
  document.getElementById("closeSummary").addEventListener("click", () => {
    window.windowCtl.exitApp();
  });

  // Back to Activity button
  document.getElementById("finishBtn").addEventListener("click", () => {
    window.windowCtl.finishSession();
  });
});
