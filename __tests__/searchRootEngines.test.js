jest.mock("node-fetch", () => jest.fn());
jest.mock("groq-sdk");

const fetch = require("node-fetch");

describe("searchRoot engines", () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  test("unifiedWebSearch returns empty on error", async () => {
    fetch.mockResolvedValue({
      json: () => Promise.reject(new Error("fail"))
    });
    const { unifiedWebSearch } = require("../electron/searchRoot/searchRouter");
    const res = await unifiedWebSearch("q");
    expect(res).toEqual([]);
  });

  test("braveApi search returns mapped results", async () => {
    const { BraveApi } = require("../electron/searchRoot/engines/braveApi");
    fetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          web: { results: [{ title: "T", description: "D", url: "https://x" }] }
        })
    });
    const brave = new BraveApi({ apiKey: "k", log: jest.fn() });
    const res = await brave.search("hello", 2);
    expect(Array.isArray(res)).toBe(true);
  });

  test("groqSearch returns fallback array", async () => {
    const { groqSearch } = require("../electron/searchRoot/engines/groqApi");
    const res = await groqSearch("hi");
    expect(Array.isArray(res)).toBe(true);
  });
});
