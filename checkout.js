// /api/checkout.js — Vercel serverless function
// GST logic: 18% applied ONLY to India-based (domestic) customers.
// International customers are treated as export of services — zero-rated
// (0% GST), assuming you've filed an LUT. Confirm this with a CA before
// relying on it; registration/LUT status changes what's actually legal here.
//
// Razorpay's own transaction fee is passed through to the customer on top,
// grossed up so you net the full listed (+GST if applicable) price.

import Razorpay from 'razorpay';

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const GST_RATE = 0.18;

// Razorpay fee rates — CONFIRM THESE IN YOUR DASHBOARD, placeholders only.
const RAZORPAY_FEE_DOMESTIC = Number(process.env.RAZORPAY_FEE_DOMESTIC) || 0.02;
const RAZORPAY_FEE_INTL     = Number(process.env.RAZORPAY_FEE_INTL) || 0.03;

const BASE_PRICE = {
  Monthly: 99,
  Yearly: 999,
};

const PLAN_MAP = {
  Monthly: process.env.RAZORPAY_PLAN_MONTHLY,
  Yearly: process.env.RAZORPAY_PLAN_YEARLY,
};

function grossUpForFee(net, feeRate) {
  const effectiveFeeRate = feeRate * (1 + GST_RATE); // Razorpay charges GST on its own fee too
  return +(net / (1 - effectiveFeeRate)).toFixed(2);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { plan, method, is_domestic } = req.body;
  // method: 'card' | 'bank_transfer'
  // is_domestic: boolean — true if billing country is India
  const base = BASE_PRICE[plan];
  if (!base) return res.status(400).json({ error: 'Unknown plan' });

  const gstMultiplier = is_domestic ? (1 + GST_RATE) : 1;
  const razorpayFeeRate = is_domestic ? RAZORPAY_FEE_DOMESTIC : RAZORPAY_FEE_INTL;
  const priceWithGst = +(base * gstMultiplier).toFixed(2);

  try {
    if (method === 'bank_transfer') {
      // Bank transfer (NEFT/RTGS) is domestic-only in practice — GST always applies here.
      const totalUsd = grossUpForFee(+(base * (1 + GST_RATE)).toFixed(2), RAZORPAY_FEE_DOMESTIC);
      const fxRate = Number(process.env.USD_TO_INR) || 83;
      const totalInPaise = Math.round(totalUsd * 100 * fxRate);

      const order = await razorpay.orders.create({
        amount: totalInPaise,
        currency: 'INR',
        receipt: `${plan}-bank-${Date.now()}`,
        notes: { plan, method: 'bank_transfer', gst_applied: 'true', base_usd: base, charged_usd: totalUsd },
      });

      return res.status(200).json({ order_id: order.id, amount: order.amount, charged_usd: totalUsd });
    }

    // Card: GST depends on customer location, fee depends on card origin.
    const grossedUp = grossUpForFee(priceWithGst, razorpayFeeRate);
    const plan_id = PLAN_MAP[plan];
    if (!plan_id) return res.status(400).json({ error: 'Plan not configured' });

    const subscription = await razorpay.subscriptions.create({
      plan_id, // must be pre-priced in the dashboard to match `grossedUp` for this domestic/intl + plan combo
      customer_notify: 1,
      total_count: plan === 'Yearly' ? 1 : 12,
    });

    return res.status(200).json({
      subscription_id: subscription.id,
      url: subscription.short_url || null,
      charged_usd: grossedUp, // display only — actual charge is the Plan's set price
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Could not create checkout' });
  }
}
