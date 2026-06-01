import { NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import {
  createSmtpTransporter,
  getEmailErrorDetails,
  getSmtpConfig,
} from "@/lib/email";
import { stripe } from "@/lib/stripe";
import { createQuoteFollowupReminders } from "@/lib/reminders";
import { supabase } from "@/lib/supabase";

async function createQuotePdf({
  quoteId,
  customerName,
  customerEmail,
  quotePrice,
  paymentLink,
}: {
  quoteId: string;
  customerName: string;
  customerEmail: string;
  quotePrice: string | number;
  paymentLink: string | null;
}) {
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

  page.drawText("Professional Removal Services", {
    x: 50,
    y: 750,
    size: 13,
    font,
    color: rgb(0.35, 0.4, 0.45),
  });

  page.drawText("Removal Quote", {
    x: 50,
    y: 700,
    size: 22,
    font: boldFont,
  });

  page.drawText(`Quote ID: ${quoteId}`, {
    x: 50,
    y: 670,
    size: 10,
    font,
  });

  page.drawText(`Customer: ${customerName || "Not added"}`, {
    x: 50,
    y: 625,
    size: 12,
    font,
  });

  page.drawText(`Email: ${customerEmail || "Not added"}`, {
    x: 50,
    y: 600,
    size: 12,
    font,
  });

  page.drawText("Quote Price", {
    x: 50,
    y: 540,
    size: 14,
    font: boldFont,
    color: rgb(0.02, 0.45, 0.28),
  });

  page.drawText(`GBP ${quotePrice}`, {
    x: 50,
    y: 500,
    size: 36,
    font: boldFont,
    color: rgb(0.02, 0.45, 0.28),
  });

  page.drawText("Payment Link:", {
    x: 50,
    y: 435,
    size: 12,
    font: boldFont,
  });

  page.drawText(paymentLink || "Not available", {
    x: 50,
    y: 410,
    size: 9,
    font,
    color: rgb(0.1, 0.25, 0.6),
  });

  page.drawText("Thank you for choosing Changing Keys.", {
    x: 50,
    y: 330,
    size: 12,
    font,
  });

  return await pdfDoc.save();
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    console.log("SEND_QUOTE_REQUEST_BODY:", body);

    const { quoteId, customerEmail, customerName, quotePrice } = body;
    const emailToSend =
      typeof customerEmail === "string" ? customerEmail.trim() : "";

    if (!quoteId || !emailToSend || !customerName || !quotePrice) {
      return NextResponse.json(
        {
          error:
            "quoteId, customerEmail, customerName and quotePrice are required",
          received: {
            quoteId: Boolean(quoteId),
            customerEmail: Boolean(emailToSend),
            customerName: Boolean(customerName),
            quotePrice: Boolean(quotePrice),
          },
        },
        { status: 400 }
      );
    }

    const successUrl = `https://changingkeys-7mzr.vercel.app/dashboard/quotes/${quoteId}?paid=true`;
    const cancelUrl = `https://changingkeys-7mzr.vercel.app/dashboard/quotes/${quoteId}?canceled=true`;

    console.log("QUOTE EMAIL TO:", emailToSend);

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      customer_email: emailToSend,

      metadata: {
        quoteId: String(quoteId),
        customerEmail: emailToSend,
        originalCustomerEmail: emailToSend,
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

    console.log("STRIPE SESSION CREATED:", {
      id: session.id,
      url: session.url,
      customerEmail: session.customer_email,
    });

    const paymentLink = session.url;

    const pdfBytes = await createQuotePdf({
      quoteId,
      customerName,
      customerEmail: emailToSend,
      quotePrice,
      paymentLink,
    });

    const smtpConfig = getSmtpConfig();
    const transporter = createSmtpTransporter();

    const emailResult = await transporter.sendMail({
      from: smtpConfig.from,
      to: emailToSend,
      subject: "Your Removal Quote - Changing Keys",
      html: `
        <div style="font-family: Arial, sans-serif; background:#f8fafc; padding:40px 20px;">
          <div style="max-width:700px; margin:auto; background:white; border-radius:20px; overflow:hidden; border:1px solid #e2e8f0;">
            <div style="background:#059669; padding:30px; text-align:center;">
              <h1 style="color:white; margin:0; font-size:40px;">Changing Keys</h1>
              <p style="color:#d1fae5; margin-top:10px; font-size:16px;">Professional Removal Services</p>
            </div>

            <div style="padding:40px;">
              <p style="font-size:18px; color:#0f172a;">Hello ${customerName},</p>

              <p style="color:#475569; line-height:1.8; margin-top:20px;">
                Thank you for requesting a quotation from Changing Keys.
              </p>

              <div style="margin-top:30px; margin-bottom:30px; padding:30px; background:#ecfdf5; border-radius:20px; text-align:center;">
                <p style="font-size:14px; color:#065f46; margin:0;">Your Quote Price</p>

                <h2 style="font-size:56px; color:#065f46; margin-top:15px; margin-bottom:0;">
                  £${quotePrice}
                </h2>
              </div>

              <div style="text-align:center;">
                <a
                  href="${paymentLink}"
                  style="display:inline-block; background:#059669; color:white; text-decoration:none; padding:16px 34px; border-radius:14px; font-weight:bold; font-size:16px;"
                >
                  Pay Now
                </a>
              </div>

              <p style="color:#64748b; line-height:1.8; margin-top:35px;">
                The PDF quotation is also attached with this email.
              </p>

              <div style="margin-top:40px; border-top:1px solid #e2e8f0; padding-top:25px;">
                <p style="color:#0f172a; font-weight:bold; margin-bottom:8px;">Changing Keys</p>
                <p style="color:#64748b; margin:0;">Professional UK Removal Company</p>
              </div>
            </div>
          </div>
        </div>
      `,
      attachments: [
        {
          filename: `changing-keys-quote-${quoteId.slice(0, 8)}.pdf`,
          content: Buffer.from(pdfBytes),
          contentType: "application/pdf",
        },
      ],
    });

    console.log("SMTP QUOTE EMAIL SENT:", {
      messageId: emailResult.messageId,
      accepted: emailResult.accepted,
      rejected: emailResult.rejected,
      response: emailResult.response,
    });

    const { data: quote, error: quoteError } = await supabase
      .from("quotes")
      .select("lead_id")
      .eq("id", quoteId)
      .single();

    console.log("QUOTE LOOKUP FOR REMINDERS:", {
      quoteId,
      quoteFound: !!quote,
      leadId: quote?.lead_id,
      quoteError,
    });

    if (quote) {
      console.log("ATTEMPTING TO CREATE REMINDERS FOR QUOTE:", {
        quoteId,
        leadId: quote.lead_id,
      });
      const reminderResult = await createQuoteFollowupReminders(
        quoteId,
        quote.lead_id
      );
      console.log("REMINDER CREATION RESULT:", {
        quoteId,
        success: reminderResult,
      });
    } else {
      console.log("QUOTE LOOKUP FAILED FOR REMINDER CREATION:", {
        quoteId,
        error: quoteError,
      });
    }

    return NextResponse.json({
      message: "Quote email sent successfully",
      data: {
        messageId: emailResult.messageId,
        accepted: emailResult.accepted,
        rejected: emailResult.rejected,
      },
    });
  } catch (error) {
    const details = getEmailErrorDetails(error);
    console.log("SMTP QUOTE EMAIL ERROR:", details);
    console.log("SEND_QUOTE_API_ERROR:", details);

    return NextResponse.json(
      {
        error: "Failed to send email",
        details,
      },
      { status: 500 }
    );
  }
}
