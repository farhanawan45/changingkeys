"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { supabase } from "@/lib/supabase";

export default function LeadsPage() {
  const [leads, setLeads] = useState<any[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    fetchLeads();
  }, []);

  async function fetchLeads() {
    const { data, error } = await supabase
      .from("leads")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.log(error);
    } else {
      setLeads(data || []);
    }
  }

  async function deleteLead(id: string) {
    const confirmed = confirm(
      "Are you sure you want to delete this lead? Related quotes and bookings will also be deleted."
    );

    if (!confirmed) return;

    setDeletingId(id);

    const { error: bookingsError } = await supabase
      .from("bookings")
      .delete()
      .eq("lead_id", id);

    if (bookingsError) {
      toast.error("Failed to delete related bookings");
      console.log(bookingsError);
      setDeletingId(null);
      return;
    }

    const { error: quotesError } = await supabase
      .from("quotes")
      .delete()
      .eq("lead_id", id);

    if (quotesError) {
      toast.error("Failed to delete related quotes");
      console.log(quotesError);
      setDeletingId(null);
      return;
    }

    const { error } = await supabase
      .from("leads")
      .delete()
      .eq("id", id);

    if (error) {
      toast.error("Failed to delete lead");
      console.log(error);
    } else {
      toast.success("Lead deleted successfully");

      setLeads((prev) => prev.filter((lead) => lead.id !== id));
    }

    setDeletingId(null);
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">
            Leads
          </h1>

          <p className="mt-2 text-slate-500">
            All customer leads from Supabase.
          </p>
        </div>

        <a
          href="/dashboard/leads/new"
          className="rounded-xl bg-emerald-600 px-5 py-3 text-white hover:bg-emerald-700"
        >
          Add New Lead
        </a>
      </div>

      <div className="mt-8 rounded-2xl border bg-white shadow-sm">
        {leads.length === 0 ? (
          <div className="p-12 text-center">
            <h2 className="text-2xl font-bold text-slate-900">
              No Leads Yet
            </h2>

            <p className="mt-2 text-slate-500">
              Add your first customer lead to get started.
            </p>

            <a
              href="/dashboard/leads/new"
              className="mt-6 inline-block rounded-xl bg-emerald-600 px-5 py-3 text-white hover:bg-emerald-700"
            >
              Add First Lead
            </a>
          </div>
        ) : (
          leads.map((lead) => (
            <div
              key={lead.id}
              className="border-b p-6 last:border-b-0"
            >
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <a
                  href={`/dashboard/leads/${lead.id}`}
                  className="block flex-1"
                >
                  <h2 className="text-xl font-bold text-slate-900">
                    {lead.customer_name}
                  </h2>

                  <p className="text-slate-600">
                    {lead.customer_email}
                  </p>

                  <p className="mt-1 text-sm text-slate-500">
                    Lead ID: {lead.id.slice(0, 8)}
                  </p>

                  <p className="mt-3 text-slate-600">
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

                <div className="flex items-center gap-3">
                  <a
                    href={`/dashboard/leads/${lead.id}`}
                    className="rounded-xl border px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                  >
                    View
                  </a>

                  <button
                    onClick={() => deleteLead(lead.id)}
                    disabled={deletingId === lead.id}
                    className="rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {deletingId === lead.id ? "Deleting..." : "Delete"}
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
