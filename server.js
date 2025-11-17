const express = require("express");
const Stripe = require("stripe");
const cors = require("cors");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

// Log all incoming requests
app.use((req, res, next) => {
  console.log("Incoming request:", req.method, req.url);
  next();
});

app.get("/", (req, res) => {
  res.send("Server is up");
});

// Stripe setup
if (!process.env.STRIPE_SECRET_KEY) {
  console.error("⚠️ STRIPE_SECRET_KEY is NOT set in environment!");
} else {
  console.log("✅ STRIPE_SECRET_KEY is set (value hidden).");
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Utility function: do the payment math
function calculatePlan(totalFee, termMonths, downPercent) {
  const downPaymentAmount = Math.round(totalFee * downPercent);
  const remaining = totalFee - downPaymentAmount;
  const monthly = Math.round((remaining / termMonths) * 100) / 100;
  return { downPaymentAmount, remaining, monthly };
}

// Create or find Stripe customer
async function getOrCreateCustomer(email, name) {
  const customers = await stripe.customers.list({ email, limit: 1 });
  if (customers.data.length > 0) return customers.data[0];

  return await stripe.customers.create({
    email,
    name,
    metadata: {
      source: "Full-Arch Financing System",
    },
  });
}

// --------------------------------------------------
// ROUTE 1 — Create Down Payment Link + Numbers
// --------------------------------------------------
app.post("/api/create-plan", async (req, res) => {
  try {
    const { name, email, totalFee, termMonths, downPercent } = req.body;

    if (
      !name ||
      !email ||
      totalFee == null ||
      termMonths == null ||
      downPercent == null
    ) {
      return res.status(400).json({
        error: "Missing required fields.",
      });
    }

    console.log("👉 /api/create-plan body:", req.body);

    const customer = await getOrCreateCustomer(email, name);
    const { downPaymentAmount, remaining, monthly } = calculatePlan(
      totalFee,
      termMonths,
      downPercent
    );

    const product = await stripe.products.create({
      name: `Down Payment (${name})`,
    });

    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: downPaymentAmount * 100,
      currency: "usd",
    });

    const paymentLink = await stripe.paymentLinks.create({
      line_items: [{ price: price.id, quantity: 1 }],
      payment_method_types: ["card"],
      billing_address_collection: "required",
    });

    res.json({
      message: "Plan created successfully!",
      customerId: customer.id,
      downPaymentAmount,
      remaining,
      monthly,
      paymentLinkUrl: paymentLink.url,
    });
  } catch (err) {
    console.error("❌ Error in /api/create-plan:", err);
    res.status(500).json({ error: "Server error", details: err.message });
  }
});

// --------------------------------------------------
// ROUTE 2 — Monthly Autopay Subscription
// --------------------------------------------------
app.post("/api/create-invoice-schedule", async (req, res) => {
  try {
    const { customerId, remaining, termMonths } = req.body;

    if (!customerId || remaining == null || termMonths == null) {
      return res.status(400).json({
        error: "Missing required fields: customerId, remaining, termMonths",
      });
    }

    console.log("👉 /api/create-invoice-schedule body:", req.body);

    const monthly = Math.ceil(remaining / termMonths);

    const product = await stripe.products.create({
      name: `Full-Arch Monthly Plan (${termMonths} months)`,
    });

    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: monthly * 100,
      currency: "usd",
      recurring: { interval: "month" },
    });

    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: price.id }],
      payment_behavior: "default_incomplete",
      payment_settings: {
        save_default_payment_method: "on_subscription",
      },
      expand: ["latest_invoice.payment_intent"],
    });

    res.json({
      message: "Monthly autopay subscription created!",
      subscriptionId: subscription.id,
      amountMonthly: monthly,
      termMonths,
      remaining,
    });
  } catch (err) {
    console.error("❌ Error in /api/create-invoice-schedule:", err);
    res.status(500).json({ error: "Server error", details: err.message });
  }
});

// ----------------------
// Start server
// ----------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Financing server running on port ${PORT}`);
});
