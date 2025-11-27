jest.mock("node-fetch");
jest.mock("groq-sdk");

const fetch = require("node-fetch");
const brave = require("../electron/api/search/braveApi");
const googlePSE = require("../electron/api/search/googlePSE");
const serpapi = require("../electron/api/search/serpapi");
const bing = require("../electron/api/search/bing");

function createRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe("search providers", () => {
  afterEach(() => {
    jest.clearAllMocks();
    delete process.env.BRAVE_API_KEY;
    delete process.env.GOOGLE_PSE_KEY;
    delete process.env.GOOGLE_PSE_CX;
    delete process.env.SERPAPI_KEY;
    delete process.env.BING_API_KEY;
    delete process.env.GROQ_API_KEY;
  });

  test("brave missing key returns 500", async () => {
    const res = createRes();
    await brave({ body: { query: "hi" } }, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });

  test("brave success normalizes results", async () => {
    process.env.BRAVE_API_KEY = "k";
    fetch.mockResolvedValue({
      json: () =>
        Promise.resolve({
          web: { results: [{ title: "T", description: "D", url: "u" }] }
        })
    });
    const res = createRes();
    await brave({ body: { query: "hi", maxResults: 2 } }, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalled();
    const payload = res.json.mock.calls[0][0] || {};
    expect(payload.results?.[0]).toMatchObject({ title: "T", provider: "brave" });
  });

  test("googlePSE missing envs returns 500", async () => {
    const res = createRes();
    await googlePSE({ body: { query: "hi" } }, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });

  test("serpapi missing key returns 500", async () => {
    const res = createRes();
    await serpapi({ body: { query: "hi" } }, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });

  test("bing missing key returns 500", async () => {
    const res = createRes();
    await bing({ body: { query: "hi" } }, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });

  test("groq search returns answer content", async () => {
    process.env.GROQ_API_KEY = "k";
    const res = createRes();

    let promise;
    jest.isolateModules(() => {
      jest.doMock(
        "groq-sdk",
        () =>
          class Groq {
            constructor() {
              this.chat = {
                completions: {
                  create: jest.fn().mockResolvedValue({
                    choices: [{ message: { content: "mock answer" } }]
                  })
                }
              };
            }
          },
        { virtual: true }
      );

      const groqSearch = require("../electron/api/search/groq");
      promise = groqSearch({ body: { query: "hi" } }, res);
    });
    await promise;

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalled();
    const payload = res.json.mock.calls[0][0] || {};
    expect(payload.results?.[0]).toMatchObject({ provider: "groq" });
  });
});
