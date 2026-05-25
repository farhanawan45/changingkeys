"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function SearchPage() {
  const searchParams = useSearchParams();
  const query = searchParams.get("q") || "";

  const [leads, setLeads] = useState<any[]>([]);
  const [quotes, setQuotes] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function runSearch() {
      if (!query.trim()) {
        setLoading(false);
        return;
      }

      setLoading(true);

      const [leadsResult, quotesResult, bookingsResult] = await Promise.all([
        supabase
          .from("leads")
          .select("*")
          .or(
            `customer_name.ilike.%${query}%,customer_email.ilike.%${query}%,pickup_address.ilike.%${query}%,dropoff_address.ilike.%${query}%`
          )
          .order("created_at", { ascending: false }),

        supabase
          .from("quotes")
          .select("*")
          .or(
            `customer_name.ilike.%${query}%,customer_email.ilike.%${query}%,pickup_address.ilike.%${query}%,dropoff_address.ilike.%${query}%,status.ilike.%${query}%`
          )
          .order("created_at", { ascending: false }),

        supabase
          .from("bookings")
          .select("*")
          .or(
            `customer_name.ilike.%${query}%,customer_email.ilike.%${query}%,pickup_address.ilike.%${query}%,dropoff_address.ilike.%${query}%`
          )
          .order("created_at", { ascending: false }),
      ]);

      setLeads(leadsResult.data || []);
      setQuotes(quotesResult.data || []);
      setBookings(bookingsResult.data || []);
      setLoading(false);
    }

    runSearch();
  }, [query]);

  const totalResults = leads.length + quotes.length + bookings.length;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold text-slate-900">Search Results</h2>
        <p className="mt-1 text-slate-500">
          Results for: <span className="font-semibold text-slate-700">{query}</span>
        </p>
      </div>

      {loading ? (
        <div className="rounded-2xl border bg-white p-8 text-center text-slate-500">
          Searching...
        </div>
      ) : totalResults === 0 ? (
        <div className="rounded-2xl border bg-white p-8 text-center">
          <h3 className="text-lg font-semibold text-slate-900">
            No results found
          </h3>
          <p className="mt-1 text-slate-500">
            Is search query se koi lead, quote ya booking nahi mili.
          </p>
        </div>
      ) : (
        <>
          <SearchSection title="Leads" items={leads} baseUrl="/dashboard/leads" />
          <SearchSection title="Quotes" items={quotes} baseUrl="/dashboard/quotes" />
          <SearchSection
            title="Bookings"
            items={bookings}
            baseUrl="/dashboard/bookings"
          />
        </>
      )}
    </div>
  );
}

function SearchSection({
  title,
  items,
  baseUrl,
}: {
  title: string;
  items: any[];
  baseUrl: string;
}) {
  if (items.length === 0) return null;

  return (
    <div className="space-y-4">
      <h3 className="text-xl font-bold text-slate-900">
        {title} ({items.length})
      </h3>

      <div className="grid gap-4">
        {items.map((item) => (
          <a
            key={item.id}
            href={`${baseUrl}/${item.id}`}
            className="rounded-2xl border bg-white p-5 shadow-sm transition hover:border-emerald-300 hover:shadow-md"
          >
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h4 className="font-semibold text-slate-900">
                  {item.customer_name || "Unknown Customer"}
                </h4>

                <p className="text-sm text-slate-500">
                  {item.customer_email || "No email"}
                </p>

                <p className="mt-2 text-sm text-slate-600">
                  {item.pickup_address || "No pickup"} →{" "}
                  {item.dropoff_address || "No dropoff"}
                </p>
              </div>

              <div className="text-sm font-semibold text-emerald-700">
                View Details →
              </div>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}