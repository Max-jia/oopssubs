// Verify a Stripe Checkout Session was actually paid (server-side, cannot be forged)
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  const sessionId = req.query.session_id;
  if (!sessionId) return res.json({ ok: false });

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    return res.json({ ok: session.payment_status === "paid" });
  } catch {
    return res.json({ ok: false });
  }
};
