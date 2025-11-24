// electron/api/utils/providerSelector.js
// Phase 10 — Search provider priority & utilities

module.exports = {
  providerPriority,
  getProviderOrder
};

// Highest quality → lowest fallback
const providerPriority = [
  "brave",
  "serpapi",
  "googlePSE",
  "bing",
  "groq"
];

/**
 * Returns provider order with ability to override later.
 */
function getProviderOrder() {
  return providerPriority;
}
