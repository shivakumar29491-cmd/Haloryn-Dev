describe("webRaceEngine", () => {
  test("returns first provider answer and records success", async () => {
    const recordSuccess = jest.fn();
    const recordError = jest.fn();
    jest.isolateModules(() => {
      jest.doMock("../electron/search/searchRouter", () => ({
        queryProvider: jest.fn((provider) =>
          provider === "bing"
            ? Promise.resolve({ answer: "bing answer" })
            : new Promise(() => {})
        )
      }), { virtual: true });

      jest.doMock("../electron/providerStats", () => ({ recordSuccess, recordError }), { virtual: true });

      const { webRace } = require("../electron/webRaceEngine");
      return webRace("hi").then((res) => {
        expect(res.provider).toBe("bing");
        expect(res.answer).toBe("bing answer");
        expect(recordSuccess).toHaveBeenCalled();
        expect(recordError).not.toHaveBeenCalled();
      });
    });
  });
});
