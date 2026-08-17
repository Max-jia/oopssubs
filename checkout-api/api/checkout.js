// Create a Stripe Checkout Session for OopsSubs Pro (one-time $9.99)
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "method" });

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: 999,
            product_data: {
              name: "OopsSubs Pro",
              description: "Unlimited subscription tracking. One-time payment.",
            },
          },
        },
      ],
      success_url: "https://oopssubs.com/app?session_id={CHECKOUT_SESSION_ID}",
      cancel_url: "https://oopssubs.com/pricing",
      metadata: { source: "web" },
    });
    res.json({ url: session.url });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
};
