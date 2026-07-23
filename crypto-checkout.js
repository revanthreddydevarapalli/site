// /api/crypto-checkout.js — Vercel serverless function
// Creates a NOWPayments invoice for a one-off period payment.
// NOWPayments also supports recurring "subscriptions" via a separate
// endpoint (see NOWPAYMENTS_SUBSCRIPTIONS note below) if you want auto-renewal.

const PRICE_MAP = {
  Monthly: 99,
  Yearly: 999,
};
// No GST surcharge applied here — GST is only added on the bank transfer
// path per the pricing rule (see api/checkout.js).

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { plan } = req.body;
  const price_amount = PRICE_MAP[plan];
  if (!price_amount) return res.status(400).json({ error: 'Unknown plan' });

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
        order_description: `Vault ${plan} membership`,
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

/* NOWPAYMENTS_SUBSCRIPTIONS:
   For true recurring crypto billing (auto-charge each month), NOWPayments
   requires setting up "Subscriptions" plans via their dashboard/API and a
   stored payment method — most crypto processors don't support silent
   recurring charges the way card networks do, since crypto wallets can't be
   auto-debited. The common pattern instead: send a reminder email/notification
   each cycle with a fresh invoice link (like this one), and gate access based
   on your webhook-confirmed payment record + expiry date in your own DB. */
