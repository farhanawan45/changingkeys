"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { supabase } from "@/lib/supabase";

export default function NewQuotePage() {
  const router = useRouter();

  const [leads, setLeads] = useState<any[]>([]);
  const [leadId, setLeadId] = useState("");

  const [hours, setHours] = useState("");
  const [miles, setMiles] = useState("");
  const [items, setItems] = useState("");

  const [hourlyRate, setHourlyRate] = useState(0);
  const [mileRate, setMileRate] = useState(0);
  const [itemRate] = useState(5);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    async function fetchData() {
      const { data: leadsData } = await supabase
        .from("leads")
        .select("*")
        .order("created_at", { ascending: false });

      const { data: settingsData } = await supabase
        .from("settings")
        .select("*")
        .limit(1)
        .single();

      setLeads(leadsData || []);
      setHourlyRate(settingsData?.hourly_rate || 0);
      setMileRate(settingsData?.mile_rate || 0);
    }

    fetchData();
  }, []);

  const calculatedPrice =
    Number(hours) * hourlyRate +
    Number(miles) * mileRate +
    Number(items) * itemRate;

  async function createQuote() {
    if (isSaving) return;

    if (!leadId || calculatedPrice <= 0) {
      toast.error("Please select a lead and enter job details");
      return;
    }

    setIsSaving(true);

    const { error } = await supabase.from("quotes").insert([
      {
        lead_id: leadId,
        price: calculatedPrice,
        status: "pending",
      },
    ]);

    if (error) {
      toast.error("Error creating quote");
      console.log(error);
      setIsSaving(false);
    } else {
      await supabase
        .from("leads")
        .update({ status: "quoted" })
        .eq("id", leadId);

      toast.success("Quote created successfully");
      router.push("/dashboard/quotes");
    }
  }

  return (
    <div>
      <div className="rounded-3xl border bg-white p-8 shadow-sm">
        <h1 className="text-3xl font-bold text-slate-900">
          Create Quote
        </h1>

        <p className="mt-2 text-slate-500">
          Select a lead and generate a calculated customer quotation.
        </p>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border bg-white p-6 shadow-sm lg:col-span-2">
          <h2 className="text-xl font-bold text-slate-900">
            Quote Details
          </h2>

          <div className="mt-6 space-y-5">
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Customer Lead
              </label>

              <select
                value={leadId}
                onChange={(e) => setLeadId(e.target.value)}
                className="w-full rounded-xl border p-4 text-slate-900 outline-none focus:border-emerald-500"
              >
                <option value="">Select Lead</option>

                {leads.map((lead) => (
                  <option key={lead.id} value={lead.id}>
                    {lead.customer_name} — {lead.pickup_address} to{" "}
                    {lead.dropoff_address}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-5 md:grid-cols-3">
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Estimated Hours
                </label>

                <input
                  type="number"
                  placeholder="0"
                  value={hours}
                  onChange={(e) => setHours(e.target.value)}
                  className="w-full rounded-xl border p-4 text-slate-900 outline-none placeholder:text-slate-400 focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Distance Miles
                </label>

                <input
                  type="number"
                  placeholder="0"
                  value={miles}
                  onChange={(e) => setMiles(e.target.value)}
                  className="w-full rounded-xl border p-4 text-slate-900 outline-none placeholder:text-slate-400 focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Number of Items
                </label>

                <input
                  type="number"
                  placeholder="0"
                  value={items}
                  onChange={(e) => setItems(e.target.value)}
                  className="w-full rounded-xl border p-4 text-slate-900 outline-none placeholder:text-slate-400 focus:border-emerald-500"
                />
              </div>
            </div>

            <button
              onClick={createQuote}
              disabled={isSaving}
              className={`rounded-xl px-6 py-3 font-semibold text-white ${
                isSaving
                  ? "cursor-not-allowed bg-slate-400"
                  : "bg-emerald-600 hover:bg-emerald-700"
              }`}
            >
              {isSaving ? "Saving..." : "Save Quote"}
            </button>
          </div>
        </div>

        <div className="rounded-2xl border bg-emerald-50 p-6 shadow-sm">
          <p className="text-sm font-semibold text-emerald-700">
            Calculated Price
          </p>

          <h2 className="mt-3 text-4xl font-bold text-emerald-800">
            £{calculatedPrice}
          </h2>

          <div className="mt-6 space-y-3 text-sm text-emerald-800">
            <p>Hourly rate: £{hourlyRate}</p>
            <p>Mile rate: £{mileRate}</p>
            <p>Item rate: £{itemRate}</p>
          </div>
        </div>
      </div>
    </div>
  );
}