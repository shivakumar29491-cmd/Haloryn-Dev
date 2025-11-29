// Placeholder LemonSqueezy validation.
// We only simulate valid license for now.
// Later replace with real API request.

async function validateLicense(licenseKey) {
    if (!licenseKey) return { valid: false, reason: "No Key" };

    // PLACEHOLDER — Always valid
    return {
        valid: true,
        plan: "monthly",
        subscriptionStatus: "active"
    };
}

module.exports = {
    validateLicense
};
