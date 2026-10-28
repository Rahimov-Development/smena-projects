# Smena

A short brief for a discovery call. You describe the task, answer two or three clarifying questions, review a summary, and pay **€150** through Stripe Checkout in test mode. The return page says **Call booked**.

Questions come from OpenRouter when `OPENROUTER_API_KEY` is set. Until then, the app drafts the questions itself from the brief.

## Run locally

```bash
npm install
node scripts/sync-stripe-env.mjs
npm run dev
```

Open [http://127.0.0.1:3847](http://127.0.0.1:3847).

`sync-stripe-env.mjs` copies the test-mode key from the Stripe CLI profile into `.env.local`. It refuses any live key. `.env.local` stays uncommitted.

Card number for Checkout: `4242 4242 4242 4242`. Any future expiry, any CVC, any postal code.

## Webhooks

Fulfillment is recorded from `checkout.session.completed` and `checkout.session.async_payment_succeeded`, and only when the session is not unpaid. Signature verification uses `STRIPE_WEBHOOK_SECRET`.

```bash
stripe listen --events checkout.session.completed,checkout.session.async_payment_succeeded,checkout.session.async_payment_failed --forward-to localhost:3847/api/stripe/webhook
```

Put the `whsec_…` value in `.env.local` as `STRIPE_WEBHOOK_SECRET` and restart the dev server. Paid bookings are appended to `data/bookings.json`, which is gitignored.

## Sandbox only

Checkout uses a Stripe sandbox test key (`rkcs_test_`, `rk_test_`, or `sk_test_`). The app refuses live keys, live webhook secrets, and any Checkout Session whose id is not `cs_test_` or whose `livemode` flag is true.

Do not run `stripe login` on the production account, do not pass `--live`, and do not provision the Stripe Projects `livemode` service. `scripts/sync-stripe-env.mjs` exits if the CLI profile contains a live key.

OpenRouter (`openrouter/api` in the Projects catalog) is optional. Projects init currently requires a live-mode account, so this sandbox does not call it. Without `OPENROUTER_API_KEY`, the app drafts the clarifying questions locally.

The sandbox was created with `stripe sandboxes create` and expires on 4 November 2026 (Europe/Amsterdam).

## Durable preview

This environment has no Vercel token and no Cloudflare API token, so it cannot publish a stable `https://…vercel.app` or `https://….workers.dev` URL. Logged-out `vercel deploy --temporary` and `wrangler deploy --temporary` both expire in about an hour unless Arthur claims them. They are not a substitute for a durable host.

To unblock a permanent preview, either:

- Vercel: run `vercel login`, or create a token at https://vercel.com/account/tokens and set `VERCEL_TOKEN`. Then `vercel deploy --prod` from this repo.
- Cloudflare: run `wrangler login`, or set `CLOUDFLARE_API_TOKEN` with Workers Scripts edit permission, then deploy.

On the host, set `STRIPE_SECRET_KEY` to the sandbox key only (`rkcs_test_`, `rk_test_`, or `sk_test_`). Set `STRIPE_WEBHOOK_SECRET` when a webhook endpoint exists. Leave `OPENROUTER_API_KEY` empty to keep the local questions. Do not set a live key. Do not commit `.env.local`.

Checkout return URLs follow the public `Host` header, so `NEXT_PUBLIC_APP_URL` can stay as the local default in `.env.example`.

## Checks

```bash
npm test
npm run lint
```
3. Add the model provider: `stripe projects add openrouter/api --json --yes`
4. Pull env vars with `stripe projects env` and restart the app

Do not add the Stripe `livemode` service. Checkout is hard-coded to reject keys that are not `sk_test_`, `rk_test_`, or `rkcs_test_`.

The local sandbox was created with `stripe sandboxes create` and expires on 4 November 2026 (Europe/Amsterdam). Claim it before then if you want to keep the test account.

## Checks

```bash
npm test
npm run lint
```
