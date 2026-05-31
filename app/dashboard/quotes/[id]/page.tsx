"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import toast from "react-hot-toast";
import { supabase } from "@/lib/supabase";

export default function QuoteDetailPage() {
  const params = useParams();

  const [quote, setQuote] = useState<any>(null);
  const [lead, setLead] = useState<any>(null);

  const [isMarkingPaid, setIsMarkingPaid] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [isCreatingCheckout, setIsCreatingCheckout] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [price, setPrice] = useState("");
  const [status, setStatus] = useState("");

  async function fetchQuote() {
    const { data, error } = await supabase
      .from("quotes")
      .select("*")
      .eq("id", params.id)
      .single();

    if (error) {
      toast.error("Failed to load quote");
      console.log(error);
      return;
    }

    setQuote(data);
    setPrice(String(data.price || ""));
    setStatus(data.status || "pending");

    const { data: leadData } = await supabase
      .from("leads")
      .select("*")
      .eq("id", data.lead_id)
      .single();

    setLead(leadData);
  }

  useEffect(() => {
    async function initializePage() {
      await fetchQuote();

      const url = new URL(window.location.href);
      const paid = url.searchParams.get("paid");

      if (paid === "true") {
        const { data: existingQuote } = await supabase
          .from("quotes")
          .select("*")
          .eq("id", params.id)
          .single();

        if (existingQuote && existingQuote.status !== "paid") {
          const response = await fetch("/api/bookings/confirm", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              quoteId: params.id,
              paymentMethod: "Card (Stripe)",
            }),
          });

          const data = await response.json().catch(() => null);

          if (!response.ok) {
            console.log("BOOKING CONFIRMATION ERROR:", data);
            toast.error(
              "Payment succeeded, but booking confirmation could not be finalised"
            );
          } else {
            toast.success("Payment successful");
          }

          fetchQuote();
        }
      }
    }

    initializePage();
  }, [params.id]);

  async function updateQuote() {
    if (isSaving) return;

    if (!price || Number(price) <= 0) {
      toast.error("Please enter valid quote price");
      return;
    }

    setIsSaving(true);

    const { error } = await supabase
      .from("quotes")
      .update({
        price: Number(price),
        status,
      })
      .eq("id", params.id);

    if (error) {
      toast.error("Failed to update quote");
      console.log(error);
    } else {
      if (lead?.id) {
        await supabase
          .from("leads")
          .update({
            status: status === "paid" ? "paid" : "quoted",
          })
          .eq("id", lead.id);
      }

      toast.success("Quote updated successfully");
      setIsEditing(false);
      fetchQuote();
    }

    setIsSaving(false);
  }

  async function markPaid() {
    if (quote.status === "paid") {
      toast.error("This quote is already paid");
      return;
    }

    setIsMarkingPaid(true);

    try {
      const response = await fetch("/api/bookings/confirm", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          quoteId: quote.id,
          paymentMethod: "Manual bank transfer",
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        console.log("BOOKING CONFIRMATION ERROR:", data);
        toast.error("Error marking quote as paid");
      } else {
        toast.success("Quote marked as paid and booking created");
        fetchQuote();
      }
    } catch (error) {
      console.log("BOOKING CONFIRMATION NETWORK ERROR:", error);
      toast.error("Error marking quote as paid");
    }

    setIsMarkingPaid(false);
  }

  async function sendQuoteEmail() {
    if (!lead?.customer_email) {
      toast.error("Customer email not found");
      return;
    }

    setIsSendingEmail(true);

    try {
      const response = await fetch("/api/send-quote", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          quoteId: quote.id,
          customerEmail: lead.customer_email,
          customerName: lead.customer_name,
          quotePrice: quote.price,
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        console.log("SEND_QUOTE_API_ERROR:", {
          status: response.status,
          data,
        });

        throw new Error(data?.error || "Failed to send quote email");
      }

      toast.success("Quote email sent successfully");
    } catch (error) {
      console.log("SEND_QUOTE_FRONTEND_ERROR:", error);
      toast.error("Failed to send email");
    }

    setIsSendingEmail(false);
  }

  async function startCheckout() {
    if (!lead?.customer_email) {
      toast.error("Customer email not found");
      return;
    }

    setIsCreatingCheckout(true);

    try {
      const response = await fetch("/api/create-checkout-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          quoteId: quote.id,
          customerEmail: lead.customer_email,
          customerName: lead.customer_name,
          quotePrice: quote.price,
        }),
      });

      const data = await response.json();

      if (!data.url) throw new Error("No checkout URL");

      window.location.href = data.url;
    } catch (error) {
      console.log(error);
      toast.error("Failed to start payment");
    }

    setIsCreatingCheckout(false);
  }

  if (!quote) return <p className="text-slate-600">Loading quote...</p>;

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 print:hidden sm:flex-row">
       <a
       href={`/dashboard/quotes/${quote.id}/pdf`}
        target="_blank"
       className="rounded-xl bg-emerald-600 px-6 py-3 font-semibold text-white hover:bg-emerald-700 inline-flex items-center justify-center"
       >
       Download PDF
       </a>
        <button
          onClick={() => setIsEditing((prev) => !prev)}
          className="rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-700"
        >
          {isEditing ? "Cancel Edit" : "Edit Quote"}
        </button>

        <button
          onClick={startCheckout}
          disabled={isCreatingCheckout || quote.status === "paid"}
          className={`rounded-xl px-6 py-3 font-semibold text-white ${
            isCreatingCheckout || quote.status === "paid"
              ? "cursor-not-allowed bg-slate-400"
              : "bg-emerald-700 hover:bg-emerald-800"
          }`}
        >
          {isCreatingCheckout
            ? "Redirecting..."
            : quote.status === "paid"
            ? "Paid"
            : "Pay Online"}
        </button>

        <button
          onClick={sendQuoteEmail}
          disabled={isSendingEmail}
          className={`rounded-xl px-6 py-3 font-semibold text-white ${
            isSendingEmail
              ? "cursor-not-allowed bg-slate-400"
              : "bg-purple-600 hover:bg-purple-700"
          }`}
        >
          {isSendingEmail ? "Sending..." : "Send Email"}
        </button>

        <button
          onClick={markPaid}
          disabled={quote.status === "paid" || isMarkingPaid}
          className={`rounded-xl px-6 py-3 font-semibold text-white ${
            quote.status === "paid" || isMarkingPaid
              ? "cursor-not-allowed bg-slate-400"
              : "bg-slate-900 hover:bg-slate-800"
          }`}
        >
          {isMarkingPaid
            ? "Marking..."
            : quote.status === "paid"
            ? "Already Paid"
            : "Mark Paid"}
        </button>
      </div>

      {isEditing && (
        <div className="mb-6 rounded-2xl border bg-white p-6 shadow-sm print:hidden">
          <h2 className="text-xl font-bold text-slate-900">Edit Quote</h2>

          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Quote Price (£)
              </label>

              <input
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
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
                <option value="pending">Pending</option>
                <option value="paid">Paid</option>
              </select>
            </div>
          </div>

          <button
            onClick={updateQuote}
            disabled={isSaving}
            className={`mt-5 rounded-xl px-6 py-3 font-semibold text-white ${
              isSaving
                ? "cursor-not-allowed bg-slate-400"
                : "bg-emerald-600 hover:bg-emerald-700"
            }`}
          >
            {isSaving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      )}

      <div className="rounded-2xl border bg-white p-6 shadow-sm print:border-0 print:p-0 print:shadow-none lg:p-10">
        <div className="flex flex-col gap-6 border-b pb-6 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-4xl font-bold text-emerald-700">
              Changing Keys
            </h1>

            <p className="mt-1 text-slate-500">
              Professional Removal Quotation
            </p>
          </div>

          <div className="sm:text-right">
            <h2 className="text-2xl font-bold text-slate-900">QUOTE</h2>
            <p className="text-sm text-slate-500">
              Quote ID: {quote.id.slice(0, 8)}
            </p>
          </div>
        </div>

        <div className="mt-8 grid gap-8 lg:grid-cols-2">
          <div className="rounded-2xl border bg-slate-50 p-6">
            <h3 className="text-lg font-bold text-slate-900">
              Customer Details
            </h3>

            <p className="mt-3 text-slate-700">
              Name: {lead?.customer_name || "Not added"}
            </p>

            <p className="text-slate-700">
              Email: {lead?.customer_email || "Not added"}
            </p>

            <p className="text-slate-700">
              Phone: {lead?.customer_phone || "Not added"}
            </p>
          </div>

          <div className="rounded-2xl border bg-slate-50 p-6">
            <h3 className="text-lg font-bold text-slate-900">Move Details</h3>

            <p className="mt-3 text-slate-700">
              Pickup: {lead?.pickup_address || "Not added"}
            </p>

            <p className="text-slate-700">
              Dropoff: {lead?.dropoff_address || "Not added"}
            </p>

            <p className="text-slate-700">
              Moving Date: {lead?.moving_date || "Not added"}
            </p>
          </div>
        </div>

        <div className="mt-10 rounded-2xl bg-emerald-50 p-8">
          <p className="text-sm font-semibold text-emerald-700">
            Total Quote Price
          </p>

          <h2 className="mt-2 text-5xl font-bold text-emerald-800">
            £{quote.price}
          </h2>
        </div>

        <div className="mt-8">
          <h3 className="text-lg font-bold text-slate-900">Status</h3>

          <span
            className={`mt-3 inline-block rounded-full px-4 py-2 text-sm ${
              quote.status === "paid"
                ? "bg-emerald-100 text-emerald-700"
                : "bg-yellow-100 text-yellow-700"
            }`}
          >
            {quote.status || "pending"}
          </span>
        </div>

        <div className="mt-10 border-t pt-6 text-sm text-slate-500">
          <p>Thank you for choosing Changing Keys.</p>
          <p>This quotation is generated automatically from the dashboard.</p>
        </div>
      </div>
    </div>
  );
}
