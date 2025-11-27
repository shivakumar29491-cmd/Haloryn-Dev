jest.mock("child_process", () => ({
  exec: jest.fn()
}));

const { exec } = require("child_process");
const { triggerSnip } = require("../electron/triggerSnip");

describe("triggerSnip", () => {
  test("invokes Windows screenclip command", () => {
    triggerSnip();
    expect(exec).toHaveBeenCalledWith("explorer.exe ms-screenclip:");
  });
});
