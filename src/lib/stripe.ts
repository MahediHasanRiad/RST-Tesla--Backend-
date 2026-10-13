import Stripe from "stripe";
import { env } from "../config/env.js";
import { ApiError } from "../shared/http/api-error.js";

let client: Stripe | undefined;

function getClient(): Stripe {
  if (!env.STRIPE_SECRET_KEY)
    throw new ApiError(503, "payment_unavailable", "Stripe payments are not configured");
  return client ??= new Stripe(env.STRIPE_SECRET_KEY);
}

export const stripe = {
  async createPaymentIntent(input: {
    amountPaisa: number;
    rideId: string;
    paymentId: string;
    idempotencyKey: string;
  }) {
    return getClient().paymentIntents.create(
      {
        amount: input.amountPaisa,
        currency: env.STRIPE_CURRENCY,
        metadata: { rideId: input.rideId, paymentId: input.paymentId },
        automatic_payment_methods: { enabled: true },
      },
      { idempotencyKey: input.idempotencyKey },
    );
  },

  async retrievePaymentIntent(id: string) {
    return getClient().paymentIntents.retrieve(id);
  },

  constructWebhookEvent(payload: Buffer, signature: string) {
    if (!env.STRIPE_WEBHOOK_SECRET)
      throw new ApiError(503, "payment_unavailable", "Stripe webhooks are not configured");
    try {
      return getClient().webhooks.constructEvent(payload, signature, env.STRIPE_WEBHOOK_SECRET);
    } catch {
      throw new ApiError(400, "invalid_webhook_signature", "Invalid webhook signature");
    }
  },
};
