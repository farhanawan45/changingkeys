import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { createCalendarBooking } from "@/lib/google-calendar";
import {
  createSmtpTransporter,
  getEmailErrorDetails,
  getSmtpConfig,
  isSmtpSendSuccessful,
} from "@/lib/email";
import { supabase } from "@/lib/supabase";
import { createBookingReminders } from "@/lib/reminders";
import twilio from "twilio";

const BOOKING_CONFIRMATION_SENT_TITLE = (quoteId: string) =>
  `Booking confirmation sent - quote ${quoteId}`;
const BOOKING_CONFIRMATION_FAILED_TITLE = (quoteId: string) =>
  `Booking confirmation failed - quote ${quoteId}`;
const BOOKING_CONFIRMED_TITLE = (quoteId: string) =>
  `Booking confirmed - quote ${quoteId}`;

function normalizeEmail(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim();
}

async function buildBookingConfirmationPdf({
  quoteId,
  customerName,
  customerEmail,
  quotePrice,
  bookingStatus,
  movingDate,
  pickupAddress,
  dropoffAddress,
  paymentMethod,
}: {
  quoteId: string;
  customerName: string;
  customerEmail: string;
  quotePrice: string | number;
  bookingStatus: string;
  movingDate?: string | null;
  pickupAddress?: string | null;
  dropoffAddress?: string | null;
  paymentMethod: string;
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

  page.drawText("Booking Confirmation", {
    x: 50,
    y: 720,
    size: 22,
    font: boldFont,
  });

  page.drawText(`Customer: ${customerName || "Customer"}`,
    { x: 50, y: 670, size: 12, font });

  page.drawText(`Email: ${customerEmail}`, {
    x: 50,
    y: 650,
    size: 12,
    font,
  });

  page.drawText(`Quote ID: ${quoteId}`, {
    x: 50,
    y: 630,
    size: 12,
    font,
  });

  page.drawText(`Amount Paid: GBP ${quotePrice}`, {
    x: 50,
    y: 590,
    size: 18,
    font: boldFont,
    color: rgb(0.02, 0.45, 0.28),
  });

  page.drawText(`Payment Method: ${paymentMethod}`, {
    x: 50,
    y: 565,
    size: 12,
    font,
  });

  page.drawText(`Booking Status: ${bookingStatus}`, {
    x: 50,
    y: 545,
    size: 12,
    font,
  });

  page.drawText(`Moving Date: ${movingDate || "Not added"}`, {
    x: 50,
    y: 525,
    size: 12,
    font,
  });

  page.drawText(`Pickup: ${pickupAddress || "Not added"}`, {
    x: 50,
    y: 505,
    size: 12,
    font,
  });

  page.drawText(`Dropoff: ${dropoffAddress || "Not added"}`, {
    x: 50,
    y: 485,
    size: 12,
    font,
  });

  page.drawText("Thank you for booking with Changing Keys.", {
    x: 50,
    y: 450,
    size: 12,
    font,
  });

  return await pdfDoc.save();
}

function buildBookingConfirmationHtml({
  customerName,
  quoteId,
  quotePrice,
  bookingStatus,
  movingDate,
  pickupAddress,
  dropoffAddress,
  paymentMethod,
}: {
  customerName: string;
  quoteId: string;
  quotePrice: string | number;
  bookingStatus: string;
  movingDate?: string | null;
  pickupAddress?: string | null;
  dropoffAddress?: string | null;
  paymentMethod: string;
}) {
  return `
    <div style="font-family: Arial, sans-serif; background:#f8fafc; padding:40px 20px;">
      <div style="max-width:700px; margin:auto; background:white; border-radius:20px; overflow:hidden; border:1px solid #e2e8f0;">
        <div style="background:#059669; padding:30px; text-align:center;">
          <h1 style="color:white; margin:0; font-size:40px;">Changing Keys</h1>
          <p style="color:#d1fae5; margin-top:10px; font-size:16px;">Booking Confirmed</p>
        </div>

        <div style="padding:40px;">
          <p style="font-size:18px; color:#0f172a;">Hello ${customerName || "Customer"},</p>

          <p style="color:#475569; line-height:1.8; margin-top:20px;">
            Thank you for your payment. Your removal booking has been confirmed.
          </p>

          <div style="margin-top:30px; padding:25px; background:#ecfdf5; border-radius:18px;">
            <p style="margin:0 0 12px; color:#064e3b;"><strong>Quote ID:</strong> ${quoteId}</p>
            <p style="margin:0 0 12px; color:#064e3b;"><strong>Amount Paid:</strong> GBP ${quotePrice}</p>
            <p style="margin:0 0 12px; color:#064e3b;"><strong>Payment Method:</strong> ${paymentMethod}</p>
            <p style="margin:0 0 12px; color:#064e3b;"><strong>Booking Status:</strong> ${bookingStatus}</p>
            <p style="margin:0 0 12px; color:#064e3b;"><strong>Moving Date:</strong> ${movingDate || "Not added"}</p>
            <p style="margin:0 0 12px; color:#064e3b;"><strong>Pickup:</strong> ${pickupAddress || "Not added"}</p>
            <p style="margin:0; color:#064e3b;"><strong>Dropoff:</strong> ${dropoffAddress || "Not added"}</p>
          </div>

          <p style="color:#64748b; line-height:1.8; margin-top:35px;">
            PDF booking confirmation attached with this email.
          </p>

          <div style="margin-top:40px; border-top:1px solid #e2e8f0; padding-top:25px;">
            <p style="color:#0f172a; font-weight:bold; margin-bottom:8px;">Changing Keys</p>
            <p style="color:#64748b; margin:0;">Professional UK Removal Company</p>
            <p style="color:#64748b; margin:0;">bookings@changingkeys.co.uk</p>
          </div>
        </div>
      </div>
    </div>
  `;
}

function isTwilioConfigured() {
  return (
    !!process.env.TWILIO_ACCOUNT_SID &&
    !!process.env.TWILIO_AUTH_TOKEN &&
    !!process.env.TWILIO_FROM_NUMBER
  );
}

function twilioClient() {
  return twilio(
    process.env.TWILIO_ACCOUNT_SID!,
    process.env.TWILIO_AUTH_TOKEN!
  );
}

function formatCustomerPhone(phone?: string | null) {
  if (!phone) return "";
  return phone.trim();
}

function isTwilioTrialError(error: unknown) {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes("trial") ||
      message.includes("unverified") ||
      message.includes("permission") ||
      message.includes("not a valid")
    );
  }

  return false;
}

async function findExistingNotification(title: string) {
  const { data, error } = await supabase
    .from("notifications")
    .select("id")
    .eq("title", title)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.log("BOOKING CONFIRMATION NOTIFICATION QUERY ERROR:", error);
    return false;
  }

  return Boolean(data?.id);
}

async function insertNotification({
  title,
  message,
  type = "email",
  leadId,
}: {
  title: string;
  message: string;
  type?: string;
  leadId?: string;
}) {
  const { error } = await supabase.from("notifications").insert([{
    title,
    message,
    type,
    lead_id: leadId || null,
    is_read: false,
  }]);

  if (error) {
    console.log("BOOKING CONFIRMATION NOTIFICATION INSERT ERROR:", error);
  }
}

export async function sendBookingConfirmationEmail({
  quoteId,
  customerName,
  customerEmail,
  quotePrice,
  bookingStatus,
  movingDate,
  pickupAddress,
  dropoffAddress,
  paymentMethod,
  leadId,
}: {
  quoteId: string;
  customerName: string;
  customerEmail: string;
  quotePrice: string | number;
  bookingStatus: string;
  movingDate?: string | null;
  pickupAddress?: string | null;
  dropoffAddress?: string | null;
  paymentMethod: string;
  leadId?: string;
}) {
  const emailToSend = normalizeEmail(customerEmail);

  if (!emailToSend) {
    const errorMessage = "No customer email found for booking confirmation";
    console.log("SMTP BOOKING EMAIL ERROR:", errorMessage);
    await insertNotification({
      title: BOOKING_CONFIRMATION_FAILED_TITLE(quoteId),
      message: errorMessage,
      type: "email",
      leadId,
    });
    return { sent: false };
  }

  const successTitle = BOOKING_CONFIRMATION_SENT_TITLE(quoteId);
  const alreadySent = await findExistingNotification(successTitle);

  if (alreadySent) {
    console.log("BOOKING CONFIRMATION EMAIL SKIPPED: already sent", {
      quoteId,
      customerEmail: emailToSend,
    });
    return { sent: true, skipped: true };
  }

  try {
    const pdfBytes = await buildBookingConfirmationPdf({
      quoteId,
      customerName,
      customerEmail: emailToSend,
      quotePrice,
      bookingStatus,
      movingDate,
      pickupAddress,
      dropoffAddress,
      paymentMethod,
    });

    const smtpConfig = getSmtpConfig();
    const transporter = createSmtpTransporter();

    const emailResult = await transporter.sendMail({
      from: smtpConfig.from,
      to: emailToSend,
      subject: "Booking Confirmed - Changing Keys",
      html: buildBookingConfirmationHtml({
        customerName,
        quoteId,
        quotePrice,
        bookingStatus,
        movingDate,
        pickupAddress,
        dropoffAddress,
        paymentMethod,
      }),
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

    const emailAccepted = isSmtpSendSuccessful(emailResult);
    console.log("SMTP BOOKING EMAIL DELIVERY CHECK:", {
      emailAccepted,
      accepted: emailResult.accepted,
      rejected: emailResult.rejected,
      response: emailResult.response,
    });

    if (!emailAccepted) {
      const failureDetails = {
        message: "SMTP did not accept the booking confirmation email",
        accepted: emailResult.accepted,
        rejected: emailResult.rejected,
        response: emailResult.response,
      };

      console.log("SMTP BOOKING EMAIL REJECTED:", failureDetails);

      await insertNotification({
        title: BOOKING_CONFIRMATION_FAILED_TITLE(quoteId),
        message: `Booking confirmation email was not accepted by SMTP for quote ${quoteId}. ${JSON.stringify(
          failureDetails
        )}`,
        type: "email",
        leadId,
      });

      return {
        sent: false,
        error: failureDetails,
        accepted: emailResult.accepted,
        rejected: emailResult.rejected,
      };
    }

    await insertNotification({
      title: successTitle,
      message: `Booking confirmation email sent to ${emailToSend} for quote ${quoteId}.`,
      type: "email",
      leadId,
    });

    return {
      sent: true,
      accepted: emailResult.accepted,
      rejected: emailResult.rejected,
    };
  } catch (emailError) {
    const details = getEmailErrorDetails(emailError);
    console.log("SMTP BOOKING EMAIL ERROR:", details);

    await insertNotification({
      title: BOOKING_CONFIRMATION_FAILED_TITLE(quoteId),
      message: `Booking confirmation email failed for quote ${quoteId}. ${
        details instanceof Object ? JSON.stringify(details) : details
      }`,
      type: "email",
      leadId,
    });

    return { sent: false, error: details };
  }
}

export async function sendBookingConfirmationSms({
  customerPhone,
  customerName,
  quoteId,
  quotePrice,
  pickupAddress,
  dropoffAddress,
  paymentMethod,
}: {
  customerPhone?: string | null;
  customerName: string;
  quoteId: string;
  quotePrice: string | number;
  pickupAddress?: string | null;
  dropoffAddress?: string | null;
  paymentMethod: string;
}) {
  if (!isTwilioConfigured()) {
    return { sent: false, reason: "Twilio not configured" };
  }

  const to = formatCustomerPhone(customerPhone);
  if (!to) {
    return { sent: false, reason: "No customer phone number provided" };
  }

  try {
    const client = twilioClient();
    const message = await client.messages.create({
      from: process.env.TWILIO_FROM_NUMBER!,
      to,
      body: `Hi ${customerName || "Customer"}, your Changing Keys booking (${quoteId.slice(
        0,
        8
      )}) has been confirmed. Paid GBP ${quotePrice}. Payment method: ${paymentMethod}. Pickup: ${pickupAddress ||
        "N/A"}. Dropoff: ${dropoffAddress || "N/A"}.`,
    });

    console.log("SMS confirmation sent:", {
      quoteId,
      to,
      sid: message.sid,
      status: message.status,
    });

    return { sent: true };
  } catch (smsError) {
    const details = smsError instanceof Error ? smsError.message : smsError;
    const safeMessage = isTwilioTrialError(smsError)
      ? "Twilio trial or verification prevents SMS delivery."
      : `SMS failed: ${details}`;

    console.log("SMS BOOKING CONFIRMATION ERROR:", safeMessage);
    return { sent: false, error: safeMessage };
  }
}

function buildBookingDateTime(movingDate: string) {
  const date = new Date(`${movingDate}T09:00:00`);
  const startDateTime = date.toISOString();
  date.setHours(date.getHours() + 2);

  return {
    startDateTime,
    endDateTime: date.toISOString(),
  };
}

export async function finalizeBookingPayment({
  quoteId,
  paymentMethod,
  paymentAmount,
  transactionId,
}: {
  quoteId: string;
  paymentMethod: string;
  paymentAmount?: string | number;
  transactionId?: string;
}) {
  const { data: quote, error: quoteError } = await supabase
    .from("quotes")
    .select("*, lead_id")
    .eq("id", quoteId)
    .single();

  if (quoteError || !quote) {
    throw new Error("Quote not found");
  }

  const { data: lead, error: leadError } = await supabase
    .from("leads")
    .select("*")
    .eq("id", quote.lead_id)
    .single();

  if (leadError || !lead) {
    throw new Error("Lead not found");
  }

  const bookingStatus = "confirmed";

  if (quote.status !== "paid") {
    const { error: updateQuoteError } = await supabase
      .from("quotes")
      .update({ status: "paid" })
      .eq("id", quoteId);

    if (updateQuoteError) {
      console.log("BOOKING CONFIRMATION ERROR: quote update failed", updateQuoteError);
    }
  }

  if (lead.status !== "booked") {
    const { error: updateLeadError } = await supabase
      .from("leads")
      .update({ status: "booked" })
      .eq("id", lead.id);

    if (updateLeadError) {
      console.log("BOOKING CONFIRMATION ERROR: lead update failed", updateLeadError);
    }
  }

  console.log("[BOOKING] BOOKING DATE SOURCE", {
    quoteId,
    leadId: lead.id,
    movingDate: lead.moving_date,
    timestamp: new Date().toISOString(),
  });

  const { data: existingBooking } = await supabase
    .from("bookings")
    .select("*")
    .eq("quote_id", quoteId)
    .maybeSingle();

  if (!existingBooking) {
    console.log("[BOOKING] WEBHOOK BOOKING INSERT START", {
      quoteId,
      leadId: lead.id,
      timestamp: new Date().toISOString(),
    });

    const bookingData = {
      quote_id: quoteId,
      lead_id: lead.id,
      status: bookingStatus,
      booking_date: lead.moving_date || null,
    };

    console.log("[BOOKING] WEBHOOK BOOKING INSERT DATA", {
      quoteId,
      data: bookingData,
      timestamp: new Date().toISOString(),
    });

    const { error: bookingError } = await supabase.from("bookings").insert([
      bookingData,
    ]);

    if (bookingError) {
      console.log("[BOOKING] WEBHOOK BOOKING INSERT ERROR", {
        quoteId,
        error: bookingError,
        timestamp: new Date().toISOString(),
      });
    } else {
      console.log("[BOOKING] WEBHOOK BOOKING INSERT SUCCESS", {
        quoteId,
        leadId: lead.id,
        bookingDate: lead.moving_date,
        timestamp: new Date().toISOString(),
      });
    }
  } else {
    console.log("[BOOKING] BOOKING ALREADY EXISTS", {
      bookingId: existingBooking.id,
      quoteId,
      existingBookingDate: existingBooking.booking_date,
      timestamp: new Date().toISOString(),
    });
  }

  const bookingToUse = existingBooking?.id || (await supabase
    .from("bookings")
    .select("id")
    .eq("quote_id", quoteId)
    .single()
    .then((r) => r.data?.id));

  let bookingCalendarEventId: string | null | undefined = undefined;
  let bookingSupportsCalendarIdField = false;

  if (bookingToUse) {
    console.log("CALLING createBookingReminders:", {
      bookingId: bookingToUse,
      leadId: lead.id,
      movingDate: lead.moving_date,
      timestamp: new Date().toISOString(),
    });

    const startTime = Date.now();
    const reminderResult = await createBookingReminders(
      bookingToUse,
      lead.id,
      lead.moving_date
    );
    const elapsed = Date.now() - startTime;

    console.log("createBookingReminders RETURNED:", {
      bookingId: bookingToUse,
      success: reminderResult,
      elapsedMs: elapsed,
      timestamp: new Date().toISOString(),
    });

    // Verify reminders were created
    const { data: verifyReminders, error: verifyError } = await supabase
      .from("reminders")
      .select("id, type, status, scheduled_for")
      .eq("booking_id", bookingToUse);

    console.log("BOOKING REMINDER VERIFICATION:", {
      bookingId: bookingToUse,
      remindersFound: verifyReminders?.length || 0,
      reminders: verifyReminders,
      verifyError,
      timestamp: new Date().toISOString(),
    });

    const { data: bookingRecord, error: bookingSelectError } = await supabase
      .from("bookings")
      .select("id, calendar_event_id")
      .eq("id", bookingToUse)
      .single();

    if (bookingSelectError) {
      console.log("[CALENDAR] BOOKING CALENDAR INFO QUERY FAILED:", {
        bookingId: bookingToUse,
        error: bookingSelectError,
        timestamp: new Date().toISOString(),
      });
    } else if (bookingRecord) {
      bookingSupportsCalendarIdField = Object.prototype.hasOwnProperty.call(
        bookingRecord,
        "calendar_event_id"
      );
      bookingCalendarEventId = bookingRecord.calendar_event_id;
      console.log("[CALENDAR] BOOKING CALENDAR FIELD CHECK:", {
        bookingId: bookingToUse,
        bookingSupportsCalendarIdField,
        bookingCalendarEventId,
      });
    }
  } else {
    console.log("[BOOKING] BOOKING REMINDERS SKIPPED: No booking ID found", {
      quoteId,
      existingBooking: !!existingBooking,
    });
  }

  console.log("[CALENDAR] CALENDAR LOGIC START", {
    quoteId,
    bookingId: bookingToUse,
    leadMovingDate: lead.moving_date,
    bookingCalendarEventId,
    timestamp: new Date().toISOString(),
  });

  if (!lead.moving_date) {
    console.log("[CALENDAR] GOOGLE CALENDAR SKIPPED MISSING DATE: lead has no moving date", {
      quoteId,
      bookingId: bookingToUse,
      leadId: lead.id,
      timestamp: new Date().toISOString(),
    });
  } else if (bookingCalendarEventId) {
    console.log("[CALENDAR] GOOGLE CALENDAR SKIPPED: calendar_event_id already exists", {
      bookingId: bookingToUse,
      calendar_event_id: bookingCalendarEventId,
      timestamp: new Date().toISOString(),
    });
  } else {
    try {
      const bookingDateToUse = lead.moving_date;

      console.log("[CALENDAR] GOOGLE CALENDAR PROCEEDING", {
        quoteId,
        bookingId: bookingToUse,
        bookingDate: bookingDateToUse,
        timestamp: new Date().toISOString(),
      });

      if (!bookingDateToUse) {
        console.log("[CALENDAR] GOOGLE CALENDAR SKIPPED MISSING DATE: could not resolve booking date", {
          quoteId,
          bookingId: bookingToUse,
          leadMovingDate: lead.moving_date,
          timestamp: new Date().toISOString(),
        });
        throw new Error(
          "Cannot create calendar event: no booking date available"
        );
      }

      const { startDateTime, endDateTime } = buildBookingDateTime(
        bookingDateToUse
      );

      console.log("[CALENDAR] GOOGLE CALENDAR START", {
        quoteId,
        bookingId: bookingToUse,
        customerName: lead.customer_name,
        movingDate: lead.moving_date,
        pickupAddress: lead.pickup_address,
        dropoffAddress: lead.dropoff_address,
        timestamp: new Date().toISOString(),
      });

      const eventData = await createCalendarBooking({
        summary: `Changing Keys Booking - ${lead.customer_name || "Customer"}`,
        description: `Customer: ${lead.customer_name || "Not added"}\nEmail: ${lead.customer_email || "Not added"}\nPhone: ${lead.customer_phone || "Not added"}\nPickup: ${lead.pickup_address || "Not added"}\nDropoff: ${lead.dropoff_address || "Not added"}\nQuote ID: ${quote.id}\nBooking ID: ${bookingToUse}`,
        location: lead.pickup_address || undefined,
        startDateTime,
        endDateTime,
      });

      console.log("[CALENDAR] GOOGLE CALENDAR EVENT CREATED", {
        bookingId: bookingToUse,
        eventId: eventData.id,
        htmlLink: eventData.htmlLink,
        start: eventData.start,
        end: eventData.end,
        timestamp: new Date().toISOString(),
      });

      if (bookingSupportsCalendarIdField && eventData.id) {
        const { error: updateError } = await supabase
          .from("bookings")
          .update({ calendar_event_id: eventData.id })
          .eq("id", bookingToUse);

        if (updateError) {
          console.log("[CALENDAR] BOOKING CALENDAR EVENT ID UPDATE FAILED:", {
            bookingId: bookingToUse,
            eventId: eventData.id,
            error: updateError,
            timestamp: new Date().toISOString(),
          });
        } else {
          console.log("[CALENDAR] BOOKING CALENDAR EVENT ID UPDATED ON BOOKING", {
            bookingId: bookingToUse,
            eventId: eventData.id,
            timestamp: new Date().toISOString(),
          });
        }
      } else if (!bookingSupportsCalendarIdField) {
        console.log("[CALENDAR] BOOKING CALENDAR FIELD MISSING: calendar_event_id not available on bookings table", {
          bookingId: bookingToUse,
          eventId: eventData.id,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (calendarError) {
      console.log("[CALENDAR] GOOGLE CALENDAR ERROR", {
        quoteId,
        bookingId: bookingToUse,
        error: calendarError instanceof Error ? calendarError.message : calendarError,
        stack: calendarError instanceof Error ? calendarError.stack : undefined,
        timestamp: new Date().toISOString(),
      });

      await insertNotification({
        title: `Calendar sync failed - quote ${quoteId}`,
        message: `Failed to sync booking to Google Calendar for quote ${quoteId}. ${
          calendarError instanceof Error
            ? calendarError.message
            : JSON.stringify(calendarError)
        }`,
        type: "booking",
        leadId: lead.id,
      });
    }
  }

  const emailResult = await sendBookingConfirmationEmail({
    quoteId,
    customerName: lead.customer_name || "Customer",
    customerEmail:
      lead.customer_email || quote.customer_email || "",
    quotePrice:
      paymentAmount !== undefined
        ? paymentAmount
        : typeof quote.price === "number"
        ? quote.price.toFixed(2)
        : quote.price,
    bookingStatus,
    movingDate: lead.moving_date,
    pickupAddress: lead.pickup_address,
    dropoffAddress: lead.dropoff_address,
    paymentMethod,
    leadId: lead.id,
  });

  const smsResult = await sendBookingConfirmationSms({
    customerPhone: lead.customer_phone,
    customerName: lead.customer_name || "Customer",
    quoteId,
    quotePrice:
      paymentAmount !== undefined
        ? paymentAmount
        : typeof quote.price === "number"
        ? quote.price.toFixed(2)
        : quote.price,
    pickupAddress: lead.pickup_address,
    dropoffAddress: lead.dropoff_address,
    paymentMethod,
  });

  await insertNotification({
    title: BOOKING_CONFIRMED_TITLE(quoteId),
    message: `Booking confirmed for quote ${quoteId}. Email sent: ${
      emailResult.sent ? "yes" : "no"
    }. SMS sent: ${smsResult.sent ? "yes" : "no"}.`,
    type: "booking",
    leadId: lead.id,
  });

  return {
    emailResult,
    smsResult,
    quoteStatus: "paid",
    bookingStatus,
    leadStatus: "booked",
    transactionId,
  };
}
