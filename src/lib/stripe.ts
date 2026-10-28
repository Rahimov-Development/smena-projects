import Stripe from "stripe";
import { assertTestSecretKey } from "./stripe-key";

let client: Stripe | undefined;

export function getStripe(): Stripe {
  const key = assertTestSecretKey(process.env.STRIPE_SECRET_KEY);
  if (!client) {
    client = new Stripe(key, {
      apiVersion: "2026-09-30.endive",
      typescript: true,
      appInfo: { name: "smena", version: "0.1.0" },
    });
  }
  return client;
}
