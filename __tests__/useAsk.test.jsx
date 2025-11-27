/** @jest-environment jsdom */
import { renderHook, act } from "@testing-library/react";

jest.mock("../web/src/context/SettingsContext", () => ({
  useSettings: () => ({ model: "groq" })
}));

const useAsk = require("../web/src/hooks/useAsk").default;

describe("useAsk hook", () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test("falls back to search router when groqweb answer is empty", async () => {
    global.fetch
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ ok: true, answer: "" })
      })
      .mockResolvedValueOnce({
        json: () =>
          Promise.resolve({
            results: [{ snippet: "result one" }, { title: "result two" }]
          })
      });

    const { result } = renderHook(() => useAsk());

    await act(async () => {
      await result.current.ask("test prompt");
    });

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/groqweb",
      expect.any(Object)
    );
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/search/router",
      expect.any(Object)
    );
    expect(result.current.answer).toContain("result one");
  });
});
