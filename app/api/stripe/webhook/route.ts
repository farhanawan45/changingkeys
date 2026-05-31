import { NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import Stripe from "stripe";
import { createCalendarBooking } from "@/lib/google-calendar";
import {
  createSmtpTransporter,
  getEmailErrorDetails,
  getSmtpConfig,
} from "@/lib/email";
import { stripe } from "@/lib/stripe";
import { supabase } from "@/lib/supabase";

function buildBookingDateTime(movingDate: string) {
  const date = new Date(`${movingDate}T09:00:00`);
  const startDateTime = date.toISOString();

  date.setHours(date.getHours() + 2);

  return {
    startDateTime,
    endDateTime: date.toISOString(),
  };
}

async function sendBookingConfirmationEmail({
  quoteId,
  customerName,
  customerEmail,
  quotePrice,
  bookingStatus,
  movingDate,
  pickupAddress,
  dropoffAddress,
}: {
  quoteId: string;
  customerName: string;
  customerEmail?: string;
  quotePrice: string | number;
  bookingStatus: string;
  movingDate?: string;
  pickupAddress?: string;
  dropoffAddress?: string;
}) {
  const emailToSend =
    typeof customerEmail === "string" ? customerEmail.trim() : "";

  if (!emailToSend) {
    console.log("SMTP BOOKING EMAIL ERROR:", "No customer email found");
    return;
  }

  try {
    console.log("BOOKING EMAIL TO:", emailToSend);

    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595, 842]);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    page.drawText("Changing Keys", {
      x: 50,
      y: 780,
      size: 30,
      font: boldFont,
      color: rgb(0.02, 0.45, 0.28),
    });

    page.drawText("Booking Confirmation", {
      x: 50,
      y: 720,
      size: 22,
      font: boldFont,
    });

    page.drawText(`Customer: ${customerName || "Customer"}`, {
      x: 50,
      y: 670,
      size: 12,
      font,
    });

    page.drawText(`Email: ${emailToSend}`, {
      x: 50,
      y: 640,
      size: 12,
      font,
    });

    page.drawText(`Quote ID: ${quoteId}`, {
      x: 50,
      y: 610,
      size: 12,
      font,
    });

    page.drawText(`Amount Paid: GBP ${quotePrice}`, {
      x: 50,
      y: 560,
      size: 24,
      font: boldFont,
      color: rgb(0.02, 0.45, 0.28),
    });

    page.drawText(`Booking Status: ${bookingStatus}`, {
      x: 50,
      y: 525,
      size: 12,
      font,
    });

    const pdfBytes = await pdfDoc.save();
    const smtpConfig = getSmtpConfig();
    const transporter = createSmtpTransporter();

    const emailResult = await transporter.sendMail({
      from: smtpConfig.from,
      to: emailToSend,
      subject: "Booking Confirmed - Changing Keys",
      html: `
        <div style="font-family: Arial, sans-serif; background:#f8fafc; padding:40px 20px;">
          <div style="max-width:700px; margin:auto; background:white; border-radius:20px; overflow:hidden; border:1px solid #e2e8f0;">
            <div style="background:#059669; padding:30px; text-align:center;">
              <h1 style="color:white; margin:0; font-size:40px;">Changing Keys</h1>
              <p style="color:#d1fae5; margin-top:10px; font-size:16px;">Booking Confirmed</p>
            </div>

            <div style="padding:40px;">
              <p style="font-size:18px; color:#0f172a;">
                Hello ${customerName || "Customer"},
              </p>

              <p style="color:#475569; line-height:1.8; margin-top:20px;">
                Thank you for your payment. Your removal booking has been confirmed.
              </p>

              <div style="margin-top:30px; padding:25px; background:#ecfdf5; border-radius:18px;">
                <p style="margin:0 0 12px; color:#064e3b;">
                  <strong>Quote ID:</strong> ${quoteId}
                </p>

                <p style="margin:0 0 12px; color:#064e3b;">
                  <strong>Amount Paid:</strong> GBP ${quotePrice}
                </p>

                <p style="margin:0 0 12px; color:#064e3b;">
                  <strong>Booking Status:</strong> ${bookingStatus}
                </p>

                <p style="margin:0 0 12px; color:#064e3b;">
                  <strong>Moving Date:</strong> ${movingDate || "Not added"}
                </p>

                <p style="margin:0 0 12px; color:#064e3b;">
                  <strong>Pickup:</strong> ${pickupAddress || "Not added"}
                </p>

                <p style="margin:0; color:#064e3b;">
                  <strong>Dropoff:</strong> ${dropoffAddress || "Not added"}
                </p>
              </div>

              <p style="color:#64748b; line-height:1.8; margin-top:35px;">
                PDF booking confirmation attached with this email.
              </p>

              <div style="margin-top:40px; border-top:1px solid #e2e8f0; padding-top:25px;">
                <p style="color:#0f172a; font-weight:bold; margin-bottom:8px;">
                  Changing Keys
                </p>

                <p style="color:#64748b; margin:0;">
                  Professional UK Removal Company
                </p>
              </div>
            </div>
          </div>
        </div>
      `,
      attachments: [
        {
          filename: "booking-confirmation.pdf",
          content: Buffer.from(pdfBytes),
          contentType: "application/pdf",
        },
      ],
    });

    console.log("SMTP BOOKING EMAIL SENT:", {
      messageId: emailResult.messageId,
      accepted: emailResult.accepted,
      rejected: emailResult.rejected,
      response: emailResult.response,
    });
  } catch (emailError) {
    const details = getEmailErrorDetails(emailError);

    console.log("SMTP BOOKING EMAIL ERROR:", details);
  }
}

function getCheckoutCustomerEmail(session: Stripe.Checkout.Session) {
  return (
    session.customer_details?.email ||
    session.customer_email ||
    session.metadata?.customerEmail ||
    session.metadata?.originalCustomerEmail ||
    ""
  );
}

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

    const { data: quote, error: quoteError } = await supabase
      .from("quotes")
      .select("*")
      .eq("id", quoteId)
      .single();

    if (quoteError || !quote) {
      console.log("Quote not found for paid checkout:", quoteError);

      return NextResponse.json(
        { error: "Quote not found" },
        { status: 404 }
      );
    }

    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .select("*")
      .eq("id", quote.lead_id)
      .single();

    if (leadError || !lead) {
      console.log("Lead not found for paid checkout:", leadError);

      return NextResponse.json(
        { error: "Lead not found" },
        { status: 404 }
      );
    }

    await supabase
      .from("quotes")
      .update({ status: "paid" })
      .eq("id", quoteId);

    await supabase
      .from("leads")
      .update({ status: "booked" })
      .eq("id", quote.lead_id);

    const { data: existingBooking } = await supabase
      .from("bookings")
      .select("*")
      .eq("quote_id", quote.id)
      .maybeSingle();

    const bookingStatus = "confirmed";

    if (!existingBooking) {
      const { error: bookingError } = await supabase.from("bookings").insert([
        {
          quote_id: quote.id,
          lead_id: quote.lead_id,
          status: bookingStatus,
        },
      ]);

      if (bookingError) {
        console.log("Booking create failed:", bookingError);
      }
    }

    const customerEmail =
      getCheckoutCustomerEmail(session) ||
      lead.customer_email ||
      quote.customer_email ||
      "";

    await sendBookingConfirmationEmail({
      quoteId: quote.id,
      customerName:
        lead.customer_name || session.metadata?.customerName || "Customer",
      customerEmail,
      quotePrice:
        typeof session.amount_total === "number"
          ? (session.amount_total / 100).toFixed(2)
          : quote.price,
      bookingStatus,
      movingDate: lead.moving_date,
      pickupAddress: lead.pickup_address,
      dropoffAddress: lead.dropoff_address,
    });

    if (lead.moving_date) {
      try {
        const { startDateTime, endDateTime } = buildBookingDateTime(
          lead.moving_date
        );

        await createCalendarBooking({
          summary: `Changing Keys Move - ${lead.customer_name || "Customer"}`,
          description: `
Customer: ${lead.customer_name || "Not added"}
Email: ${lead.customer_email || customerEmail || "Not added"}
Phone: ${lead.customer_phone || "Not added"}
Pickup: ${lead.pickup_address || "Not added"}
Dropoff: ${lead.dropoff_address || "Not added"}
Quote: GBP ${quote.price}
Quote ID: ${quote.id}
          `,
          startDateTime,
          endDateTime,
        });
      } catch (calendarError) {
        console.log("Calendar booking failed:", calendarError);
      }
    }
  }

  return NextResponse.json({
    received: true,
  });
}
