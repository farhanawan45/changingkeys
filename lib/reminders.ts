import { createSmtpTransporter, getEmailErrorDetails, getSmtpConfig } from "@/lib/email";
import { supabase } from "@/lib/supabase";

export type ReminderType = "quote_followup" | "payment_pending" | "booking_reminder" | "review_request";

export interface ProcessPendingRemindersResult {
  routeHit: true;
  currentTimeIso: string;
  dueRemindersCount: number;
  dueRemindersSample: Array<{
    id: string;
    type: string;
    status: string;
    scheduled_for: string | null;
    reminder_date: string | null;
    sent_at: string | null;
    lead_id: string | null;
    quote_id: string | null;
    booking_id: string | null;
  }>;
  processed: number;
  errors: number;
  errorDetails?: unknown;
  debug: Record<string, unknown>;
}

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
  const fnStartTime = Date.now();
  console.log("========== REMINDER CREATE START ==========");
  console.log("REMINDER CREATE START:", {
    quoteId,
    leadId,
    timestamp: new Date().toISOString(),
  });
  
  try {
    const now = new Date();
    const followupTime = addHours(now, 24);
    const paymentPendingTime = addHours(now, 48);

    console.log("REMINDER DATES CALCULATED:", {
      now: now.toISOString(),
      followupTime: followupTime.toISOString(),
      paymentPendingTime: paymentPendingTime.toISOString(),
    });

    console.log("CHECKING IF REMINDERS ALREADY EXIST...");
    const followupExists = await reminderExists(quoteId, null, "quote_followup");
    console.log("Followup reminder exists check: ", followupExists);
    
    const paymentExists = await reminderExists(quoteId, null, "payment_pending");
    console.log("Payment reminder exists check: ", paymentExists);

    console.log("REMINDER EXISTENCE CHECK:", {
      quoteId,
      followupExists,
      paymentExists,
    });

    const toInsert = [];

    if (!followupExists) {
      const record = {
        lead_id: leadId || null,
        quote_id: quoteId,
        booking_id: null,
        type: "quote_followup",
        status: "pending",
        scheduled_for: followupTime.toISOString(),
      };
      toInsert.push(record);
      console.log("Added quote_followup record to insert array:", record);
    }

    if (!paymentExists) {
      const record = {
        lead_id: leadId || null,
        quote_id: quoteId,
        booking_id: null,
        type: "payment_pending",
        status: "pending",
        scheduled_for: paymentPendingTime.toISOString(),
      };
      toInsert.push(record);
      console.log("Added payment_pending record to insert array:", record);
    }

    console.log("REMINDER DATA PREPARED:", {
      table: "reminders",
      schema: "public",
      recordCount: toInsert.length,
      records: JSON.stringify(toInsert, null, 2),
      quoteId,
      leadId,
    });

    if (toInsert.length > 0) {
      console.log("========== EXECUTING SUPABASE INSERT ==========");
      console.log("About to call: supabase.from('reminders').insert(toInsert)");
      console.log("toInsert:", JSON.stringify(toInsert, null, 2));
      
      const { data, error, status } = await supabase
        .from("reminders")
        .insert(toInsert);

      console.log("INSERT RETURNED:", {
        status,
        hasError: !!error,
        hasData: !!data,
        timestamp: new Date().toISOString(),
      });

      if (error) {
        console.log("========== REMINDER INSERT ERROR ==========");
        console.log("REMINDER INSERT ERROR:", {
          code: error?.code,
          message: error?.message,
          details: error?.details,
          hint: error?.hint,
          statusCode: (error as any)?.statusCode,
          status: (error as any)?.status,
          fullError: JSON.stringify(error),
          quoteId,
          leadId,
          recordsAttempted: toInsert.length,
          timestamp: new Date().toISOString(),
        });
        return false;
      }

      console.log("========== REMINDER INSERT SUCCESS ==========");
      console.log("REMINDER INSERT SUCCESS:", {
        quoteId,
        leadId,
        recordsInserted: toInsert.length,
        data,
        timestamp: new Date().toISOString(),
      });

      // Verify insertion
      console.log("VERIFYING INSERTED REMINDERS...");
      const { data: verify, error: verifyError } = await supabase
        .from("reminders")
        .select("id, type, status, scheduled_for")
        .eq("quote_id", quoteId);

      console.log("VERIFICATION RESULT:", {
        quoteId,
        found: verify?.length || 0,
        data: verify,
        verifyError,
      });
    } else {
      console.log("REMINDER INSERT SKIPPED: All reminders already exist", {
        quoteId,
        followupExists,
        paymentExists,
      });
    }

    const elapsed = Date.now() - fnStartTime;
    console.log("========== REMINDER CREATE COMPLETE ==========");
    console.log("REMINDER CREATION COMPLETED:", {
      quoteId,
      success: true,
      elapsedMs: elapsed,
      timestamp: new Date().toISOString(),
    });

    return true;
  } catch (error) {
    const elapsed = Date.now() - fnStartTime;
    console.log("========== REMINDER INSERT ERROR (EXCEPTION) ==========");
    console.log("REMINDER INSERT ERROR:", {
      exception: true,
      errorMessage: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
      quoteId,
      leadId,
      elapsedMs: elapsed,
      timestamp: new Date().toISOString(),
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
    console.log("REMINDER CREATE START: BOOKING REMINDERS SKIPPED (no moving date)");
    return true;
  }

  const fnStartTime = Date.now();
  console.log("========== REMINDER CREATE START ==========");
  console.log("REMINDER CREATE START:", {
    bookingId,
    leadId,
    movingDate,
    timestamp: new Date().toISOString(),
  });

  try {
    const moveDateTime = new Date(`${movingDate}T09:00:00`);
    const reminderTime = addDays(moveDateTime, -1);
    const reviewTime = addDays(moveDateTime, 1);

    console.log("REMINDER DATES CALCULATED:", {
      movingDate,
      moveDateTime: moveDateTime.toISOString(),
      reminderTime: reminderTime.toISOString(),
      reviewTime: reviewTime.toISOString(),
    });

    console.log("CHECKING IF REMINDERS ALREADY EXIST...");
    const bookingReminderExists = await reminderExists(null, bookingId, "booking_reminder");
    console.log("Booking reminder exists check: ", bookingReminderExists);
    
    const reviewReminderExists = await reminderExists(null, bookingId, "review_request");
    console.log("Review reminder exists check: ", reviewReminderExists);

    console.log("REMINDER EXISTENCE CHECK:", {
      bookingId,
      bookingReminderExists,
      reviewReminderExists,
    });

    const toInsert = [];

    if (!bookingReminderExists) {
      const record = {
        lead_id: leadId || null,
        quote_id: null,
        booking_id: bookingId,
        type: "booking_reminder",
        status: "pending",
        scheduled_for: reminderTime.toISOString(),
      };
      toInsert.push(record);
      console.log("Added booking_reminder record to insert array:", record);
    }

    if (!reviewReminderExists) {
      const record = {
        lead_id: leadId || null,
        quote_id: null,
        booking_id: bookingId,
        type: "review_request",
        status: "pending",
        scheduled_for: reviewTime.toISOString(),
      };
      toInsert.push(record);
      console.log("Added review_request record to insert array:", record);
    }

    console.log("REMINDER DATA PREPARED:", {
      table: "reminders",
      schema: "public",
      recordCount: toInsert.length,
      records: JSON.stringify(toInsert, null, 2),
      bookingId,
      leadId,
    });

    if (toInsert.length > 0) {
      console.log("========== EXECUTING SUPABASE INSERT ==========");
      console.log("About to call: supabase.from('reminders').insert(toInsert)");
      console.log("toInsert:", JSON.stringify(toInsert, null, 2));
      
      const { data, error, status } = await supabase
        .from("reminders")
        .insert(toInsert);

      console.log("INSERT RETURNED:", {
        status,
        hasError: !!error,
        hasData: !!data,
        timestamp: new Date().toISOString(),
      });

      if (error) {
        console.log("========== REMINDER INSERT ERROR ==========");
        console.log("REMINDER INSERT ERROR:", {
          code: error?.code,
          message: error?.message,
          details: error?.details,
          hint: error?.hint,
          statusCode: (error as any)?.statusCode,
          status: (error as any)?.status,
          fullError: JSON.stringify(error),
          bookingId,
          leadId,
          recordsAttempted: toInsert.length,
          timestamp: new Date().toISOString(),
        });
        return false;
      }

      console.log("========== REMINDER INSERT SUCCESS ==========");
      console.log("REMINDER INSERT SUCCESS:", {
        bookingId,
        leadId,
        recordsInserted: toInsert.length,
        data,
        timestamp: new Date().toISOString(),
      });

      // Verify insertion
      console.log("VERIFYING INSERTED REMINDERS...");
      const { data: verify, error: verifyError } = await supabase
        .from("reminders")
        .select("id, type, status, scheduled_for")
        .eq("booking_id", bookingId);

      console.log("VERIFICATION RESULT:", {
        bookingId,
        found: verify?.length || 0,
        data: verify,
        verifyError,
      });
    } else {
      console.log("REMINDER INSERT SKIPPED: All reminders already exist", {
        bookingId,
        bookingReminderExists,
        reviewReminderExists,
      });
    }

    const elapsed = Date.now() - fnStartTime;
    console.log("========== REMINDER CREATE COMPLETE ==========");
    console.log("REMINDER CREATION COMPLETED:", {
      bookingId,
      success: true,
      elapsedMs: elapsed,
      timestamp: new Date().toISOString(),
    });

    return true;
  } catch (error) {
    const elapsed = Date.now() - fnStartTime;
    console.log("========== REMINDER INSERT ERROR (EXCEPTION) ==========");
    console.log("REMINDER INSERT ERROR:", {
      exception: true,
      errorMessage: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
      bookingId,
      leadId,
      movingDate,
      elapsedMs: elapsed,
      timestamp: new Date().toISOString(),
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

export async function processPendingReminders(): Promise<ProcessPendingRemindersResult> {
  const currentTimeIso = new Date().toISOString();
  const directSelect = `
      id,
      type,
      status,
      scheduled_for,
      reminder_date,
      sent_at,
      lead_id,
      quote_id,
      booking_id
    `;
  const dueFilter = `scheduled_for.lte.${currentTimeIso},reminder_date.lte.${currentTimeIso}`;

  console.log("REMINDER QUERY START");
  console.log("REMINDER QUERY DETAILS", {
    table: "reminders",
    select: directSelect.replace(/\s+/g, " ").trim(),
    filters: { status: "pending", dueFilter },
    currentTimeIso,
    limit: 50,
  });

  const { data: dueReminders, error: dueFetchError } = await supabase
    .from("reminders")
    .select(directSelect)
    .eq("status", "pending")
    .or(dueFilter)
    .limit(50);

  const dueRemindersSample = dueReminders ?? [];
  const dueRemindersCount = dueRemindersSample.length;

  const debugBase: Record<string, unknown> = {
    directQuery: {
      select: directSelect.replace(/\s+/g, " ").trim(),
      filters: { status: "pending", dueFilter },
      currentTimeIso,
      limit: 50,
      dueFetchError: dueFetchError ? String(dueFetchError) : null,
      dueRemindersCount,
    },
    dueRemindersSample,
  };

  if (dueFetchError) {
    console.log("REMINDER DUE FETCH ERROR:", dueFetchError);
    return {
      routeHit: true,
      currentTimeIso,
      dueRemindersCount,
      dueRemindersSample,
      processed: 0,
      errors: 0,
      errorDetails: dueFetchError,
      debug: debugBase,
    };
  }

  if (dueRemindersCount === 0) {
    console.log("NO DUE PENDING REMINDERS FOUND");
    return {
      routeHit: true,
      currentTimeIso,
      dueRemindersCount,
      dueRemindersSample,
      processed: 0,
      errors: 0,
      debug: debugBase,
    };
  }

  const reminderIds = dueRemindersSample.map((reminder) => reminder.id).filter(Boolean);
  const fullSelect = `
      id,
      type,
      status,
      scheduled_for,
      reminder_date,
      sent_at,
      lead_id,
      quote_id,
      booking_id,
      quote:quote_id(id, price, customer_email, status),
      booking:booking_id(id, quote_id),
      lead:lead_id(id, customer_name, customer_email, moving_date, pickup_address, dropoff_address)
    `;

  const { data: reminders, error: fetchError } = await supabase
    .from("reminders")
    .select(fullSelect)
    .in("id", reminderIds)
    .limit(50);

  debugBase.fullQuery = {
    select: fullSelect.replace(/\s+/g, " ").trim(),
    filters: { id_in: reminderIds },
    fetchError: fetchError ? String(fetchError) : null,
    returnedCount: reminders?.length ?? 0,
  };

  if (fetchError) {
    console.log("REMINDER FULL FETCH ERROR:", fetchError);
    return {
      routeHit: true,
      currentTimeIso,
      dueRemindersCount,
      dueRemindersSample,
      processed: 0,
      errors: 0,
      errorDetails: fetchError,
      debug: debugBase,
    };
  }

  if (!reminders || reminders.length === 0) {
    console.log("NO REMINDERS RETURNED FROM FULL FETCH");
    return {
      routeHit: true,
      currentTimeIso,
      dueRemindersCount,
      dueRemindersSample,
      processed: 0,
      errors: 0,
      debug: debugBase,
    };
  }

  let processed = 0;
  let errors = 0;
  const errorDetails: Array<unknown> = [];

  for (const reminder of reminders) {
    try {
      console.log("REMINDER PROCESSING", reminder.id);

      let emailToSend = "";
      let subject = "";
      let htmlBody = "";

      if (reminder.type === "quote_followup") {
        const quote = reminder.quote as any;
        const lead = reminder.lead as any;

        if (!quote || !lead?.customer_email) {
          console.log("REMINDER EMAIL SKIPPED: missing quote or email");
          errors++;
          errorDetails.push({ id: reminder.id, reason: "missing quote or email" });
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
          errorDetails.push({ id: reminder.id, reason: "missing quote or email" });
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
        const lead = reminder.lead as any;

        if (!lead?.customer_email || !lead?.moving_date) {
          console.log("REMINDER EMAIL SKIPPED: missing email or moving date");
          errors++;
          errorDetails.push({ id: reminder.id, reason: "missing email or moving date" });
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
          errorDetails.push({ id: reminder.id, reason: "missing email" });
          continue;
        }

        emailToSend = lead.customer_email;
        subject = "We'd Love Your Feedback - Changing Keys";
        htmlBody = await buildReviewRequestEmail(lead.customer_name);
      }

      if (!emailToSend) {
        console.log("REMINDER EMAIL SKIPPED: no valid email found");
        errors++;
        errorDetails.push({ id: reminder.id, reason: "no valid email found" });
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

      console.log("REMINDER EMAIL SENT", reminder.id);
      console.log("REMINDER EMAIL SENT RESULT:", {
        messageId: emailResult.messageId,
        accepted: emailResult.accepted,
        rejected: emailResult.rejected,
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
        errorDetails.push({ id: reminder.id, updateError });
      } else {
        processed++;
      }
    } catch (error) {
      console.log("REMINDER EMAIL ERROR:", getEmailErrorDetails(error));
      console.log("REMINDER ERROR", error);
      errors++;
      errorDetails.push({ id: reminder.id, error: getEmailErrorDetails(error) });
    }
  }

  return {
    routeHit: true,
    currentTimeIso,
    dueRemindersCount,
    dueRemindersSample: dueRemindersSample.slice(0, 10),
    processed,
    errors,
    errorDetails: errorDetails.length > 0 ? errorDetails : undefined,
    debug: debugBase,
  };
}
