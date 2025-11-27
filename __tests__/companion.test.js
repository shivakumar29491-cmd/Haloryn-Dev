const { LiveCompanion } = require("../electron/companion");

describe("LiveCompanion", () => {
  test("_cleanTranscript collapses whitespace", () => {
    const lc = new LiveCompanion({ useWebFallback: false });
    expect(lc._cleanTranscript("hello   \n\nworld")).toBe("hello world");
  });

  test("_runWhisperChunk emits transcript and suggestion", async () => {
    const lc = new LiveCompanion({ useWebFallback: false });
    lc._whisper = jest.fn().mockResolvedValue("test transcript");
    lc._summarize = jest.fn().mockResolvedValue("do a thing");

    const transcriptCb = jest.fn();
    const suggestionCb = jest.fn();
    lc.on("transcript", transcriptCb);
    lc.on("suggestion", suggestionCb);

    await lc._runWhisperChunk("file.wav");

    expect(lc._whisper).toHaveBeenCalledWith("file.wav");
    expect(transcriptCb).toHaveBeenCalledWith({ text: "test transcript", wav: "file.wav" });
    expect(suggestionCb).toHaveBeenCalledWith({ suggestion: "do a thing", source: "ai" });
    expect(lc._whisperRunning).toBe(false);
  });

  test("_runWhisperChunk ignores empty transcript", async () => {
    const lc = new LiveCompanion({ useWebFallback: false });
    lc._whisper = jest.fn().mockResolvedValue("");
    const transcriptCb = jest.fn();
    lc.on("transcript", transcriptCb);
    await lc._runWhisperChunk("file.wav");
    expect(transcriptCb).not.toHaveBeenCalled();
  });

  test("stop toggles running flag and kills recorder if present", () => {
    const lc = new LiveCompanion();
    lc._rec = { kill: jest.fn() };
    lc._running = true;
    lc.stop();
    expect(lc.isRunning()).toBe(false);
    expect(lc._rec.kill).toHaveBeenCalled();
  });
});
