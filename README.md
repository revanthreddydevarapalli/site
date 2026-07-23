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
- **Razorpay's own transaction fee is passed through to the customer** on both card and bank transfer, grossed up so you net the full listed price after Razorpay takes their cut. Rates used (`RAZORPAY_FEE_DOMESTIC` ~2%, `RAZORPAY_FEE_INTL` ~3%, plus Razorpay's 18% GST on their own fee) are placeholders — confirm your actual rates in the Razorpay dashboard (they vary by your account type/volume) and update the env vars accordingly.
- **Card path caveat**: Razorpay Subscription Plans are fixed-price (set once in the dashboard), so the fee can't be computed per-request like it is for bank transfer orders. You need to create the Monthly/Yearly Plans in the Razorpay dashboard already priced at the grossed-up amount (domestic and international will differ — consider two Plan variants per cycle, e.g. `RAZORPAY_PLAN_MONTHLY_DOMESTIC` / `_INTL`, or just pick one blended rate).
- The "is your card international?" check on the frontend is currently a plain browser confirm dialog — fine to ship with, but a BIN-lookup or Razorpay's own international-card detection would be a cleaner long-term fix.
4. Deploy. Done — you get a free `*.vercel.app` domain, or attach your own.

## Accounts you need to open (outside this repo)
- **Razorpay** (razorpay.com) — business KYC required to receive payouts to a bank account. This is the part that actually takes setup time, not the code.
- **NOWPayments** (nowpayments.io) — sign up, get an API key, add a payout wallet address for each coin you want to receive.

## What's NOT handled yet (you'll need to add before going live)
- **Access gating**: right now nothing checks whether someone actually paid before giving them access. You need a webhook handler (`Razorpay` webhook + a `NOWPayments` IPN callback) that verifies the payment signature, then marks the user as active in a database (Supabase free tier works well here).
- **User accounts/login**: this is just the payment flow. Pair it with something like Supabase Auth or Clerk (both have free tiers) for signup/login.
- **Recurring crypto billing**: crypto can't be auto-debited like a card. See the note at the bottom of `api/crypto-checkout.js` — the standard pattern is invoice-per-cycle + your own expiry tracking.
