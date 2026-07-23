// /api/checkout.js — Vercel serverless function
// Handles card payments (fixed-price Razorpay subscription) and bank
// transfer payments (one-off Razorpay order, price + 18% GST).
//
// Card and bank transfer are handled differently on purpose:
// - Card: recurring subscription against a pre-made Razorpay Plan (fixed price).
// - Bank transfer: Razorpay Subscriptions don't support per-request price
//   overrides, so GST-inclusive bank transfer payments go through the
//   Orders API instead (still recurs — you re-invoice each cycle, or use
//   Razorpay's e-mandate/NACH flow for true bank-debit recurring if you want
//   it fully automatic).

import Razorpay from 'razorpay';

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const GST_RATE = 0.18;

// Base prices in USD. Razorpay settles in INR for India-based accounts —
// convert at checkout time via a live FX rate, or just price the Plan IDs
// directly in INR in the Razorpay dashboard and skip conversion here.
const BASE_PRICE = {
  Monthly: 99,
  Yearly: 999,
};

// Razorpay Plan IDs for the CARD/recurring path — create these once in
// Razorpay Dashboard > Subscriptions > Plans, priced in INR.
const PLAN_MAP = {
  Monthly: process.env.RAZORPAY_PLAN_MONTHLY,
  Yearly: process.env.RAZORPAY_PLAN_YEARLY,
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { plan, method } = req.body; // method: 'card' | 'bank_transfer'
  const base = BASE_PRICE[plan];
  if (!base) return res.status(400).json({ error: 'Unknown plan' });

  try {
    if (method === 'bank_transfer') {
      // Price with GST added, converted to paise (Razorpay uses smallest unit).
      const totalUsd = +(base * (1 + GST_RATE)).toFixed(2);
      const fxRate = Number(process.env.USD_TO_INR) || 83; // static fallback rate
      const totalInPaise = Math.round(totalUsd * 100 * fxRate);
      // ^ swap in a live FX lookup if you want accurate INR pricing.

      const order = await razorpay.orders.create({
        amount: totalInPaise,
        currency: 'INR',
        receipt: `${plan}-bank-${Date.now()}`,
        notes: { plan, method: 'bank_transfer', gst_applied: 'true', base_usd: base },
      });

      // Razorpay Orders don't have a hosted redirect URL by default — pair
      // this with Razorpay Checkout.js on the frontend, or enable Payment
      // Links (dashboard > Payment Links > create via API) for a plain URL.
      return res.status(200).json({ order_id: order.id, amount: order.amount });
    }

    // Default: card, recurring subscription at listed price, no GST added.
    const plan_id = PLAN_MAP[plan];
    if (!plan_id) return res.status(400).json({ error: 'Plan not configured' });

    const subscription = await razorpay.subscriptions.create({
      plan_id,
      customer_notify: 1,
      total_count: plan === 'Yearly' ? 1 : 12,
    });

    return res.status(200).json({
      subscription_id: subscription.id,
      url: subscription.short_url || null,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Could not create checkout' });
  }
}
