import { NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import {
  createSmtpTransporter,
  getEmailErrorDetails,
  getSmtpConfig,
  isSmtpSendSuccessful,
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
  console.log("SEND_QUOTE_REQUEST:", {
    timestamp: new Date().toISOString(),
    method: req.method,
  });

  try {
    // ============ PARSE REQUEST BODY ============
    let body: any;
    try {
      body = await req.json();
      console.log("SEND_QUOTE_PAYLOAD:", body);
    } catch (parseError) {
      const details = getEmailErrorDetails(parseError);
      console.log("SEND_QUOTE_REQUEST_PARSE_ERROR:", details);
      return NextResponse.json(
        {
          success: false,
          error: "Invalid JSON payload",
          details,
        },
        { status: 400 }
      );
    }

    const { quoteId, customerEmail, customerName, quotePrice } = body;
    const emailToSend =
      typeof customerEmail === "string" ? customerEmail.trim() : "";

    if (!quoteId || !emailToSend || !customerName || !quotePrice) {
      const msg =
        "quoteId, customerEmail, customerName and quotePrice are required";
      console.log("SEND_QUOTE_VALIDATION_ERROR:", {
        error: msg,
        received: {
          quoteId: Boolean(quoteId),
          customerEmail: Boolean(emailToSend),
          customerName: Boolean(customerName),
          quotePrice: Boolean(quotePrice),
        },
      });
      return NextResponse.json(
        {
          success: false,
          error: msg,
        },
        { status: 400 }
      );
    }

    // ============ STEP 1: VALIDATE SMTP CONFIG UPFRONT ============
    console.log("SEND_QUOTE_VALIDATING_SMTP_CONFIG");
    let smtpConfig: any;
    let transporter: any;

    try {
      smtpConfig = getSmtpConfig();
      if (!smtpConfig.user || !smtpConfig.pass) {
        const errorMsg =
          "Missing SMTP email configuration. Required: SMTP_USER and SMTP_PASS, or RESEND_API_KEY.";
        console.log("SEND_QUOTE_SMTP_ERROR:", { error: errorMsg });
        return NextResponse.json(
          {
            success: false,
            error: errorMsg,
          },
          { status: 500 }
        );
      }
      console.log("SEND_QUOTE_SMTP_CONFIG_OK");

      // Try to create transporter to catch any initialization errors
      transporter = createSmtpTransporter();
      console.log("SEND_QUOTE_SMTP_TRANSPORTER_CREATED");
    } catch (smtpError) {
      const details = getEmailErrorDetails(smtpError);
      console.log("SEND_QUOTE_SMTP_ERROR:", details);
      return NextResponse.json(
        {
          success: false,
          error: `SMTP configuration error: ${
            details?.message || String(smtpError)
          }`,
          details,
        },
        { status: 500 }
      );
    }

    const successUrl = `https://changingkeys-7mzr.vercel.app/dashboard/quotes/${quoteId}?paid=true`;
    const cancelUrl = `https://changingkeys-7mzr.vercel.app/dashboard/quotes/${quoteId}?canceled=true`;

    console.log("QUOTE EMAIL TO:", emailToSend);

    // ============ STEP 2: TRY TO CREATE STRIPE PAYMENT LINK (BUT CONTINUE IF IT FAILS) ============
    let paymentLink: string | null = null;
    let stripeError: unknown = null;

    try {
      console.log("SEND_QUOTE_CREATING_STRIPE_SESSION");
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

      paymentLink = session.url;
    } catch (error) {
      stripeError = error;
      const details = getEmailErrorDetails(error);
      console.log("SEND_QUOTE_STRIPE_LINK_ERROR:", {
        error: details,
        quoteId,
        customerEmail: emailToSend,
        timestamp: new Date().toISOString(),
      });
      console.log(
        "SEND_QUOTE_CONTINUING_WITHOUT_STRIPE_LINK: Will send email without payment link."
      );
    }

    // ============ STEP 3: CREATE PDF ============
    console.log("SEND_QUOTE_CREATING_PDF");
    let pdfBytes: Uint8Array;
    try {
      pdfBytes = await createQuotePdf({
        quoteId,
        customerName,
        customerEmail: emailToSend,
        quotePrice,
        paymentLink,
      });
      console.log("SEND_QUOTE_PDF_CREATED");
    } catch (pdfError) {
      const details = getEmailErrorDetails(pdfError);
      console.log("SEND_QUOTE_PDF_ERROR:", details);
      return NextResponse.json(
        {
          success: false,
          error: `PDF generation failed: ${
            details?.message || String(pdfError)
          }`,
          details,
        },
        { status: 500 }
      );
    }

    // ============ STEP 4: BUILD EMAIL HTML (WITH OR WITHOUT PAYMENT LINK) ============
    const paymentSectionHtml = paymentLink
      ? `
              <div style="text-align:center;">
                <a
                  href="${paymentLink}"
                  style="display:inline-block; background:#059669; color:white; text-decoration:none; padding:16px 34px; border-radius:14px; font-weight:bold; font-size:16px;"
                >
                  Pay Now
                </a>
              </div>
            `
      : `
              <div style="padding:20px; background:#fef3c7; border-radius:8px; border-left:4px solid #f59e0b;">
                <p style="color:#92400e; margin:0; font-weight:bold;">Payment Link Temporarily Unavailable</p>
                <p style="color:#b45309; margin-top:8px; margin-bottom:0; font-size:14px;">
                  We encountered a temporary issue generating your payment link. Please contact us at 
                  <a href="mailto:bookings@changingkeys.co.uk" style="color:#b45309; text-decoration:underline;">
                    bookings@changingkeys.co.uk
                  </a> 
                  to complete your payment, or reply to this email.
                </p>
              </div>
            `;

    const emailHtml = `
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

            ${paymentSectionHtml}

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
    `;

    // ============ STEP 5: SEND EMAIL ============
    console.log("SEND_QUOTE_SENDING_EMAIL");
    let emailResult: any;
    try {
      emailResult = await transporter.sendMail({
        from: smtpConfig.from,
        to: emailToSend,
        subject: "Your Removal Quote - Changing Keys",
        html: emailHtml,
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
        timestamp: new Date().toISOString(),
      });
    } catch (sendError) {
      const details = getEmailErrorDetails(sendError);
      console.log("SEND_QUOTE_EMAIL_SEND_FAILURE:", details);
      return NextResponse.json(
        {
          success: false,
          error: `Failed to send email: ${
            details?.message || String(sendError)
          }`,
          details,
        },
        { status: 500 }
      );
    }

    // ============ CHECK EMAIL DELIVERY ============
    const emailAccepted = isSmtpSendSuccessful(emailResult);
    console.log("SMTP QUOTE EMAIL DELIVERY CHECK:", {
      emailAccepted,
      accepted: emailResult.accepted,
      rejected: emailResult.rejected,
      response: emailResult.response,
    });

    if (!emailAccepted) {
      const details = getEmailErrorDetails(
        new Error(
          `SMTP email was not accepted by the mail server. accepted=${JSON.stringify(
            emailResult.accepted
          )}, rejected=${JSON.stringify(emailResult.rejected)}, response=${
            emailResult.response
          }`
        )
      );
      console.log("SEND_QUOTE_EMAIL_NOT_ACCEPTED:", details);
      return NextResponse.json(
        {
          success: false,
          error: `Email not accepted by mail server: ${JSON.stringify(
            emailResult.rejected
          )}`,
          details,
        },
        { status: 500 }
      );
    }

    // ============ STEP 6: CREATE REMINDERS (ASYNC, NON-BLOCKING) ============
    console.log("========== STARTING REMINDER CREATION FLOW ==========");
    console.log("STARTING REMINDER CREATION FLOW FOR QUOTE:", {
      quoteId,
      timestamp: new Date().toISOString(),
    });

    try {
      console.log("LOOKING UP QUOTE FROM DATABASE...");
      const { data: quote, error: quoteError } = await supabase
        .from("quotes")
        .select("lead_id")
        .eq("id", quoteId)
        .single();

      console.log("QUOTE LOOKUP RESULT:", {
        quoteId,
        quoteFound: !!quote,
        leadId: quote?.lead_id,
        quoteError,
        timestamp: new Date().toISOString(),
      });

      if (!quote) {
        console.log("QUOTE LOOKUP FAILED - CANNOT CREATE REMINDERS:", {
          quoteId,
          error: quoteError,
          timestamp: new Date().toISOString(),
        });
      } else {
        console.log("QUOTE LOOKUP SUCCEEDED - CREATING REMINDERS:", {
          quoteId,
          leadId: quote.lead_id,
          timestamp: new Date().toISOString(),
        });

        console.log("CALLING createQuoteFollowupReminders...");
        const startTime = Date.now();
        const reminderResult = await createQuoteFollowupReminders(
          quoteId,
          quote.lead_id
        );
        const elapsed = Date.now() - startTime;

        console.log("createQuoteFollowupReminders RETURNED:", {
          quoteId,
          success: reminderResult,
          elapsedMs: elapsed,
          timestamp: new Date().toISOString(),
        });

        // Immediately verify reminders were created
        console.log("VERIFYING REMINDERS IN DATABASE...");
        const { data: verifyReminders, error: verifyError } = await supabase
          .from("reminders")
          .select("id, type, status, scheduled_for, quote_id, lead_id")
          .eq("quote_id", quoteId);

        console.log("========== REMINDER VERIFICATION AFTER INSERT ==========");
        console.log("REMINDER VERIFICATION AFTER INSERT:", {
          quoteId,
          remindersFound: verifyReminders?.length || 0,
          reminders: verifyReminders,
          verifyError,
          timestamp: new Date().toISOString(),
        });

        if (!verifyReminders || verifyReminders.length === 0) {
          console.log("WARNING: NO REMINDERS FOUND AFTER INSERT ATTEMPT");
          console.log("DIAGNOSTIC INFO:", {
            quoteId,
            leadId: quote.lead_id,
            insertFunctionReturned: reminderResult,
            databaseVerificationFound: 0,
            possibleCauses: [
              "RLS policy blocking inserts",
              "Authentication issue",
              "Column name mismatch",
              "Insert was silently rolled back",
              "Function did not actually call insert",
            ],
          });
        }
      }
    } catch (reminderError) {
      const details = getEmailErrorDetails(reminderError);
      console.log("SEND_QUOTE_REMINDER_ERROR:", details);
      // Non-blocking: log but don't fail the response
      console.log(
        "Reminder creation failed but email was sent successfully. Continuing."
      );
    }

    console.log("========== REMINDER CREATION FLOW COMPLETE ==========");

    // ============ STEP 7: FINAL SUCCESS RESPONSE ============
    console.log("SEND_QUOTE_SUCCESS:", {
      quoteId,
      customerEmail: emailToSend,
      messageId: emailResult.messageId,
      paymentLinkGenerated: !!paymentLink,
      stripeErrorOccurred: !!stripeError,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      message: "Quote email sent successfully",
      data: {
        messageId: emailResult.messageId,
        accepted: emailResult.accepted,
        rejected: emailResult.rejected,
        paymentLinkGenerated: !!paymentLink,
        stripeErrorOccurred: !!stripeError,
      },
    });
  } catch (error) {
    const details = getEmailErrorDetails(error);
    console.log("SEND_QUOTE_FINAL_ERROR:", details);

    return NextResponse.json(
      {
        success: false,
        error: `Internal server error: ${
          details?.message || String(error)
        }`,
        details,
      },
      { status: 500 }
    );
  }
}
