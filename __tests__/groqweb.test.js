jest.mock("node-fetch");

const fetch = require("node-fetch");
const groqweb = require("../electron/api/groqweb");

describe("groqweb handler", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
    delete process.env.GROQ_API_KEY;
  });

  afterEach(() => {
    console.error.mockRestore();
  });

  test("returns error when missing key", async () => {
    const res = await groqweb("hi");
    expect(res.ok).toBe(false);
  });

  test("returns trimmed answer", async () => {
    process.env.GROQ_API_KEY = "k";
    fetch.mockResolvedValue({
      json: () =>
        Promise.resolve({
          choices: [{ message: { content: "  hello  " } }]
        })
    });

    const res = await groqweb("hi there");
    expect(res).toEqual({ ok: true, answer: "hello" });
    expect(fetch).toHaveBeenCalled();
  });
});
