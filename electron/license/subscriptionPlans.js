// Placeholder subscription plan IDs until you add real LemonSqueezy products.

module.exports = {
    monthly: {
        id: process.env.LS_PRODUCT_MONTHLY || "PRODUCT_MONTHLY_PLACEHOLDER",
        price: 14.99,
        name: "Monthly"
    },
    yearly: {
        id: process.env.LS_PRODUCT_YEARLY || "PRODUCT_YEARLY_PLACEHOLDER",
        price: 149.99,
        name: "Yearly"
    }
};
