jest.mock("fs", () => {
  let store = {};
  return {
    writeFileSync: jest.fn((p, data) => {
      store[p] = data;
    }),
    readFileSync: jest.fn((p) => store[p] || "{}")
  };
});

jest.mock("http", () => ({
  createServer: jest.fn(() => ({
    listen: jest.fn((port, host, cb) => cb && cb()),
    address: () => ({ port: 4000 })
  }))
}));

describe("main IPC handlers", () => {
  test("save/get user session and load-activity IPCs work", async () => {
    const onHandlers = {};
    const handleHandlers = {};

    jest.resetModules();
    jest.doMock("tesseract.js", () => ({}), { virtual: true });
    jest.doMock("sharp", () => ({}), { virtual: true });

    jest.isolateModules(() => {
      jest.doMock(
        "electron",
        () => {
          const BrowserWindow = jest.fn().mockImplementation(() => ({
            loadFile: jest.fn(),
            loadURL: jest.fn(),
            isDestroyed: jest.fn(() => false),
            webContents: { send: jest.fn() },
            show: jest.fn(),
            focus: jest.fn(),
            setContentProtection: jest.fn(),
            setAlwaysOnTop: jest.fn(),
            setVisibleOnAllWorkspaces: jest.fn(),
            setSkipTaskbar: jest.fn(),
            hide: jest.fn(),
            showInactive: jest.fn()
          }));

          const app = {
            setAppUserModelId: jest.fn(),
            whenReady: jest.fn(() => Promise.resolve()),
            on: jest.fn(),
            quit: jest.fn(),
            setPath: jest.fn(),
            commandLine: { appendSwitch: jest.fn() },
            getPath: jest.fn(() => "C:\\\\tmp"),
            isReady: jest.fn(() => true)
          };

          return {
            app,
            BrowserWindow,
            ipcMain: {
              on: jest.fn((ch, fn) => (onHandlers[ch] = fn)),
              handle: jest.fn((ch, fn) => (handleHandlers[ch] = fn))
            },
            dialog: {},
            globalShortcut: { register: jest.fn(), unregister: jest.fn(), unregisterAll: jest.fn() },
            clipboard: {},
            Tray: jest.fn(() => ({ setToolTip: jest.fn(), on: jest.fn() })),
            nativeImage: { createFromPath: jest.fn(() => ({})) }
          };
        },
        { virtual: true }
      );

      require("../electron/main.js");
    });

    // save session
    onHandlers["save-user-session"](null, { email: "a@b.com" });
    const sessionData = await handleHandlers["get-user-session"]();
    expect(sessionData).toEqual({ email: "a@b.com" });

    // load activity navigates when mainWindow exists
    const ok = await handleHandlers["load-activity"]();
    expect(ok).toBe(true);
  });
});
