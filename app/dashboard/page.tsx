"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function DashboardPage() {
  const [leadsCount, setLeadsCount] = useState(0);
  const [quotesCount, setQuotesCount] = useState(0);
  const [pendingQuotes, setPendingQuotes] = useState(0);
  const [bookingsCount, setBookingsCount] = useState(0);
  const [recentLeads, setRecentLeads] = useState<any[]>([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [latestNotifications, setLatestNotifications] = useState<any[]>([]);

  useEffect(() => {
    async function fetchDashboardData() {
      const { count: leads } = await supabase
        .from("leads")
        .select("*", { count: "exact", head: true });

      const { count: quotes } = await supabase
        .from("quotes")
        .select("*", { count: "exact", head: true });

      const { count: pending } = await supabase
        .from("quotes")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending");

      const { count: bookings } = await supabase
        .from("bookings")
        .select("*", { count: "exact", head: true });

      const { data: latestLeads } = await supabase
        .from("leads")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(5);

      const { count: unreadCount } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("is_read", false);

      const { data: notifications } = await supabase
        .from("notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(5);

      setLeadsCount(leads || 0);
      setQuotesCount(quotes || 0);
      setPendingQuotes(pending || 0);
      setBookingsCount(bookings || 0);
      setRecentLeads(latestLeads || []);
      setUnreadNotifications(unreadCount || 0);
      setLatestNotifications(notifications || []);
    }

    fetchDashboardData();
  }, []);

  const stats = [
    ["Total Leads", leadsCount, "All customer enquiries", "bg-yellow-50"],
    ["Quotes Sent", quotesCount, "Generated quotations", "bg-blue-50"],
    ["Unpaid Quotes", pendingQuotes, "Waiting for payment", "bg-orange-50"],
    ["Bookings", bookingsCount, "Confirmed removals", "bg-emerald-50"],
  ];

  return (
    <div>
      <div className="rounded-3xl border bg-white p-8 shadow-sm">
       <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
         <h1 className="text-3xl font-bold text-slate-900">
            Welcome back
          </h1>

          <p className="mt-2 max-w-3xl text-slate-500">
            Manage leads, quotations, customer payments, and confirmed removals from one central dashboard.
          </p>
        </div>

        <div className="rounded-2xl border bg-emerald-50 px-5 py-4 text-emerald-800">
          <p className="text-sm font-semibold">Unread notifications</p>
          <p className="mt-1 text-3xl font-bold">{unreadNotifications}</p>
        </div>
       </div>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
        {stats.map(([title, value, desc, bg]) => (
          <div
            key={title}
            className={`rounded-2xl border p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg ${bg}`}
          >
            <p className="text-sm font-semibold text-slate-500">{title}</p>

            <h2 className="mt-4 text-4xl font-bold text-slate-900">
              {value}
            </h2>

            <p className="mt-2 text-sm text-slate-500">{desc}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 rounded-2xl border bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Notifications</h2>
            <p className="mt-1 text-sm text-slate-500">
              Latest lead alerts from automations and API submissions.
            </p>
          </div>
        </div>

        <div className="mt-6 space-y-3">
          {latestNotifications.length === 0 ? (
            <div className="rounded-xl border border-dashed p-6 text-center">
              <h3 className="font-bold text-slate-900">No notifications</h3>
              <p className="mt-1 text-sm text-slate-500">
                New lead notifications will appear here.
              </p>
            </div>
          ) : (
            latestNotifications.map((notification) => (
              <a
                key={notification.id}
                href={
                  notification.lead_id
                    ? `/dashboard/leads/${notification.lead_id}`
                    : "/dashboard/leads"
                }
                className="block rounded-xl border p-4 hover:bg-slate-50"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-bold text-slate-900">
                      {notification.title}
                    </h3>

                    <p className="mt-1 text-slate-600">
                      {notification.message}
                    </p>
                  </div>

                  {!notification.is_read && (
                    <span className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-700">
                      New
                    </span>
                  )}
                </div>
              </a>
            ))
          )}
        </div>
      </div>

      <div className="mt-8 rounded-2xl border bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Recent Leads</h2>
            <p className="mt-1 text-sm text-slate-500">
              Latest customer enquiries received in the system.
            </p>
          </div>

          <a
            href="/dashboard/leads"
            className="rounded-xl border px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            View All
          </a>
        </div>

        <div className="mt-6 space-y-4">
          {recentLeads.length === 0 ? (
            <div className="rounded-xl border border-dashed p-8 text-center">
              <h3 className="font-bold text-slate-900">No recent leads</h3>
              <p className="mt-1 text-sm text-slate-500">
                New customer leads will appear here.
              </p>
            </div>
          ) : (
            recentLeads.map((lead) => (
              <a
                key={lead.id}
                href={`/dashboard/leads/${lead.id}`}
                className="block rounded-xl border p-4 hover:bg-slate-50"
              >
                <h3 className="font-bold text-slate-900">
                  {lead.customer_name}
                </h3>

                <p className="mt-1 text-slate-600">
                  {lead.pickup_address} → {lead.dropoff_address}
                </p>

                <span
                  className={`mt-3 inline-block rounded-full px-3 py-1 text-sm ${
                    lead.status === "quoted"
                      ? "bg-blue-100 text-blue-700"
                      : lead.status === "paid" || lead.status === "booked"
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-yellow-100 text-yellow-700"
                  }`}
                >
                  {lead.status || "new"}
                </span>
              </a>
            ))
          )}
        </div>
      </div>

      <div className="mt-8 rounded-2xl border bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold text-slate-900">Lead Workflow</h2>

        <p className="mt-1 text-slate-500">
          Current automation flow from enquiry to confirmed booking.
        </p>

        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-5">
          {["Received", "Review", "Quoted", "Payment Due", "Booked"].map(
            (item, index) => (
              <div key={item} className={`rounded-xl border p-4 ${
              item === "Received"
              ? "bg-yellow-50"
              : item === "Review"
              ? "bg-orange-50"
              : item === "Quoted"
              ? "bg-blue-50"
              : item === "Payment Due"
              ? "bg-purple-50"
              : "bg-emerald-50"
              }`}>
                <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-sm font-bold text-white">
                  {index + 1}
                </div>

                <p className="font-semibold text-slate-700">{item}</p>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
