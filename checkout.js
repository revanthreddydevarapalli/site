// /api/checkout.js — Vercel serverless function
// Handles card + bank transfer subscriptions.
// Uses Razorpay (works for India-based accounts). Swap for Stripe if you're
// incorporated somewhere Stripe accepts directly — the Stripe version is
// commented below.

import Razorpay from 'razorpay';

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// Map your plan names to Razorpay Plan IDs (create these once in the
// Razorpay dashboard under Subscriptions > Plans).
const PLAN_MAP = {
  Associate: process.env.RAZORPAY_PLAN_ASSOCIATE,
  Member: process.env.RAZORPAY_PLAN_MEMBER,
  Trustee: process.env.RAZORPAY_PLAN_TRUSTEE,
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { plan } = req.body;
  const plan_id = PLAN_MAP[plan];
  if (!plan_id) return res.status(400).json({ error: 'Unknown plan' });

  try {
    const subscription = await razorpay.subscriptions.create({
      plan_id,
      customer_notify: 1,
      total_count: 12, // 12 billing cycles, then auto-renews or ends — adjust
    });

    // Razorpay's hosted checkout needs the subscription id passed to
    // Razorpay Checkout.js on the frontend, OR use subscription.short_url
    // if you enabled hosted payment pages in the dashboard.
    return res.status(200).json({
      subscription_id: subscription.id,
      url: subscription.short_url || null,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Could not create subscription' });
  }
}

/* ---------------- STRIPE VERSION (use instead, if applicable) ----------------

import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const PRICE_MAP = {
  Associate: process.env.STRIPE_PRICE_ASSOCIATE, // price_xxx, created in Stripe dashboard
  Member: process.env.STRIPE_PRICE_MEMBER,
  Trustee: process.env.STRIPE_PRICE_TRUSTEE,
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { plan } = req.body;
  const price = PRICE_MAP[plan];
  if (!price) return res.status(400).json({ error: 'Unknown plan' });

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price, quantity: 1 }],
    payment_method_types: ['card', 'us_bank_account'], // ACH bank transfer
    success_url: `${process.env.SITE_URL}/success`,
    cancel_url: `${process.env.SITE_URL}/`,
  });

  return res.status(200).json({ url: session.url });
}
---------------------------------------------------------------------------- */
