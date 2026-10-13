# Stripe post-ride payments

The API starts a Stripe PaymentIntent only for the authenticated passenger who owns a completed ride with a positive persisted fare. The amount is integer paisa and the currency is fixed to `bdt`. The client secret is returned by `POST /api/v1/payments/rides/:rideId/stripe-intent`; only the verified Stripe webhook changes the local payment to `PAID`.

## Environment configuration

Backend `.env` values use test-mode credentials during development:

```dotenv
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_CURRENCY=bdt
```

The frontend uses the publishable key separately (`STRIPE_PUBLISHABLE_KEY=pk_test_...`). Never put `STRIPE_SECRET_KEY` or `STRIPE_WEBHOOK_SECRET` in frontend configuration, responses, logs, or source control. Live credentials use `sk_live_...`, `pk_live_...`, and a live `whsec_...`; do not mix test and live values.

In production the backend secret and webhook secret are required. In development/test, an unconfigured Stripe integration returns a safe service-unavailable response and never creates a paid local record.

## Dashboard and webhook setup

1. Create or select a Stripe account and keep the Dashboard in **Test mode**.
2. Add a webhook endpoint for `https://<api-host>/api/v1/payments/stripe/webhook`.
3. Subscribe to `payment_intent.succeeded` and `payment_intent.payment_failed`.
4. Copy the endpoint signing secret into `STRIPE_WEBHOOK_SECRET`.
5. Configure the frontend with the matching test publishable key.
6. Before live use, create a separate live webhook endpoint and replace all three test credentials together.

For local development, Stripe CLI can forward events to `http://localhost:3001/api/v1/payments/stripe/webhook`; use the signing secret printed by the CLI.

## Test cards

Use Stripe’s official test cards in Test mode. The standard successful Visa is `4242 4242 4242 4242`; use any future expiry, any three-digit CVC, and any postal code. Use Stripe’s documented decline cards to exercise `payment_intent.payment_failed` and webhook retry behavior. Do not use real card details in development or tests.

## Operational notes

Payment initiation is idempotent per local ride payment and never accepts a client amount. PostgreSQL owns the ride fare, ownership, and payment state. Webhook event IDs are stored to make duplicate delivery safe; a webhook never changes the completed ride lifecycle.
