"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { supabase } from "@/lib/supabase";

export default function QuotesPage() {
  const [quotes, setQuotes] = useState<any[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    fetchQuotes();
  }, []);

  async function fetchQuotes() {
    const { data, error } = await supabase
      .from("quotes")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.log(error);
    } else {
      setQuotes(data || []);
    }
  }

  async function deleteQuote(id: string) {
    setDeletingId(id);

    const { error: bookingsError } = await supabase
      .from("bookings")
      .delete()
      .eq("quote_id", id);

    if (bookingsError) {
      toast.error("Failed to delete related booking");
      console.log(bookingsError);
      setDeletingId(null);
      return;
    }

    const { error } = await supabase
      .from("quotes")
      .delete()
      .eq("id", id);

    if (error) {
      toast.error("Failed to delete quote");
      console.log(error);
    } else {
      toast.success("Quote deleted successfully");
      setQuotes((prev) => prev.filter((quote) => quote.id !== id));
    }

    setDeletingId(null);
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">
            Quotes
          </h1>

          <p className="mt-2 text-slate-500">
            All generated customer quotations.
          </p>
        </div>

        <a
          href="/dashboard/quotes/new"
          className="rounded-xl bg-emerald-600 px-5 py-3 text-white hover:bg-emerald-700"
        >
          Create Quote
        </a>
      </div>

      <div className="mt-8 rounded-2xl border bg-white shadow-sm">
        {quotes.length === 0 ? (
          <div className="p-12 text-center">
            <h2 className="text-2xl font-bold text-slate-900">
              No Quotes Yet
            </h2>

            <p className="mt-2 text-slate-500">
              Create your first quotation to get started.
            </p>

            <a
              href="/dashboard/quotes/new"
              className="mt-6 inline-block rounded-xl bg-emerald-600 px-5 py-3 text-white hover:bg-emerald-700"
            >
              Create First Quote
            </a>
          </div>
        ) : (
          quotes.map((quote) => (
            <div
              key={quote.id}
              className="border-b p-6 last:border-b-0"
            >
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <a
                  href={`/dashboard/quotes/${quote.id}`}
                  className="block flex-1"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h2 className="text-2xl font-bold text-slate-900">
                        £{quote.price}
                      </h2>

                      <p className="mt-2 text-slate-600">
                        Lead ID: {quote.lead_id}
                      </p>

                      <p className="mt-1 text-sm text-slate-500">
                        Quote ID: {quote.id.slice(0, 8)}
                      </p>
                    </div>

                    <span
                      className={`rounded-full px-3 py-1 text-sm ${
                        quote.status === "paid"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-yellow-100 text-yellow-700"
                      }`}
                    >
                      {quote.status || "pending"}
                    </span>
                  </div>
                </a>

                <div className="flex items-center gap-3">
                  <a
                    href={`/dashboard/quotes/${quote.id}`}
                    className="rounded-xl border px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                  >
                    View
                  </a>

                  <button
                    onClick={() => deleteQuote(quote.id)}
                    disabled={deletingId === quote.id}
                    className="rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {deletingId === quote.id ? "Deleting..." : "Delete"}
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