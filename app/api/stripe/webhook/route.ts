import { NextResponse } from "next/server";
import Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { finalizeBookingPayment } from "@/lib/booking-confirmation";

export async function POST(req: Request) {
  console.log("[WEBHOOK] STRIPE WEBHOOK ROUTE HIT", new Date().toISOString());

  const body = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    console.log("[WEBHOOK] Missing stripe signature");
    return NextResponse.json(
      { error: "Missing stripe signature" },
      { status: 400 }
    );
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (error) {
    console.log("[WEBHOOK] Webhook signature error:", error);

    return NextResponse.json(
      { error: "Invalid webhook signature" },
      { status: 400 }
    );
  }

  console.log("[WEBHOOK] Event received:", event.type, new Date().toISOString());

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const quoteId = session.metadata?.quoteId;

    console.log("[WEBHOOK] checkout.session.completed triggered", {
      quoteId,
      amount_total: session.amount_total,
      payment_intent: session.payment_intent,
      timestamp: new Date().toISOString(),
    });

    if (!quoteId) {
      console.log("[WEBHOOK] Missing quote id in metadata");
      return NextResponse.json(
        { error: "Missing quote id" },
        { status: 400 }
      );
    }

    try {
      console.log("[WEBHOOK] Calling finalizeBookingPayment", {
        quoteId,
        paymentMethod: "Card (Stripe)",
        timestamp: new Date().toISOString(),
      });

      const finalizeResult = await finalizeBookingPayment({
        quoteId,
        paymentMethod: "Card (Stripe)",
        paymentAmount:
          typeof session.amount_total === "number"
            ? (session.amount_total / 100).toFixed(2)
            : undefined,
        transactionId: typeof session.payment_intent === "string"
          ? session.payment_intent
          : undefined,
      });

      console.log("[WEBHOOK] finalizeBookingPayment completed", {
        result: finalizeResult,
        timestamp: new Date().toISOString(),
      });
    } catch (finalizeError) {
      console.log("[WEBHOOK] finalizeBookingPayment error:", {
        error: finalizeError instanceof Error ? finalizeError.message : finalizeError,
        stack: finalizeError instanceof Error ? finalizeError.stack : undefined,
        timestamp: new Date().toISOString(),
      });
    }
  } else {
    console.log("[WEBHOOK] Event type not checkout.session.completed, ignoring", event.type);
  }

  return NextResponse.json({
    received: true,
  });
}
