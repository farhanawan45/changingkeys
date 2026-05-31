# Changing Keys CRM - Reminders/Follow-ups Module

## Overview

Complete reminder and follow-up automation module implemented for Changing Keys CRM. Handles quote follow-ups, payment reminders, booking reminders, and review requests using scheduled email notifications.

## Files Changed

### New Files Created:

1. **lib/reminders.ts** - Core reminder logic
   - `createQuoteFollowupReminders()` - Creates 24h quote follow-up and 48h payment pending reminders
   - `createBookingReminders()` - Creates 1-day-before and 1-day-after booking reminders
   - `processPendingReminders()` - Main processor that sends all pending reminder emails
   - Email template builders for each reminder type

2. **app/api/reminders/process/route.ts** - API endpoint
   - POST /api/reminders/process
   - Processes pending reminders and sends emails
   - Returns: `{ processed: number, errors: number }`

3. **app/dashboard/reminders/page.tsx** - Dashboard UI
   - Lists all scheduled reminders
   - Shows: customer, type, scheduled_for, status, sent_at
   - Filters pending/sent/cancelled reminders

4. **supabase/reminders.sql** - Database schema
   - reminders table with fields:
     - id, lead_id, quote_id, booking_id
     - type, status, scheduled_for, sent_at, created_at
   - Indexes on status/scheduled_for, quote_id/type, booking_id/type

### Modified Files:

1. **lib/booking-confirmation.ts**
   - Added `import { createBookingReminders }`
   - Calls `createBookingReminders()` after booking confirmation

2. **app/api/send-quote/route.ts**
   - Added imports for reminders helper and supabase
   - After email sent, calls `createQuoteFollowupReminders(quoteId, leadId)`

3. **app/dashboard/layout.tsx**
   - Added "Reminders" link to navigation menu

4. **package.json**
   - Twilio already included (^4.22.0) for optional SMS

## Database Schema

```sql
create table if not exists public.reminders (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads(id) on delete cascade,
  quote_id uuid references public.quotes(id) on delete cascade,
  booking_id uuid references public.bookings(id) on delete cascade,
  type text not null,
  status text default 'pending',
  scheduled_for timestamptz not null,
  sent_at timestamptz,
  created_at timestamptz default now()
);

create index if not exists reminders_status_scheduled_for_idx
  on public.reminders (status, scheduled_for);
create index if not exists reminders_quote_id_type_idx
  on public.reminders (quote_id, type);
create index if not exists reminders_booking_id_type_idx
  on public.reminders (booking_id, type);
create index if not exists reminders_lead_id_idx
  on public.reminders (lead_id);
```

## Reminder Types

### 1. Quote Follow-up Reminder

- **Trigger:** After quote email is sent successfully
- **Delay:** 24 hours
- **Subject:** "Reminder: Your Changing Keys Quote"
- **Content:** Polite reminder with quote amount and link to quote page

### 2. Payment Pending Reminder

- **Trigger:** After quote email is sent successfully
- **Delay:** 48 hours
- **Condition:** Only sends if quote status is still 'pending'
- **Subject:** "Payment Reminder - Your Changing Keys Quote"
- **Content:** Payment reminder with outstanding amount

### 3. Booking Reminder

- **Trigger:** After booking confirmation
- **Delay:** 1 day before moving date
- **Condition:** Only if moving_date is set
- **Subject:** "Moving Day Reminder - Changing Keys"
- **Content:** Details: moving date, pickup, dropoff, contact info

### 4. Review Request

- **Trigger:** After booking confirmation
- **Delay:** 1 day after moving date
- **Condition:** Only if moving_date is set
- **Subject:** "We'd Love Your Feedback - Changing Keys"
- **Content:** Request for feedback with email link

## Email Configuration

All reminder emails use the existing Gmail SMTP setup:

- From: `Changing Keys <bookings@changingkeys.co.uk>` (from QUOTE_FROM_EMAIL env var or default)
- SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS (existing environment variables)

## Safety Features

✓ **No Duplicate Reminders:** Checks if reminder already exists for quote/booking + type before creating
✓ **Paid Quote Filter:** Skips payment_pending reminders if quote is already paid
✓ **Missing Email Handling:** Logs and skips reminders without customer email
✓ **No Payment Flow Changes:** Reminders are created after, not affecting payment process
✓ **Graceful Error Handling:** Email errors don't crash the process, logged as "error"
✓ **Status Tracking:** All reminders marked as "sent" after successful email

## How to Test Manually

### 1. Run Reminders Processor (Manual)

```bash
curl -X POST http://localhost:3000/api/reminders/process
```

Response:

```json
{
  "message": "Reminders processed",
  "result": {
    "processed": 2,
    "errors": 0
  }
}
```

### 2. Test Quote Follow-up Reminders

1. Create a lead
2. Create a quote for the lead
3. Send quote email via dashboard
4. Wait 24 hours (or manually update `scheduled_for` in DB to past time for testing)
5. Call `/api/reminders/process`
6. Check customer email for reminder

### 3. Test Booking Reminders

1. Create a quote with a future moving_date
2. Mark quote as paid
3. Booking created automatically
4. Navigate to `/dashboard/reminders` to see scheduled reminders
5. Wait 1 day before moving date or update DB
6. Call `/api/reminders/process`

### 4. View Reminders Dashboard

Navigate to: `/dashboard/reminders`

- See all scheduled reminders
- Filter by status: pending, sent, cancelled
- View scheduled_for and sent_at timestamps

## Optional: Vercel Cron Configuration

If you want automatic processing, add to `next.config.ts`:

```typescript
export default {
  // ... existing config ...
  crons: [
    {
      path: "/api/reminders/process",
      schedule: "0 * * * *", // Every hour
    },
  ],
};
```

**Note:** This requires Vercel Pro plan and is optional. Manual testing works fine without it.

## Environment Variables Required

All existing environment variables continue to work:

- `SMTP_HOST` - Gmail SMTP server
- `SMTP_PORT` - SMTP port (465 for SSL)
- `SMTP_USER` - Gmail address
- `SMTP_PASS` - Gmail app password
- `QUOTE_FROM_EMAIL` - Sender email (or default is used)

**Optional (for SMS reminders, currently not in initial scope):**

- `TWILIO_ACCOUNT_SID` - Twilio account
- `TWILIO_AUTH_TOKEN` - Twilio token
- `TWILIO_FROM_NUMBER` - Twilio phone number

## Verification Checklist

✓ Build succeeds with no errors
✓ TypeScript type checking passes
✓ All routes compiled successfully:

- /api/reminders/process
- /dashboard/reminders
  ✓ Quote email sending creates reminders automatically
  ✓ Booking confirmation creates booking reminders
  ✓ Reminder processor finds and sends pending reminders
  ✓ Dashboard shows reminder list
  ✓ No breaking changes to existing payment flow
  ✓ No changes to quote sending logic (reminders created after)

## Database Migration Steps

1. Run the SQL from `supabase/reminders.sql` in Supabase:

   ```sql
   -- Copy entire content of supabase/reminders.sql
   ```

2. Or use Supabase dashboard:
   - SQL Editor
   - New Query
   - Paste content from `supabase/reminders.sql`
   - Execute

## Logs to Monitor

### Quote Sent

```
REMINDERS CREATED FOR QUOTE: { quoteId: '...', followupAt: '...', paymentAt: '...' }
```

### Booking Confirmed

```
REMINDERS CREATED FOR BOOKING: { bookingId: '...', reminderAt: '...', reviewAt: '...' }
```

### Processing

```
REMINDER FOUND: { id: '...', type: 'quote_followup', quoteId: '...', bookingId: null }
REMINDER EMAIL TO: customer@example.com
REMINDER EMAIL SENT: { messageId: '...', accepted: [...] }
```

### Errors

```
REMINDER EMAIL SKIPPED: missing quote or email
REMINDER SKIPPED: quote already paid
REMINDER EMAIL ERROR: { name, message, stack }
```

## What's NOT Included (Scope Limitation)

- SMS reminders (Twilio helper exists but not in email flow)
- Google Calendar integration skip (calendar sync happens separately)
- Automatic Vercel cron (optional, can be added later)
- Reminder customization UI (static templates only)

## Next Steps

1. Run `supabase/reminders.sql` to create reminders table
2. Deploy the code
3. Test manually via `/api/reminders/process`
4. (Optional) Configure Vercel cron for automatic hourly processing
5. Monitor logs for "REMINDER EMAIL SENT" messages
