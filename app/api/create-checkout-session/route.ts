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

    console.log("🟢 Creating checkout session for:", {
      quoteId,
      customerEmail,
      customerName,
      quotePrice,
    });

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

      success_url: `http://localhost:3000/dashboard/quotes/${quoteId}?paid=true`,

      cancel_url: `http://localhost:3000/dashboard/quotes/${quoteId}?canceled=true`,
    });

    console.log("✅ Checkout session created:", session.id);
    console.log("📧 Checkout customer_email:", session.customer_email);
    console.log("📦 Checkout metadata:", session.metadata);

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