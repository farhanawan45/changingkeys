"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import toast from "react-hot-toast";
import { supabase } from "@/lib/supabase";

export default function LeadDetailPage() {
  const params = useParams();

  const [lead, setLead] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [pickupAddress, setPickupAddress] = useState("");
  const [dropoffAddress, setDropoffAddress] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    fetchLead();
  }, [params.id]);

  async function fetchLead() {
    const { data, error } = await supabase
      .from("leads")
      .select("*")
      .eq("id", params.id)
      .single();

    if (error) {
      console.log(error);
      toast.error("Failed to load lead");
      return;
    }

    setLead(data);
    setCustomerName(data.customer_name || "");
    setCustomerEmail(data.customer_email || "");
    setCustomerPhone(data.customer_phone || "");
    setPickupAddress(data.pickup_address || "");
    setDropoffAddress(data.dropoff_address || "");
    setStatus(data.status || "new");
  }

  async function updateLead() {
    if (isSaving) return;

    if (!customerName || !customerEmail || !pickupAddress || !dropoffAddress) {
      toast.error("Please fill required fields");
      return;
    }

    setIsSaving(true);

    const { error } = await supabase
      .from("leads")
      .update({
        customer_name: customerName,
        customer_email: customerEmail,
        customer_phone: customerPhone,
        pickup_address: pickupAddress,
        dropoff_address: dropoffAddress,
        status,
      })
      .eq("id", params.id);

    if (error) {
      toast.error("Failed to update lead");
      console.log(error);
    } else {
      toast.success("Lead updated successfully");
      setIsEditing(false);
      fetchLead();
    }

    setIsSaving(false);
  }

  if (!lead) {
    return <p className="text-slate-600">Loading lead...</p>;
  }

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">
            {lead.customer_name}
          </h1>

          <p className="mt-1 text-slate-500">
            Lead ID: {lead.id.slice(0, 8)}
          </p>
        </div>

        <button
          onClick={() => setIsEditing((prev) => !prev)}
          className="rounded-xl bg-slate-900 px-5 py-3 font-semibold text-white hover:bg-slate-800"
        >
          {isEditing ? "Cancel Edit" : "Edit Lead"}
        </button>
      </div>

      <div className="mt-8 rounded-2xl border bg-white p-8 shadow-sm">
        {isEditing ? (
          <div className="space-y-5">
            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Customer Name
                </label>

                <input
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full rounded-xl border p-4 text-slate-900 outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Customer Email
                </label>

                <input
                  type="email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  className="w-full rounded-xl border p-4 text-slate-900 outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Customer Phone
              </label>

              <input
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                className="w-full rounded-xl border p-4 text-slate-900 outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Pickup Address
              </label>

              <input
                value={pickupAddress}
                onChange={(e) => setPickupAddress(e.target.value)}
                className="w-full rounded-xl border p-4 text-slate-900 outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Dropoff Address
              </label>

              <input
                value={dropoffAddress}
                onChange={(e) => setDropoffAddress(e.target.value)}
                className="w-full rounded-xl border p-4 text-slate-900 outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Status
              </label>

              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full rounded-xl border p-4 text-slate-900 outline-none focus:border-emerald-500"
              >
                <option value="new">New</option>
                <option value="quoted">Quoted</option>
                <option value="paid">Paid</option>
              </select>
            </div>

            <button
              onClick={updateLead}
              disabled={isSaving}
              className={`rounded-xl px-6 py-3 font-semibold text-white ${
                isSaving
                  ? "cursor-not-allowed bg-slate-400"
                  : "bg-emerald-600 hover:bg-emerald-700"
              }`}
            >
              {isSaving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-slate-700">
              Email: {lead.customer_email}
            </p>

            <p className="text-slate-700">
              Phone: {lead.customer_phone || "Not added"}
            </p>

            <p className="text-slate-700">
              Pickup: {lead.pickup_address}
            </p>

            <p className="text-slate-700">
              Dropoff: {lead.dropoff_address}
            </p>

            <p className="text-slate-700">
              Status: {lead.status}
            </p>

            <a
              href={`/dashboard/quotes/new?leadId=${lead.id}`}
              className="mt-6 inline-block rounded-xl bg-emerald-600 px-6 py-3 text-white hover:bg-emerald-700"
            >
              Create Quote
            </a>
          </div>
        )}
      </div>
    </div>
  );
}