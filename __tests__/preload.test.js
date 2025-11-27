describe("preload bridge", () => {
  test("exposes electron helpers and forwards to ipcRenderer", () => {
    let ipcRenderer;
    const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    delete global.electron;
    delete global.windowCtl;
    delete global.sessionAPI;
    delete global.companion;
    delete global.electronAPI;

    jest.isolateModules(() => {
      jest.doMock(
        "electron",
        () => {
          const listeners = {};
          ipcRenderer = {
            invoke: jest.fn(),
            send: jest.fn(),
            on: jest.fn((channel, listener) => {
              listeners[channel] = listener;
            }),
            removeListener: jest.fn((channel) => {
              delete listeners[channel];
            })
          };

          return {
            contextBridge: {
              exposeInMainWorld: jest.fn((key, api) => {
                global[key] = api;
              })
            },
            ipcRenderer
          };
        },
        { virtual: true }
      );

      require("../electron/preload.js");
    });

    logSpy.mockRestore();

    expect(global.electron).toBeDefined();

    global.electron.invoke("channel-a", 1);
    global.electron.send("channel-b", 2);
    const cleanup = global.electron.on("channel-c", () => {});
    cleanup();

    expect(ipcRenderer.invoke).toHaveBeenCalledWith("channel-a", 1);
    expect(ipcRenderer.send).toHaveBeenCalledWith("channel-b", 2);
    expect(ipcRenderer.removeListener).toHaveBeenCalledWith("channel-c", expect.any(Function));
  });
});
