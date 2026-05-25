"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { supabase } from "@/lib/supabase";

export default function SettingsPage() {
  const [companyName, setCompanyName] = useState("");
  const [hourlyRate, setHourlyRate] = useState("");
  const [mileRate, setMileRate] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    async function fetchSettings() {
      const { data } = await supabase
        .from("settings")
        .select("*")
        .limit(1)
        .single();

      if (data) {
        setCompanyName(data.company_name || "");
        setHourlyRate(data.hourly_rate || "");
        setMileRate(data.mile_rate || "");
      }
    }

    fetchSettings();
  }, []);

  async function saveSettings() {
    if (isSaving) return;

    if (!companyName || !hourlyRate || !mileRate) {
      toast.error("Please fill all settings fields");
      return;
    }

    setIsSaving(true);

    const { error } = await supabase.from("settings").upsert([
      {
        id: "11111111-1111-1111-1111-111111111111",
        company_name: companyName,
        hourly_rate: Number(hourlyRate),
        mile_rate: Number(mileRate),
      },
    ]);

    if (error) {
      toast.error("Error saving settings");
      console.log(error);
    } else {
      toast.success("Settings saved successfully");
    }

    setIsSaving(false);
  }

  return (
    <div>
      <div className="rounded-3xl border bg-white p-8 shadow-sm">
        <h1 className="text-3xl font-bold text-slate-900">Settings</h1>

        <p className="mt-2 text-slate-500">
          Manage company details and quotation pricing rules.
        </p>
      </div>

      <div className="mt-8 rounded-2xl border bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold text-slate-900">
          Pricing Settings
        </h2>

        <p className="mt-1 text-sm text-slate-500">
          These values are used when creating customer quotations.
        </p>

        <div className="mt-6 space-y-5">
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              Company Name
            </label>

            <input
              type="text"
              placeholder="Changing Keys"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className="w-full rounded-xl border p-4 text-slate-900 outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              Hourly Rate (£)
            </label>

            <input
              type="number"
              placeholder="60"
              value={hourlyRate}
              onChange={(e) => setHourlyRate(e.target.value)}
              className="w-full rounded-xl border p-4 text-slate-900 outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              Per Mile Rate (£)
            </label>

            <input
              type="number"
              placeholder="2"
              value={mileRate}
              onChange={(e) => setMileRate(e.target.value)}
              className="w-full rounded-xl border p-4 text-slate-900 outline-none focus:border-emerald-500"
            />
          </div>

          <button
            onClick={saveSettings}
            disabled={isSaving}
            className={`rounded-xl px-6 py-3 font-semibold text-white ${
              isSaving
                ? "cursor-not-allowed bg-slate-400"
                : "bg-emerald-600 hover:bg-emerald-700"
            }`}
          >
            {isSaving ? "Saving..." : "Save Settings"}
          </button>
        </div>
      </div>
    </div>
  );
}