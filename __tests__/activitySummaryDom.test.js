/** @jest-environment jsdom */

describe("activity and summary DOM scripts", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="activityWrapper"></div>
      <button id="startSessionBtn"></button>
      <div class="card"></div>
      <div id="timeline-today"></div>
      <div id="timeline-yesterday"></div>
      <div id="timeline-older"></div>
      <div id="heroUserName"></div>
      <div id="heroUserMeta"></div>
      <div id="welcomeLine"></div>
      <div id="activityUserChip"></div>
      <div id="activityUserMenu" class="hidden"></div>
      <div id="activityAccount"></div>
      <div id="activitySignout"></div>
      <div id="sessionDetail" class="hidden"></div>
      <div id="detailTranscript"></div>
      <div id="detailResponses"></div>
      <div id="dur"></div><div id="qs"></div><div id="as"></div><div id="words"></div>
      <button id="closeSummary"></button>
    `;
    jest.resetModules();
  });

  test("activity.js loads history and user session into DOM", async () => {
    window.electron = {
      invoke: jest.fn((channel) => {
        if (channel === "activity:history") {
          return Promise.resolve([
            { ts: Date.now(), summary: { duration: "5m", questions: 1, answers: 1, words: 10 } }
          ]);
        }
        return Promise.resolve();
      })
    };
    window.companion = { startSession: jest.fn() };
    window.electronAPI = { getUserSession: jest.fn().mockResolvedValue({ displayName: "Test", email: "t@x" }) };

    require("../electron/activity.js");

    window.dispatchEvent(new Event("DOMContentLoaded"));
    await new Promise((r) => setTimeout(r, 10));
    const today = document.getElementById("timeline-today");
    expect(today.children.length).toBeGreaterThan(0);
    expect(document.getElementById("heroUserName").textContent).toBe("Test");
  });

  test("summary.js renders pairs and wires close button", async () => {
    const exitMock = jest.fn();
    window.sessionAPI = { get: jest.fn().mockResolvedValue({
      duration: "1m",
      questions: 1,
      answers: 1,
      words: 10,
      pairs: [{ prompt: "You: hi", response: "Haloryn: hello" }]
    }) };
    window.windowCtl = { exitApp: exitMock };
    window.electron = { send: jest.fn() };

    require("../electron/summary.js");
    window.dispatchEvent(new Event("DOMContentLoaded"));
    await new Promise((r) => setTimeout(r, 10));

    const detail = document.getElementById("sessionDetail");
    expect(detail.classList.contains("hidden")).toBe(false);
    const transcript = document.getElementById("detailTranscript").textContent;
    expect(transcript).toMatch(/hi/);

    document.getElementById("closeSummary").click();
    expect(exitMock).toHaveBeenCalled();
  });
});
