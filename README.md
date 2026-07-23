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

## Pricing & tax
- Monthly: **$99/mo**, Yearly: **$999/yr**
- **GST (18%) applies to India-billed customers only**, across all three payment methods — this replaced the earlier "GST only on bank transfer" logic, which wasn't actually correct: GST taxes the sale, not the payment rail.
- **International customers pay no GST** — treated as export of services (zero-rated), assuming you've filed an LUT with GST once registered.
- **You do not need to charge GST at all until your annual turnover crosses ₹20 lakh and you're GST-registered.** If that's not you yet, don't collect it — there's no GSTIN to remit it under. This is general info, not tax advice; confirm your actual registration/LUT status with a CA before this goes live.
- Bank transfer (NEFT/RTGS) is treated as domestic-only in the code, so it always applies GST — international customers should use card or crypto instead (see the earlier note on why bank transfer doesn't verify well for international payers).
- **Razorpay's own transaction fee is passed through to the customer** on card and bank transfer, grossed up so you net the full listed (+GST if applicable) price. Rates used (`RAZORPAY_FEE_DOMESTIC` ~2%, `RAZORPAY_FEE_INTL` ~3%, plus Razorpay's 18% GST on their own fee) are placeholders — confirm actual rates in your Razorpay dashboard.
- **Card path caveat**: Razorpay Subscription Plans are fixed-price, so you need four Plan variants in the dashboard (Monthly/Yearly × domestic/international), each pre-priced at the grossed-up, GST-adjusted amount — the backend can't compute this per-request for subscriptions the way it can for one-off bank transfer orders.
- The domestic/international check is currently a plain browser `confirm()` dialog on the frontend — fine to ship with, but self-declared and not verified against actual billing country. A proper implementation would check this server-side against the card's BIN or the customer's provided billing address.
4. Deploy. Done — you get a free `*.vercel.app` domain, or attach your own.

## Accounts you need to open (outside this repo)
- **Razorpay** (razorpay.com) — business KYC required to receive payouts to a bank account. This is the part that actually takes setup time, not the code.
- **NOWPayments** (nowpayments.io) — sign up, get an API key, add a payout wallet address for each coin you want to receive.

## What's NOT handled yet (you'll need to add before going live)
- **Access gating**: right now nothing checks whether someone actually paid before giving them access. You need a webhook handler (`Razorpay` webhook + a `NOWPayments` IPN callback) that verifies the payment signature, then marks the user as active in a database (Supabase free tier works well here).
- **User accounts/login**: this is just the payment flow. Pair it with something like Supabase Auth or Clerk (both have free tiers) for signup/login.
- **Recurring crypto billing**: crypto can't be auto-debited like a card. See the note at the bottom of `api/crypto-checkout.js` — the standard pattern is invoice-per-cycle + your own expiry tracking.
