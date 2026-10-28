const LIVE_KEY = /(?:sk|rk|rkcs)_live_/;
const TEST_SECRET = /^(?:sk_test_|rk_test_|rkcs_test_)/;

export function assertTestSecretKey(key: string | undefined): string {
  const value = (key ?? "").trim();
  if (!value) {
    throw new Error("STRIPE_SECRET_KEY is missing.");
  }
  if (LIVE_KEY.test(value) || value.includes("_live_")) {
    throw new Error(
      "Live Stripe keys are refused. Use a test or sandbox key.",
    );
  }
  if (!TEST_SECRET.test(value)) {
    throw new Error(
      "STRIPE_SECRET_KEY must be a test-mode secret or restricted key.",
    );
  }
  return value;
}

export function assertTestCheckoutSession(session: {
  id: string;
  livemode: boolean;
}): void {
  if (session.livemode || !session.id.startsWith("cs_test_")) {
    throw new Error(
      "Refusing a Checkout Session that is not sandbox or test mode.",
    );
  }
}

export function redactSecrets(message: string): string {
  return message.replace(
    /(?:sk|rk|rkcs|pk)_(?:live|test)_[A-Za-z0-9]+/g,
    "[redacted]",
  );
}
