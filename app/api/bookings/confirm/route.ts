import { NextResponse } from "next/server";
import { finalizeBookingPayment } from "@/lib/booking-confirmation";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { quoteId, paymentMethod } = body;

    if (!quoteId || !paymentMethod) {
      return NextResponse.json(
        {
          error: "quoteId and paymentMethod are required",
        },
        { status: 400 }
      );
    }

    const result = await finalizeBookingPayment({
      quoteId,
      paymentMethod,
    });

    return NextResponse.json({
      message: "Booking payment finalized",
      result,
    });
  } catch (error) {
    console.log("BOOKING CONFIRMATION ENDPOINT ERROR:", error);

    return NextResponse.json(
      {
        error: "Failed to finalize booking payment",
        details: error instanceof Error ? error.message : error,
      },
      { status: 500 }
    );
  }
}
