jest.mock("../electron/api/search/braveApi", () =>
  jest.fn(async (query) => ({
    results: [{ title: `brave-${query}`, snippet: "s", url: "u" }]
  }))
);

jest.mock("../electron/api/search/serpapi", () =>
  jest.fn(async () => {
    throw new Error("serpapi down");
  })
);

jest.mock("../electron/api/search/googlePSE", () =>
  jest.fn(async (query) => ({
    results: [{ title: `google-${query}`, snippet: "s", url: "u" }]
  }))
);

jest.mock("../electron/api/search/bing", () =>
  jest.fn(async (query) => ({
    results: [{ title: `bing-${query}`, snippet: "s", url: "u" }]
  }))
);

jest.mock("../electron/api/search/groq", () =>
  jest.fn(async (query) => ({
    results: [{ title: `groq-${query}`, snippet: "s", url: "u" }]
  }))
);

const { unifiedSearch } = require("../electron/api/search/router");

describe("unifiedSearch router", () => {
  test("returns empty array for empty query", async () => {
    const res = await unifiedSearch("");
    expect(res).toEqual([]);
  });

  test("runs providers in order and flattens results", async () => {
    const res = await unifiedSearch("hello", 2);
    // serpapi throws but should not break the pipeline
    const providersReturned = res.map((r) => r.title.split("-")[0]);
    expect(providersReturned).toEqual(
      expect.arrayContaining(["brave", "google", "bing", "groq"])
    );
    expect(res.length).toBeGreaterThanOrEqual(4);
  });
});
