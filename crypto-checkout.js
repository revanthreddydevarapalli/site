// /api/crypto-checkout.js — Vercel serverless function
// Creates a NOWPayments invoice. GST applies only to domestic (India)
// customers, same logic as api/checkout.js — crypto sales to international
// customers are treated as export of services (0% GST).

const PRICE_MAP = {
  Levels: 49,
  Monthly: 99,
  Yearly: 999,
};
const GST_RATE = 0.18;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { plan, is_domestic } = req.body;
  const base = PRICE_MAP[plan];
  if (!base) return res.status(400).json({ error: 'Unknown plan' });

  const price_amount = is_domestic ? +(base * (1 + GST_RATE)).toFixed(2) : base;

  try {
    const response = await fetch('https://api.nowpayments.io/v1/invoice', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.NOWPAYMENTS_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        price_amount,
        price_currency: 'usd',
        order_id: `${plan}-${Date.now()}`,
        order_description: `Vault ${plan} membership${is_domestic ? ' (incl. GST)' : ''}`,
        ipn_callback_url: `${process.env.SITE_URL}/api/crypto-webhook`,
        success_url: `${process.env.SITE_URL}/success`,
        cancel_url: `${process.env.SITE_URL}/`,
      }),
    });

    const data = await response.json();
    return res.status(200).json({ invoice_url: data.invoice_url });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Could not create crypto invoice' });
  }
}

/* NOWPAYMENTS_SUBSCRIPTIONS: for true recurring crypto billing, NOWPayments
   requires "Subscriptions" plans via their dashboard — crypto can't be
   auto-debited like a card. Common pattern: send a fresh invoice link each
   cycle, gate access based on webhook-confirmed payment + your own expiry
   tracking in a DB. */
