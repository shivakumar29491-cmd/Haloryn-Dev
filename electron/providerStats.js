// ===== Provider Stats (Phase 8) =====
// Centralized provider performance tracking

const stats = {};

// ===== Ensure provider slot exists =====
function ensure(provider) {
  if (!stats[provider]) {
    stats[provider] = {
      calls: 0,
      avgLatency: 0,
      lastUsed: null,
      errors: 0
    };
  }
}

// ===== Record success =====
function recordSuccess(provider, latencyMs) {
  ensure(provider);

  const p = stats[provider];
  p.calls++;

  // Running average latency
  if (p.avgLatency === 0) {
    p.avgLatency = latencyMs;
  } else {
    p.avgLatency = Math.round((p.avgLatency + latencyMs) / 2);
  }

  p.lastUsed = Date.now();
}

// ===== Record error =====
function recordError(provider) {
  ensure(provider);
  stats[provider].errors++;
  stats[provider].lastUsed = Date.now();
}

// ===== Export snapshot =====
function getStats() {
  return JSON.parse(JSON.stringify(stats));
}

module.exports = {
  recordSuccess,
  recordError,
  getStats,
};
