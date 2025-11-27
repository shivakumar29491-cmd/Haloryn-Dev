jest.mock("node-fetch", () => jest.fn());

describe("qaEngine answer routing", () => {
  const fetch = require("node-fetch");

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("prefers hybrid doc+web when docLikely", async () => {
    const webRace = jest.fn().mockResolvedValue("web answer");
    const detectIntent = jest.fn().mockReturnValue({ docLikely: true, webLikely: false });
    const extractiveSummary = jest.fn().mockReturnValue("doc summary");
    const setLogger = jest.fn();

    let answerFn;
    jest.isolateModules(() => {
      jest.doMock("../electron/search/webRaceEngine", () => ({ webRace }), { virtual: true });
      jest.doMock("../electron/intentClassifier", () => ({ detectIntent }), { virtual: true });
      jest.doMock("../electron/textUtils", () => ({ extractiveSummary }), { virtual: true });
      jest.doMock("../electron/webSearchEngine", () => ({ setLogger }), { virtual: true });
      const qa = require("../electron/qaEngine");
      qa.setDocContext({ name: "doc", text: "doc body" });
      answerFn = qa.answer;
    });

    const res = await answerFn("question");
    expect(res).toContain("doc summary");
    expect(webRace).toHaveBeenCalled();
  });

  test("uses web answer when webLikely", async () => {
    const webRace = jest.fn().mockResolvedValue("web only");
    const detectIntent = jest.fn().mockReturnValue({ docLikely: false, webLikely: true });
    jest.isolateModules(() => {
      jest.doMock("../electron/search/webRaceEngine", () => ({ webRace }), { virtual: true });
      jest.doMock("../electron/intentClassifier", () => ({ detectIntent }), { virtual: true });
      jest.doMock("../electron/textUtils", () => ({ extractiveSummary: () => "" }), { virtual: true });
      jest.doMock("../electron/webSearchEngine", () => ({ setLogger: () => {} }), { virtual: true });
      const qa = require("../electron/qaEngine");
      qa.setDocContext({ name: "", text: "" });
      answerFn = qa.answer;
    });

    const res = await answerFn("question");
    expect(res).toBe("web only");
  });

  test("falls back to fastGroq when web/doc empty", async () => {
    fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ choices: [{ message: { content: "groq answer" } }] })
    });
    const webRace = jest.fn().mockResolvedValue("");
    const detectIntent = jest.fn().mockReturnValue({ docLikely: false, webLikely: false });

    jest.isolateModules(() => {
      jest.doMock("../electron/search/webRaceEngine", () => ({ webRace }), { virtual: true });
      jest.doMock("../electron/intentClassifier", () => ({ detectIntent }), { virtual: true });
      jest.doMock("../electron/textUtils", () => ({ extractiveSummary: () => "" }), { virtual: true });
      jest.doMock("../electron/webSearchEngine", () => ({ setLogger: () => {} }), { virtual: true });
      const qa = require("../electron/qaEngine");
      qa.setDocContext({ name: "", text: "" });
      answerFn = qa.answer;
    });

    const res = await answerFn("question");
    expect(res).toBe("groq answer");
  });
});
