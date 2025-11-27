jest.mock("http", () => ({
  createServer: jest.fn(() => {
    const server = {
      listen: jest.fn((port, host, cb) => {
        server.address = () => ({ port: 3001 });
        if (cb) cb();
      }),
      address: () => ({ port: 3001 })
    };
    return server;
  })
}));

jest.mock("groq-sdk");

jest.mock(
  "../electron/api/index.js",
  () => ({
    search: {
      router: { unifiedSearch: jest.fn() },
      braveApi: jest.fn(),
      bing: jest.fn(),
      googlePSE: jest.fn(),
      groq: jest.fn(),
      serpapi: jest.fn()
    },
    utils: { providerSelector: {} }
  }),
  { virtual: true }
);

jest.mock("../electron/groqEngine", () => ({
  groqWhisperTranscribe: jest.fn(),
  groqFastAnswer: jest.fn()
}));

describe("main process createWindow", () => {
  test("creates BrowserWindow and loads login page on ready", async () => {
    let BrowserWindow;
    let app;

    jest.isolateModules(() => {
      const createdWindows = [];
      jest.doMock(
        "electron",
        () => {
          BrowserWindow = jest.fn().mockImplementation(() => {
            const win = {
              loadURL: jest.fn(),
              loadFile: jest.fn(),
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
            };
            createdWindows.push(win);
            return win;
          });

          app = {
            setAppUserModelId: jest.fn(),
            whenReady: jest.fn(() => Promise.resolve()),
            on: jest.fn(),
            quit: jest.fn(),
            setPath: jest.fn(),
            commandLine: { appendSwitch: jest.fn() },
            getPath: jest.fn(() => ""),
            isReady: jest.fn(() => true)
          };

          return {
            app,
            BrowserWindow,
            ipcMain: { on: jest.fn(), handle: jest.fn() },
            dialog: {},
            globalShortcut: { register: jest.fn(), unregister: jest.fn(), unregisterAll: jest.fn() },
            clipboard: {},
            Tray: jest.fn(),
            nativeImage: { createFromPath: jest.fn(() => ({})) }
          };
        },
        { virtual: true }
      );
      require("../electron/main.js");
    });

    // allow whenReady promise chain to run
    await Promise.resolve();
    await Promise.resolve();

    expect(app.setAppUserModelId).toHaveBeenCalledWith("Haloryn");
    expect(BrowserWindow).toHaveBeenCalledTimes(1);

    const createdWin = BrowserWindow.mock.results[0].value;
    expect(createdWin.loadURL).toHaveBeenCalledWith(
      expect.stringContaining("http://127.0.0.1:3001/login.html")
    );
  });
});
