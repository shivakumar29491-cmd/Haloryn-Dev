jest.mock("fs", () => {
  const store = {};
  return {
    existsSync: jest.fn(() => true),
    mkdirSync: jest.fn(),
    copyFile: jest.fn((a, b, cb) => cb && cb(null)),
    readFileSync: jest.fn(() => "ocr result"),
    writeFileSync: jest.fn()
  };
});

jest.mock("screenshot-desktop", () => jest.fn());

jest.mock("child_process", () => {
  const { EventEmitter } = require("events");
  return {
    spawn: jest.fn(() => {
      const emitter = new EventEmitter();
      // emit exit on next tick
      process.nextTick(() => emitter.emit("exit", 0));
      return emitter;
    }),
    execFile: jest.fn((cmd, args, opts, cb) => {
      if (typeof opts === "function") cb = opts;
      if (cb) cb(null, "", "");
    })
  };
});

describe("screenReader", () => {
beforeEach(() => {
  jest.resetModules();
  jest.resetAllMocks();
  const screenshot = require("screenshot-desktop");
  screenshot.mockReset();
});

  test("ipc handler returns OCR text", async () => {
    const handleMock = jest.fn();
    const ipcMain = { handle: handleMock };
    const log = jest.fn();

    jest.isolateModules(() => {
      const screenshot = require("screenshot-desktop");
      screenshot.mockImplementation(() => Promise.resolve("tmp.png"));
      const { initScreenReader } = require("../electron/screenReader");
      initScreenReader({ ipcMain, log });
    });

    const handler = handleMock.mock.calls[0][1];
    const res = await handler();
    expect(res).toEqual({ ok: true, text: "ocr result" });
    expect(log).toHaveBeenCalled();
  });

  test("ipc handler returns failure when screenshot fails", async () => {
    const handleMock = jest.fn();
    const ipcMain = { handle: handleMock };

    jest.isolateModules(() => {
      jest.doMock("screenshot-desktop", () => jest.fn(() => Promise.reject(new Error("fail"))));
      jest.doMock("child_process", () => ({
        spawn: jest.fn(() => {
          throw new Error("spawn fail");
        })
      }));
      const { initScreenReader } = require("../electron/screenReader");
      initScreenReader({ ipcMain, log: () => {} });
    });

    const handler = handleMock.mock.calls[0][1];
    const res = await handler();
    expect(res.ok).toBe(false);
  });
});
