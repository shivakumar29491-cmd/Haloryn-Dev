// ===== macOS Native Capture Bridge =====
const path = require("path");

let addon = null;

try {
  addon = require(
    path.join(
      __dirname,
      "..",
      "native-macos-capture",
      "build",
      "Release",
      "macos_capture.node"
    )
  );
  console.log("[macOS] Native capture loaded");
} catch (err) {
  console.error("[macOS] Failed to load native capture addon:", err);
}

function captureRegionMac(x, y, width, height) {
  if (!addon) throw new Error("macOS capture addon not loaded");
  return addon.captureRegion(x, y, width, height);
}

module.exports = { captureRegionMac };
