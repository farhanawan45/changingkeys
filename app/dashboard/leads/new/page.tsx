"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { supabase } from "@/lib/supabase";

export default function NewLeadPage() {
  const router = useRouter();

  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [pickupAddress, setPickupAddress] = useState("");
  const [dropoffAddress, setDropoffAddress] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  async function createLead(e: any) {
    e.preventDefault();

    if (isSaving) return;

    if (!customerName || !customerEmail || !pickupAddress || !dropoffAddress) {
      toast.error("Please fill all fields");
      return;
    }

    setIsSaving(true);

    const { error } = await supabase.from("leads").insert([
      {
        customer_name: customerName,
        customer_email: customerEmail,
        pickup_address: pickupAddress,
        dropoff_address: dropoffAddress,
        status: "new",
      },
    ]);

    if (error) {
      toast.error("Error creating lead");
      console.log(error);
      setIsSaving(false);
    } else {
      toast.success("Lead created successfully");
      router.push("/dashboard/leads");
    }
  }

  return (
    <div>
      <div className="rounded-3xl border bg-white p-8 shadow-sm">
        <h1 className="text-3xl font-bold text-slate-900">
          Add New Lead
        </h1>

        <p className="mt-2 text-slate-500">
          Create a new customer enquiry for quotation and booking.
        </p>
      </div>

      <form
        onSubmit={createLead}
        className="mt-8 rounded-2xl border bg-white p-6 shadow-sm"
      >
        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              Customer Name
            </label>

            <input
              type="text"
              placeholder="John Smith"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="w-full rounded-xl border p-4 text-slate-900 outline-none placeholder:text-slate-400 focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              Customer Email
            </label>

            <input
              type="email"
              placeholder="john@example.com"
              value={customerEmail}
              onChange={(e) => setCustomerEmail(e.target.value)}
              className="w-full rounded-xl border p-4 text-slate-900 outline-none placeholder:text-slate-400 focus:border-emerald-500"
            />
          </div>
        </div>

        <div className="mt-5 grid gap-5">
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              Pickup Address
            </label>

            <input
              type="text"
              placeholder="Pickup location"
              value={pickupAddress}
              onChange={(e) => setPickupAddress(e.target.value)}
              className="w-full rounded-xl border p-4 text-slate-900 outline-none placeholder:text-slate-400 focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              Dropoff Address
            </label>

            <input
              type="text"
              placeholder="Dropoff location"
              value={dropoffAddress}
              onChange={(e) => setDropoffAddress(e.target.value)}
              className="w-full rounded-xl border p-4 text-slate-900 outline-none placeholder:text-slate-400 focus:border-emerald-500"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={isSaving}
          className={`mt-6 rounded-xl px-6 py-3 font-semibold text-white ${
            isSaving
              ? "cursor-not-allowed bg-slate-400"
              : "bg-emerald-600 hover:bg-emerald-700"
          }`}
        >
          {isSaving ? "Creating..." : "Create Lead"}
        </button>
      </form>
    </div>
  );
}