const {
  providerPriority,
  getProviderOrder
} = require("../electron/api/utils/providerSelector");

describe("provider selector", () => {
  test("exports priority list", () => {
    expect(Array.isArray(providerPriority)).toBe(true);
    expect(providerPriority.length).toBeGreaterThan(0);
  });

  test("getProviderOrder returns providerPriority reference", () => {
    const order = getProviderOrder();
    expect(order).toEqual(providerPriority);
    expect(order[0]).toBe("brave");
  });
});
