import { createSmtpTransporter, getEmailErrorDetails, getSmtpConfig } from "@/lib/email";
import { supabase } from "@/lib/supabase";

export type ReminderType = "quote_followup" | "payment_pending" | "booking_reminder" | "review_request";

function addHours(date: Date, hours: number): Date {
  const result = new Date(date);
  result.setHours(result.getHours() + hours);
  return result;
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

async function reminderExists(
  quoteId?: string | null,
  bookingId?: string | null,
  type?: ReminderType
): Promise<boolean> {
  if (!quoteId && !bookingId) return false;

  const query = supabase.from("reminders").select("id");

  if (quoteId && type) {
    const { data } = await query
      .eq("quote_id", quoteId)
      .eq("type", type)
      .limit(1)
      .maybeSingle();

    return !!data?.id;
  }

  if (bookingId && type) {
    const { data } = await query
      .eq("booking_id", bookingId)
      .eq("type", type)
      .limit(1)
      .maybeSingle();

    return !!data?.id;
  }

  return false;
}

export async function createQuoteFollowupReminders(
  quoteId: string,
  leadId?: string | null
): Promise<boolean> {
  try {
    console.log("REMINDER CREATION STARTING:", { quoteId, leadId });
    
    const now = new Date();
    const followupTime = addHours(now, 24);
    const paymentPendingTime = addHours(now, 48);

    const followupExists = await reminderExists(quoteId, null, "quote_followup");
    const paymentExists = await reminderExists(quoteId, null, "payment_pending");

    console.log("REMINDER EXISTENCE CHECK:", {
      quoteId,
      followupExists,
      paymentExists,
    });

    const toInsert = [];

    if (!followupExists) {
      toInsert.push({
        lead_id: leadId || null,
        quote_id: quoteId,
        booking_id: null,
        type: "quote_followup",
        status: "pending",
        scheduled_for: followupTime.toISOString(),
      });
    }

    if (!paymentExists) {
      toInsert.push({
        lead_id: leadId || null,
        quote_id: quoteId,
        booking_id: null,
        type: "payment_pending",
        status: "pending",
        scheduled_for: paymentPendingTime.toISOString(),
      });
    }

    console.log("REMINDERS TO INSERT:", {
      count: toInsert.length,
      records: toInsert,
    });

    if (toInsert.length > 0) {
      const { data, error } = await supabase.from("reminders").insert(toInsert);

      if (error) {
        console.log("REMINDER INSERT ERROR (quote followup):", {
          error,
          errorCode: error?.code,
          errorMessage: error?.message,
          toInsert,
        });
        return false;
      }

      console.log("REMINDER CREATED:", {
        quoteId,
        count: toInsert.length,
        followupAt: followupTime.toISOString(),
        paymentAt: paymentPendingTime.toISOString(),
        insertedData: data,
      });
    }

    return true;
  } catch (error) {
    console.log("REMINDER INSERT ERROR (quote followup exception):", {
      error,
      errorMessage: error instanceof Error ? error.message : String(error),
      quoteId,
      leadId,
    });
    return false;
  }
}

export async function createBookingReminders(
  bookingId: string,
  leadId?: string | null,
  movingDate?: string | null
): Promise<boolean> {
  if (!movingDate) {
    console.log("BOOKING REMINDERS SKIPPED: no moving date provided");
    return true;
  }

  try {
    console.log("BOOKING REMINDER CREATION STARTING:", { bookingId, leadId, movingDate });
    
    const moveDateTime = new Date(`${movingDate}T09:00:00`);
    const reminderTime = addDays(moveDateTime, -1);
    const reviewTime = addDays(moveDateTime, 1);

    const bookingReminderExists = await reminderExists(null, bookingId, "booking_reminder");
    const reviewReminderExists = await reminderExists(null, bookingId, "review_request");

    console.log("BOOKING REMINDER EXISTENCE CHECK:", {
      bookingId,
      bookingReminderExists,
      reviewReminderExists,
    });

    const toInsert = [];

    if (!bookingReminderExists) {
      toInsert.push({
        lead_id: leadId || null,
        quote_id: null,
        booking_id: bookingId,
        type: "booking_reminder",
        status: "pending",
        scheduled_for: reminderTime.toISOString(),
      });
    }

    if (!reviewReminderExists) {
      toInsert.push({
        lead_id: leadId || null,
        quote_id: null,
        booking_id: bookingId,
        type: "review_request",
        status: "pending",
        scheduled_for: reviewTime.toISOString(),
      });
    }

    console.log("BOOKING REMINDERS TO INSERT:", {
      count: toInsert.length,
      records: toInsert,
    });

    if (toInsert.length > 0) {
      const { data, error } = await supabase.from("reminders").insert(toInsert);

      if (error) {
        console.log("REMINDER INSERT ERROR (booking):", {
          error,
          errorCode: error?.code,
          errorMessage: error?.message,
          toInsert,
        });
        return false;
      }

      console.log("REMINDER CREATED:", {
        bookingId,
        count: toInsert.length,
        reminderAt: reminderTime.toISOString(),
        reviewAt: reviewTime.toISOString(),
        insertedData: data,
      });
    }

    return true;
  } catch (error) {
    console.log("REMINDER INSERT ERROR (booking exception):", {
      error,
      errorMessage: error instanceof Error ? error.message : String(error),
      bookingId,
      leadId,
      movingDate,
    });
    return false;
  }
}

async function buildQuoteFollowupEmail(
  customerName: string,
  quoteAmount: string | number
): Promise<string> {
  return `
    <div style="font-family: Arial, sans-serif; background:#f8fafc; padding:40px 20px;">
      <div style="max-width:700px; margin:auto; background:white; border-radius:20px; overflow:hidden; border:1px solid #e2e8f0;">
        <div style="background:#059669; padding:30px; text-align:center;">
          <h1 style="color:white; margin:0; font-size:40px;">Changing Keys</h1>
          <p style="color:#d1fae5; margin-top:10px; font-size:16px;">Quote Follow-up</p>
        </div>

        <div style="padding:40px;">
          <p style="font-size:18px; color:#0f172a;">Hello ${customerName || "Customer"},</p>

          <p style="color:#475569; line-height:1.8; margin-top:20px;">
            We hope you're satisfied with your removal quote. Just a friendly reminder that your quote is still available for booking.
          </p>

          <div style="margin-top:30px; padding:25px; background:#ecfdf5; border-radius:18px;">
            <p style="margin:0; color:#064e3b;">
              <strong>Quote Amount:</strong> GBP ${quoteAmount}
            </p>
          </div>

          <div style="text-align:center; margin-top:30px;">
            <p style="color:#475569; margin-bottom:20px;">Ready to proceed?</p>
            <a href="https://changingkeys-7mzr.vercel.app/dashboard/quotes" style="display:inline-block; background:#059669; color:white; text-decoration:none; padding:14px 30px; border-radius:12px; font-weight:bold; font-size:16px;">
              View Your Quote
            </a>
          </div>

          <p style="color:#64748b; line-height:1.8; margin-top:35px;">
            If you have any questions, please don't hesitate to contact us.
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

async function buildPaymentPendingEmail(
  customerName: string,
  quoteAmount: string | number
): Promise<string> {
  return `
    <div style="font-family: Arial, sans-serif; background:#f8fafc; padding:40px 20px;">
      <div style="max-width:700px; margin:auto; background:white; border-radius:20px; overflow:hidden; border:1px solid #e2e8f0;">
        <div style="background:#d97706; padding:30px; text-align:center;">
          <h1 style="color:white; margin:0; font-size:40px;">Changing Keys</h1>
          <p style="color:#fef3c7; margin-top:10px; font-size:16px;">Payment Reminder</p>
        </div>

        <div style="padding:40px;">
          <p style="font-size:18px; color:#0f172a;">Hello ${customerName || "Customer"},</p>

          <p style="color:#475569; line-height:1.8; margin-top:20px;">
            We noticed your quote is still pending payment. We'd love to confirm your booking and get your move scheduled!
          </p>

          <div style="margin-top:30px; padding:25px; background:#fef3c7; border-radius:18px;">
            <p style="margin:0; color:#92400e;">
              <strong>Outstanding Amount:</strong> GBP ${quoteAmount}
            </p>
          </div>

          <div style="text-align:center; margin-top:30px;">
            <a href="https://changingkeys-7mzr.vercel.app/dashboard/quotes" style="display:inline-block; background:#d97706; color:white; text-decoration:none; padding:14px 30px; border-radius:12px; font-weight:bold; font-size:16px;">
              Complete Payment
            </a>
          </div>

          <p style="color:#64748b; line-height:1.8; margin-top:35px;">
            Contact us if you need any changes to your quote.
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

async function buildBookingReminderEmail(
  customerName: string,
  movingDate: string,
  pickupAddress?: string | null,
  dropoffAddress?: string | null
): Promise<string> {
  return `
    <div style="font-family: Arial, sans-serif; background:#f8fafc; padding:40px 20px;">
      <div style="max-width:700px; margin:auto; background:white; border-radius:20px; overflow:hidden; border:1px solid #e2e8f0;">
        <div style="background:#059669; padding:30px; text-align:center;">
          <h1 style="color:white; margin:0; font-size:40px;">Changing Keys</h1>
          <p style="color:#d1fae5; margin-top:10px; font-size:16px;">Moving Day Reminder</p>
        </div>

        <div style="padding:40px;">
          <p style="font-size:18px; color:#0f172a;">Hello ${customerName || "Customer"},</p>

          <p style="color:#475569; line-height:1.8; margin-top:20px;">
            Your removal is scheduled for tomorrow! Here are the details of your move.
          </p>

          <div style="margin-top:30px; padding:25px; background:#ecfdf5; border-radius:18px;">
            <p style="margin:0 0 12px; color:#064e3b;">
              <strong>Moving Date:</strong> ${movingDate}
            </p>
            <p style="margin:0 0 12px; color:#064e3b;">
              <strong>Pickup:</strong> ${pickupAddress || "Not provided"}
            </p>
            <p style="margin:0; color:#064e3b;">
              <strong>Dropoff:</strong> ${dropoffAddress || "Not provided"}
            </p>
          </div>

          <p style="color:#475569; line-height:1.8; margin-top:30px;">
            Please ensure all items are packed and ready for collection. Our team will arrive at the pickup location on the scheduled date.
          </p>

          <p style="color:#64748b; line-height:1.8; margin-top:35px;">
            If you have any questions or need to reschedule, please contact us immediately.
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

async function buildReviewRequestEmail(
  customerName: string
): Promise<string> {
  return `
    <div style="font-family: Arial, sans-serif; background:#f8fafc; padding:40px 20px;">
      <div style="max-width:700px; margin:auto; background:white; border-radius:20px; overflow:hidden; border:1px solid #e2e8f0;">
        <div style="background:#0891b2; padding:30px; text-align:center;">
          <h1 style="color:white; margin:0; font-size:40px;">Changing Keys</h1>
          <p style="color:#cffafe; margin-top:10px; font-size:16px;">We'd Love Your Feedback</p>
        </div>

        <div style="padding:40px;">
          <p style="font-size:18px; color:#0f172a;">Hello ${customerName || "Customer"},</p>

          <p style="color:#475569; line-height:1.8; margin-top:20px;">
            Thank you for choosing Changing Keys for your removal! We hope your move went smoothly.
          </p>

          <p style="color:#475569; line-height:1.8; margin-top:20px;">
            Your feedback helps us improve our service. We'd love to hear about your experience.
          </p>

          <div style="text-align:center; margin-top:30px;">
            <a href="mailto:feedback@changingkeys.co.uk?subject=Moving%20Experience%20Feedback" style="display:inline-block; background:#0891b2; color:white; text-decoration:none; padding:14px 30px; border-radius:12px; font-weight:bold; font-size:16px;">
              Share Your Feedback
            </a>
          </div>

          <p style="color:#64748b; line-height:1.8; margin-top:35px;">
            Thank you for your business. We look forward to serving you again!
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

export async function processPendingReminders() {
  const { data: reminders, error: fetchError } = await supabase
    .from("reminders")
    .select(
      `
      id,
      type,
      status,
      scheduled_for,
      quote_id,
      booking_id,
      lead_id,
      quote:quote_id(id, price, customer_email),
      booking:booking_id(id, quote_id),
      lead:lead_id(id, customer_name, customer_email, moving_date, pickup_address, dropoff_address)
    `
    )
    .eq("status", "pending")
    .lte("scheduled_for", new Date().toISOString())
    .limit(50);

  if (fetchError) {
    console.log("REMINDER FETCH ERROR:", fetchError);
    return { processed: 0, errors: 0 };
  }

  if (!reminders || reminders.length === 0) {
    console.log("NO PENDING REMINDERS FOUND");
    return { processed: 0, errors: 0 };
  }

  let processed = 0;
  let errors = 0;

  for (const reminder of reminders) {
    try {
      console.log("REMINDER FOUND:", {
        id: reminder.id,
        type: reminder.type,
        quoteId: reminder.quote_id,
        bookingId: reminder.booking_id,
      });

      let emailToSend = "";
      let subject = "";
      let htmlBody = "";

      if (reminder.type === "quote_followup") {
        const quote = reminder.quote as any;
        const lead = reminder.lead as any;

        if (!quote || !lead?.customer_email) {
          console.log("REMINDER EMAIL SKIPPED: missing quote or email");
          errors++;
          continue;
        }

        emailToSend = lead.customer_email;
        subject = "Reminder: Your Changing Keys Quote";
        htmlBody = await buildQuoteFollowupEmail(lead.customer_name, quote.price);
      } else if (reminder.type === "payment_pending") {
        const quote = reminder.quote as any;
        const lead = reminder.lead as any;

        if (!quote || !lead?.customer_email) {
          console.log("REMINDER EMAIL SKIPPED: missing quote or email");
          errors++;
          continue;
        }

        if (quote.status === "paid") {
          console.log("REMINDER SKIPPED: quote already paid");
          await supabase
            .from("reminders")
            .update({ status: "cancelled" })
            .eq("id", reminder.id);
          continue;
        }

        emailToSend = lead.customer_email;
        subject = "Payment Reminder - Your Changing Keys Quote";
        htmlBody = await buildPaymentPendingEmail(lead.customer_name, quote.price);
      } else if (reminder.type === "booking_reminder") {
        const booking = reminder.booking as any;
        const lead = reminder.lead as any;

        if (!lead?.customer_email || !lead?.moving_date) {
          console.log("REMINDER EMAIL SKIPPED: missing email or moving date");
          errors++;
          continue;
        }

        emailToSend = lead.customer_email;
        subject = "Moving Day Reminder - Changing Keys";
        htmlBody = await buildBookingReminderEmail(
          lead.customer_name,
          lead.moving_date,
          lead.pickup_address,
          lead.dropoff_address
        );
      } else if (reminder.type === "review_request") {
        const lead = reminder.lead as any;

        if (!lead?.customer_email) {
          console.log("REMINDER EMAIL SKIPPED: missing email");
          errors++;
          continue;
        }

        emailToSend = lead.customer_email;
        subject = "We'd Love Your Feedback - Changing Keys";
        htmlBody = await buildReviewRequestEmail(lead.customer_name);
      }

      if (!emailToSend) {
        console.log("REMINDER EMAIL SKIPPED: no valid email found");
        errors++;
        continue;
      }

      console.log("REMINDER EMAIL TO:", emailToSend);

      const smtpConfig = getSmtpConfig();
      const transporter = createSmtpTransporter();

      const emailResult = await transporter.sendMail({
        from: smtpConfig.from,
        to: emailToSend,
        subject,
        html: htmlBody,
      });

      console.log("REMINDER EMAIL SENT:", {
        messageId: emailResult.messageId,
        accepted: emailResult.accepted,
      });

      const { error: updateError } = await supabase
        .from("reminders")
        .update({
          status: "sent",
          sent_at: new Date().toISOString(),
        })
        .eq("id", reminder.id);

      if (updateError) {
        console.log("REMINDER UPDATE ERROR:", updateError);
        errors++;
      } else {
        processed++;
      }
    } catch (error) {
      console.log("REMINDER EMAIL ERROR:", getEmailErrorDetails(error));
      errors++;
    }
  }

  return { processed, errors };
}
