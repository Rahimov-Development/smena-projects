import assert from "node:assert/strict";
import test from "node:test";
import { assertTestCheckoutSession, assertTestSecretKey } from "./stripe-key";

test("accepts test secret and sandbox restricted keys", () => {
  assert.equal(assertTestSecretKey("sk_test_abc"), "sk_test_abc");
  assert.equal(assertTestSecretKey("rk_test_abc"), "rk_test_abc");
  assert.equal(assertTestSecretKey("rkcs_test_abc"), "rkcs_test_abc");
});

test("refuses live keys and publishable keys", () => {
  assert.throws(() => assertTestSecretKey("sk_live_abc"), /Live Stripe keys/);
  assert.throws(() => assertTestSecretKey("rk_live_abc"), /Live Stripe keys/);
  assert.throws(() => assertTestSecretKey("rkcs_live_abc"), /Live Stripe keys/);
  assert.throws(() => assertTestSecretKey("pk_test_abc"), /test-mode secret/);
  assert.throws(() => assertTestSecretKey(""), /missing/);
  assert.throws(() => assertTestSecretKey(undefined), /missing/);
});

test("accepts only test-mode checkout sessions", () => {
  assert.doesNotThrow(() =>
    assertTestCheckoutSession({ id: "cs_test_abc", livemode: false }),
  );
  assert.throws(
    () => assertTestCheckoutSession({ id: "cs_live_abc", livemode: true }),
    /not sandbox or test mode/,
  );
  assert.throws(
    () => assertTestCheckoutSession({ id: "cs_test_abc", livemode: true }),
    /not sandbox or test mode/,
  );
});
