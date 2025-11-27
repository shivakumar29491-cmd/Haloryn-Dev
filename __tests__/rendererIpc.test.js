/** @jest-environment jsdom */

const fs = require("fs");
const path = require("path");
const vm = require("vm");

function loadRendererScript() {
  const code = fs.readFileSync(path.join(__dirname, "..", "electron", "renderer.js"), "utf16le");
  const sandbox = {
    window,
    document,
    console,
    performance: { now: () => 0 },
    requestAnimationFrame: (fn) => fn(),
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval
  };
  vm.runInNewContext(code, sandbox, { filename: "renderer.js" });
}

describe("renderer IPC wiring", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="transcript-container"></div>
      <textarea id="liveTranscript"></textarea>
      <div id="liveAnswer"></div>
      <button id="incognitoToggle"></button>
      <button id="docToggle"></button>
      <button id="docEnrichToggle"></button>
      <select id="searchMode"><option value="fastest">fastest</option><option value="balanced">balanced</option></select>
      <div id="liveState"></div>
    `;

    const invokeMock = jest.fn(async (channel, payload) => {
      if (channel === "incognito:get") return { incognito: false };
      if (channel === "incognito:set") return { incognito: payload };
      if (channel === "doc:setUse") return { useDoc: payload };
      if (channel === "doc:enrich:set") return { docEnrich: payload };
      if (channel === "searchPrefs:set") return { mode: payload?.mode };
      return {};
    });

    window.electron = {
      invoke: invokeMock,
      on: jest.fn(),
      send: jest.fn()
    };
    window.windowCtl = { endSession: jest.fn() };
  });

  test("incognito toggle calls IPC and updates UI", async () => {
    loadRendererScript();
    document.dispatchEvent(new Event("DOMContentLoaded"));

    // allow incognito:get promise to resolve
    await new Promise((r) => setTimeout(r, 0));

    const incognitoToggle = document.getElementById("incognitoToggle");
    incognitoToggle.click();
    await new Promise((r) => setTimeout(r, 0));

    const { invoke } = window.electron;
    expect(invoke).toHaveBeenCalledWith("incognito:set", true);
    expect(incognitoToggle.classList.contains("active")).toBe(true);
  });

  test("doc and search mode toggles invoke backend", async () => {
    loadRendererScript();
    document.dispatchEvent(new Event("DOMContentLoaded"));

    const docToggle = document.getElementById("docToggle");
    docToggle.click();
    const docEnrichToggle = document.getElementById("docEnrichToggle");
    docEnrichToggle.click();

    const searchMode = document.getElementById("searchMode");
    searchMode.value = "balanced";
    searchMode.dispatchEvent(new Event("change", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 0));

    const calls = window.electron.invoke.mock.calls.map((c) => c[0]);
    expect(calls).toEqual(expect.arrayContaining(["doc:setUse", "doc:enrich:set", "searchPrefs:set"]));
  });
});
