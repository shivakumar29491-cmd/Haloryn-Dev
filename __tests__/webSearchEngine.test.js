jest.mock("node-fetch", () => jest.fn());
const fetch = require("node-fetch");

describe("webSearchEngine", () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  test("searchWeb uses fallback engine and returns results", async () => {
    const html = `
      <div class="result">
        <a class="result__a" href="https://example.com">Example</a>
        <div class="result__snippet">Snippet</div>
      </div>`;

    fetch.mockResolvedValue({
      text: () => Promise.resolve(html)
    });

    const { searchWeb } = require("../electron/webSearchEngine");
    const results = await searchWeb("hello", 3);
    expect(Array.isArray(results)).toBe(true);
  });

  test("fetchAndExtract returns null on HTTP failure", async () => {
    fetch.mockResolvedValue({ ok: false });
    const { fetchAndExtract } = require("../electron/webSearchEngine");
    const res = await fetchAndExtract("https://bad.com");
    expect(res).toBeNull();
  });
});
