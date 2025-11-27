jest.mock("groq-sdk");

const { groqFastAnswer, groqWhisperTranscribe } = require("../electron/groqEngine");

describe("groqEngine", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("groqFastAnswer calls chat completions with prefixed context", async () => {
    const res = await groqFastAnswer("hello", "doc text", "DocName");
    expect(res).toBe("mock");
  });

  test("groqWhisperTranscribe returns text from audio transcription", async () => {
    const text = await groqWhisperTranscribe(Buffer.from("audio"));
    expect(text).toBe("transcribed");
  });

  test("groqFastAnswer returns empty string on error", async () => {
    jest.resetModules();
    jest.doMock("groq-sdk", () =>
      jest.fn().mockImplementation(() => ({
        chat: { completions: { create: jest.fn(() => { throw new Error("fail"); }) } }
      }))
    );
    const { groqFastAnswer: fast } = require("../electron/groqEngine");
    const res = await fast("hi");
    expect(res).toBe("");
  });
});
