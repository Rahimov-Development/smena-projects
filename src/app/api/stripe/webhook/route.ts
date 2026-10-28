import { recordBooking } from "@/lib/bookings";
import { getStripe } from "@/lib/stripe";
import { assertTestCheckoutSession } from "@/lib/stripe-key";
import type Stripe from "stripe";

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!secret) {
    return Response.json(
      { error: "STRIPE_WEBHOOK_SECRET is missing." },
      { status: 500 },
    );
  }
  if (secret.includes("_live_")) {
    return Response.json(
      { error: "Live webhook secrets are refused." },
      { status: 500 },
    );
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return Response.json({ error: "Missing Stripe signature." }, { status: 400 });
  }

  const payload = await request.text();
  const stripe = getStripe();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(payload, signature, secret);
  } catch {
    return Response.json({ error: "Invalid Stripe signature." }, { status: 400 });
  }

  if (
    event.type === "checkout.session.completed" ||
    event.type === "checkout.session.async_payment_succeeded" ||
    event.type === "checkout.session.async_payment_failed"
  ) {
    const session = event.data.object as Stripe.Checkout.Session;
    if (event.livemode) {
      return Response.json(
        { error: "Live-mode events are refused." },
        { status: 400 },
      );
    }
    try {
      assertTestCheckoutSession(session);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Test mode required.";
      return Response.json({ error: message }, { status: 400 });
    }
    const failed = event.type === "checkout.session.async_payment_failed";
    const payable =
      session.payment_status === "paid" ||
      session.payment_status === "no_payment_required";

    if (!failed && !payable) {
      return Response.json({ received: true, fulfilled: false });
    }

    try {
      await recordBooking({
        sessionId: session.id,
        paymentStatus: failed ? "failed" : session.payment_status,
        amountTotal: session.amount_total,
        currency: session.currency,
        customerEmail: session.customer_details?.email ?? session.customer_email,
        briefTitle: session.metadata?.brief_title ?? null,
        eventType: event.type,
        recordedAt: new Date().toISOString(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not store the booking.";
      console.error(`Booking record skipped: ${message}`);
    }
  }

  return Response.json({ received: true, fulfilled: true });
}
