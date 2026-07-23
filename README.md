# Vault — membership site

## What's here
- `index.html` — the site (static, deploy as-is)
- `api/checkout.js` — card / bank transfer subscription (Razorpay, Stripe version commented inside)
- `api/crypto-checkout.js` — crypto invoice via NOWPayments

## Deploy (free)
1. Push this folder to a GitHub repo.
2. Go to vercel.com → New Project → import the repo. Vercel auto-detects
   `index.html` as static and `api/*.js` as serverless functions. Free tier
   covers this comfortably at low volume.
3. Set environment variables in Vercel → Project → Settings → Environment Variables:
   - `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`
   - `RAZORPAY_PLAN_MONTHLY`, `RAZORPAY_PLAN_YEARLY`
     (create these Plan IDs first in Razorpay Dashboard → Subscriptions → Plans, priced in INR — $99/mo and $999/yr converted at your target rate)
   - `USD_TO_INR` (static fallback FX rate used only for the bank-transfer GST calc, e.g. `83`)
   - `NOWPAYMENTS_API_KEY`
   - `SITE_URL` (your deployed domain, e.g. https://vault.vercel.app)

## Pricing
- Monthly: **$99/mo**, Yearly: **$999/yr**
- **Bank transfer only**: +18% GST added on top (per Indian tax requirement) — handled server-side in `api/checkout.js`, not just cosmetic on the frontend.
- Card and crypto: listed price, no GST added.
4. Deploy. Done — you get a free `*.vercel.app` domain, or attach your own.

## Accounts you need to open (outside this repo)
- **Razorpay** (razorpay.com) — business KYC required to receive payouts to a bank account. This is the part that actually takes setup time, not the code.
- **NOWPayments** (nowpayments.io) — sign up, get an API key, add a payout wallet address for each coin you want to receive.

## What's NOT handled yet (you'll need to add before going live)
- **Access gating**: right now nothing checks whether someone actually paid before giving them access. You need a webhook handler (`Razorpay` webhook + a `NOWPayments` IPN callback) that verifies the payment signature, then marks the user as active in a database (Supabase free tier works well here).
- **User accounts/login**: this is just the payment flow. Pair it with something like Supabase Auth or Clerk (both have free tiers) for signup/login.
- **Recurring crypto billing**: crypto can't be auto-debited like a card. See the note at the bottom of `api/crypto-checkout.js` — the standard pattern is invoice-per-cycle + your own expiry tracking.
