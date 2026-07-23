// /api/checkout.js — Vercel serverless function
// Handles card payments (recurring Razorpay subscription) and bank
// transfer payments (one-off Razorpay order, price + GST).
// Razorpay's own transaction fee is passed through to the customer on
// both paths, grossed up so the amount you actually receive nets out to
// the listed price (+ GST where applicable).

import Razorpay from 'razorpay';

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const GST_RATE = 0.18;

// Razorpay fee rates — CONFIRM THESE IN YOUR DASHBOARD, they vary by plan
// and change over time. These are placeholders, not guaranteed current.
const RAZORPAY_FEE_DOMESTIC = Number(process.env.RAZORPAY_FEE_DOMESTIC) || 0.02;   // ~2%
const RAZORPAY_FEE_INTL     = Number(process.env.RAZORPAY_FEE_INTL) || 0.03;       // ~3%
// Razorpay also charges 18% GST on ITS OWN fee (not on your price) — factor that in too.

const BASE_PRICE = {
  Monthly: 99,
  Yearly: 999,
};

const PLAN_MAP = {
  Monthly: process.env.RAZORPAY_PLAN_MONTHLY,
  Yearly: process.env.RAZORPAY_PLAN_YEARLY,
};

// Grosses up `net` so that after Razorpay takes feeRate + 18% GST on that
// fee, you still receive exactly `net`. Standard "customer absorbs the fee" formula.
function grossUpForFee(net, feeRate) {
  const effectiveFeeRate = feeRate * (1 + GST_RATE); // fee + GST-on-fee
  return +(net / (1 - effectiveFeeRate)).toFixed(2);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { plan, method, is_international } = req.body;
  // method: 'card' | 'bank_transfer'
  // is_international: boolean — pass true if billing country != India
  const base = BASE_PRICE[plan];
  if (!base) return res.status(400).json({ error: 'Unknown plan' });

  const razorpayFeeRate = is_international ? RAZORPAY_FEE_INTL : RAZORPAY_FEE_DOMESTIC;

  try {
    if (method === 'bank_transfer') {
      const netWithGst = +(base * (1 + GST_RATE)).toFixed(2);
      const totalUsd = grossUpForFee(netWithGst, razorpayFeeRate);

      const fxRate = Number(process.env.USD_TO_INR) || 83;
      const totalInPaise = Math.round(totalUsd * 100 * fxRate);

      const order = await razorpay.orders.create({
        amount: totalInPaise,
        currency: 'INR',
        receipt: `${plan}-bank-${Date.now()}`,
        notes: {
          plan, method: 'bank_transfer', gst_applied: 'true',
          base_usd: base, razorpay_fee_rate: razorpayFeeRate, charged_usd: totalUsd,
        },
      });

      return res.status(200).json({ order_id: order.id, amount: order.amount, charged_usd: totalUsd });
    }

    // Card: recurring subscription. Razorpay Plans are fixed-price, so the
    // fee-inclusive amount must be baked into the Plan itself in the
    // dashboard (create a "Monthly + fee" and "Yearly + fee" plan priced at
    // the grossed-up amount below), rather than computed per-request.
    const grossedUp = grossUpForFee(base, razorpayFeeRate);
    const plan_id = PLAN_MAP[plan];
    if (!plan_id) return res.status(400).json({ error: 'Plan not configured' });

    const subscription = await razorpay.subscriptions.create({
      plan_id, // should already be priced at `grossedUp` in the dashboard
      customer_notify: 1,
      total_count: plan === 'Yearly' ? 1 : 12,
    });

    return res.status(200).json({
      subscription_id: subscription.id,
      url: subscription.short_url || null,
      charged_usd: grossedUp, // for display only — actual charge is the Plan's set price
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Could not create checkout' });
  }
}
