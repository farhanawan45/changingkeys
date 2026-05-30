import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const { quoteId, customerEmail, customerName, quotePrice } = body;

    if (!quoteId || !customerEmail || !quotePrice) {
      return NextResponse.json(
        { error: "quoteId, customerEmail and quotePrice are required" },
        { status: 400 }
      );
    }

    const successUrl = `https://changingkeys.vercel.app/dashboard/quotes/${quoteId}?paid=true`;
    const cancelUrl = `https://changingkeys.vercel.app/dashboard/quotes/${quoteId}?canceled=true`;

    console.log("🟢 Creating checkout session for:", {
      quoteId,
      customerEmail,
      customerName,
      quotePrice,
    });

    console.log("SUCCESS URL TEST:", successUrl);
    console.log("CANCEL URL TEST:", cancelUrl);

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      customer_email: customerEmail,

      metadata: {
        quoteId: String(quoteId),
        customerEmail: String(customerEmail),
        customerName: String(customerName || ""),
      },

      line_items: [
        {
          price_data: {
            currency: "gbp",
            product_data: {
              name: `Changing Keys Quote #${String(quoteId).slice(0, 8)}`,
              description: `Removal service quotation for ${
                customerName || "customer"
              }`,
            },
            unit_amount: Math.round(Number(quotePrice) * 100),
          },
          quantity: 1,
        },
      ],

      mode: "payment",
      success_url: successUrl,
      cancel_url: cancelUrl,
    });

    console.log("✅ Checkout session created:", session.id);
    console.log("📧 Checkout customer_email:", session.customer_email);
    console.log("📦 Checkout metadata:", session.metadata);
    console.log("🔗 Stripe checkout url:", session.url);

    return NextResponse.json({
      url: session.url,
    });
  } catch (error) {
    console.error("❌ Failed to create checkout session:", error);

    return NextResponse.json(
      {
        error: "Failed to create checkout session",
      },
      {
        status: 500,
      }
    );
  }
}