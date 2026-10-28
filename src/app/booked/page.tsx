import { connection } from "next/server";
import { Suspense } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DISCOVERY_CURRENCY, DISCOVERY_NAME } from "@/lib/brief";
import { getStripe } from "@/lib/stripe";
import { assertTestCheckoutSession, redactSecrets } from "@/lib/stripe-key";
import type Stripe from "stripe";

export default function BookedPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  return (
    <main className="mx-auto flex min-h-full w-full max-w-xl flex-col justify-center px-5 py-16">
      <Suspense
        fallback={
          <p className="text-sm text-muted-foreground">Checking the payment…</p>
        }
      >
        <BookedResult searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

type BookingView =
  | { status: "missing" }
  | { status: "error"; message: string }
  | { status: "pending" }
  | {
      status: "paid";
      amount: string;
      title: string | null;
      email: string | null;
    };

async function BookedResult({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  await connection();
  const { session_id: sessionId } = await searchParams;
  const view = await loadBooking(sessionId);

  if (view.status === "missing") {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-3xl font-normal">
            No checkout session
          </CardTitle>
          <CardDescription>
            This page confirms a discovery call after Stripe sends you back.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button render={<Link href="/" />} nativeButton={false}>
            Back to the brief
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (view.status === "error") {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-3xl font-normal">
            Could not confirm the booking
          </CardTitle>
          <CardDescription>{view.message}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button render={<Link href="/" />} nativeButton={false}>
            Back to the brief
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (view.status === "pending") {
    return (
      <Card>
        <CardHeader>
          <CardDescription>{DISCOVERY_NAME}</CardDescription>
          <CardTitle className="font-heading text-3xl font-normal">
            Payment is still confirming
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm leading-6 text-muted-foreground">
          Stripe has not marked this checkout as paid yet. The call is booked
          only after the payment succeeds. Refresh this page in a moment.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardDescription>
          {DISCOVERY_NAME} · {view.amount}
        </CardDescription>
        <CardTitle className="font-heading text-4xl font-normal tracking-tight">
          Call booked
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 text-sm leading-6">
        <p>The slot is held. We already have the brief you wrote.</p>
        {view.title ? <p className="text-muted-foreground">{view.title}</p> : null}
        {view.email ? (
          <p className="text-muted-foreground">Receipt sent to {view.email}.</p>
        ) : null}
      </CardContent>
    </Card>
  );
}

async function loadBooking(sessionId: string | undefined): Promise<BookingView> {
  if (!sessionId) return { status: "missing" };
  try {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    return viewFromSession(session);
  } catch (error) {
    return {
      status: "error",
      message: redactSecrets(
        error instanceof Error ? error.message : "Could not read the checkout.",
      ),
    };
  }
}

function viewFromSession(session: Stripe.Checkout.Session): BookingView {
  assertTestCheckoutSession(session);
  const paid =
    session.payment_status === "paid" ||
    session.payment_status === "no_payment_required";
  if (!paid) return { status: "pending" };
  const amount = new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: (session.currency ?? DISCOVERY_CURRENCY).toUpperCase(),
  }).format((session.amount_total ?? 0) / 100);
  return {
    status: "paid",
    amount,
    title: session.metadata?.brief_title ?? null,
    email: session.customer_details?.email ?? null,
  };
}
