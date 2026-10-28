import { createHash } from "node:crypto";
import {
  DISCOVERY_AMOUNT,
  DISCOVERY_CURRENCY,
  DISCOVERY_NAME,
  INTEGRATION_IDENTIFIER,
  cleanAnswers,
  cleanBrief,
  cleanSummary,
} from "@/lib/brief";
import { getStripe } from "@/lib/stripe";
import { assertTestCheckoutSession, redactSecrets } from "@/lib/stripe-key";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Send the brief as JSON." }, { status: 400 });
  }

  try {
    const record = body as {
      brief?: unknown;
      answers?: unknown;
      summary?: unknown;
    };
    const brief = cleanBrief(record.brief);
    const answers = cleanAnswers(record.answers);
    if (answers.length < 2) {
      return Response.json(
        { error: "Answer at least two questions before booking." },
        { status: 400 },
      );
    }
    const summary = cleanSummary(record.summary);
    const origin = appOrigin(request);
    const stripe = getStripe();
    const idempotencyKey = createHash("sha256")
      .update(JSON.stringify({ brief, answers, summary, origin }))
      .digest("hex");

    const session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        submit_type: "book",
        locale: "en",
        integration_identifier: INTEGRATION_IDENTIFIER,
        client_reference_id: idempotencyKey.slice(0, 40),
        success_url: `${origin}/booked?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/?checkout=cancel`,
        metadata: {
          brief_title: summary.title.slice(0, 450),
          focus: summary.focus.slice(0, 450),
        },
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: DISCOVERY_CURRENCY,
              unit_amount: DISCOVERY_AMOUNT,
              product_data: {
                name: DISCOVERY_NAME,
                description: summary.focus.slice(0, 400),
              },
            },
          },
        ],
      },
      { idempotencyKey },
    );

    try {
      assertTestCheckoutSession(session);
    } catch (error) {
      if (session.status === "open") {
        await stripe.checkout.sessions.expire(session.id).catch(() => undefined);
      }
      throw error;
    }

    if (!session.url) {
      return Response.json(
        { error: "Stripe did not return a Checkout URL." },
        { status: 502 },
      );
    }

    return Response.json({ url: session.url, livemode: false });
  } catch (error) {
    const message = redactSecrets(
      error instanceof Error ? error.message : "Could not start Checkout.",
    );
    const status = /missing|must be|refused|Answer|summary|task|Question/i.test(
      message,
    )
      ? 400
      : 502;
    return Response.json({ error: message }, { status });
  }
}

function appOrigin(request: Request): string {
  const forwardedHost = firstHeader(request, "x-forwarded-host");
  const host = forwardedHost || firstHeader(request, "host");
  const proto = firstHeader(request, "x-forwarded-proto") || "https";
  if (host && !isLocalHost(host)) {
    return `${proto}://${host}`;
  }
  const configured = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (configured) return configured;
  return new URL(request.url).origin;
}

function firstHeader(request: Request, name: string): string | null {
  const value = request.headers.get(name)?.split(",")[0]?.trim();
  return value || null;
}

function isLocalHost(host: string): boolean {
  const name = host.split(":")[0]?.toLowerCase();
  return name === "localhost" || name === "127.0.0.1" || name === "0.0.0.0";
}
