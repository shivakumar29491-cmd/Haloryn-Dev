const {
  recordSuccess,
  recordError,
  getStats
} = require("../electron/providerStats");

describe("providerStats", () => {
  const provider = "brave";

  test("records successes and averages latency", () => {
    recordSuccess(provider, 100);
    recordSuccess(provider, 300);
    const stats = getStats()[provider];
    expect(stats.calls).toBe(2);
    expect(stats.avgLatency).toBeGreaterThanOrEqual(100);
    expect(stats.avgLatency).toBeLessThanOrEqual(300);
    expect(stats.lastUsed).toBeDefined();
  });

  test("records errors", () => {
    recordError(provider);
    const stats = getStats()[provider];
    expect(stats.errors).toBeGreaterThanOrEqual(1);
    expect(stats.lastUsed).toBeDefined();
  });
});
