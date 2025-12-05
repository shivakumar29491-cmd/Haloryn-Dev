// ===== Search provider priority utilities =====

// Highest → Lowest priority order
const providerPriority = [
  "brave",
  "serpapi",
  "googlePSE",
  "bing",
  "groq"
];

/**
 * Returns provider order (can be extended later)
 */
function getProviderOrder() {
  return providerPriority;
}

module.exports = {
  providerPriority,
  getProviderOrder
};
