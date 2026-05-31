"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function RemindersPage() {
  const [reminders, setReminders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  async function fetchReminders() {
    const { data, error } = await supabase
      .from("reminders")
      .select(
        `
        id,
        type,
        status,
        scheduled_for,
        sent_at,
        lead:lead_id(customer_name, customer_email)
      `
      )
      .order("scheduled_for", { ascending: false })
      .limit(100);

    if (error) {
      console.log("REMINDERS FETCH ERROR:", error);
    } else {
      setReminders(data || []);
    }

    setLoading(false);
  }

  useEffect(() => {
    fetchReminders();
  }, []);

  function formatDate(date: string) {
    return new Date(date).toLocaleString("en-GB");
  }

  function getReminderTypeLabel(type: string) {
    const labels: Record<string, string> = {
      quote_followup: "Quote Follow-up",
      payment_pending: "Payment Pending",
      booking_reminder: "Booking Reminder",
      review_request: "Review Request",
    };
    return labels[type] || type;
  }

  function getStatusColor(status: string) {
    switch (status) {
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      case "sent":
        return "bg-green-100 text-green-800";
      case "cancelled":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-slate-100 text-slate-800";
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-slate-900">Reminders & Follow-ups</h1>
        <p className="mt-2 text-slate-600">
          Manage scheduled customer follow-up reminders and notifications.
        </p>
      </div>

      <div className="rounded-2xl border bg-white shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center p-12">
            <p className="text-slate-500">Loading reminders...</p>
          </div>
        ) : reminders.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12">
            <h3 className="font-bold text-slate-900">No reminders scheduled</h3>
            <p className="mt-2 text-slate-500">
              Reminders will appear here when quotes are sent or bookings are created.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b bg-slate-50">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-900">
                    Customer
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-900">
                    Type
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-900">
                    Scheduled For
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-900">
                    Status
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-900">
                    Sent At
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {reminders.map((reminder) => {
                  const lead = reminder.lead as any;
                  return (
                    <tr key={reminder.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-medium text-slate-900">
                            {lead?.customer_name || "Unknown"}
                          </p>
                          <p className="text-sm text-slate-500">
                            {lead?.customer_email || "No email"}
                          </p>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-700">
                        {getReminderTypeLabel(reminder.type)}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-700">
                        {formatDate(reminder.scheduled_for)}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getStatusColor(
                            reminder.status
                          )}`}
                        >
                          {reminder.status.charAt(0).toUpperCase() +
                            reminder.status.slice(1)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-700">
                        {reminder.sent_at ? formatDate(reminder.sent_at) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
