import { NextResponse } from "next/server";
import Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { finalizeBookingPayment } from "@/lib/booking-confirmation";

export async function POST(req: Request) {
  console.log("STRIPE WEBHOOK ROUTE HIT");

  const body = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
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
    console.log("Webhook signature error:", error);

    return NextResponse.json(
      { error: "Invalid webhook signature" },
      { status: 400 }
    );
  }

  console.log("Webhook received:", event.type);

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const quoteId = session.metadata?.quoteId;

    console.log("checkout.session.completed triggered");

    if (!quoteId) {
      return NextResponse.json(
        { error: "Missing quote id" },
        { status: 400 }
      );
    }

    try {
      await finalizeBookingPayment({
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
    } catch (finalizeError) {
      console.log("Stripe webhook finalize error:", finalizeError);
    }
  }

  return NextResponse.json({
    received: true,
  });
}
