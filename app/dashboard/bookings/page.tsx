"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function BookingsPage() {
  const [bookings, setBookings] = useState<any[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    fetchBookings();
  }, []);

  async function fetchBookings() {
    const { data, error } = await supabase
      .from("bookings")
      .select(`
        *,
        leads (
          customer_name,
          customer_email,
          pickup_address,
          dropoff_address
        )
      `)
      .order("created_at", { ascending: false });

    if (error) {
      console.log(error);
    } else {
      setBookings(data || []);
    }
  }

  async function deleteBooking(id: string) {
    setDeletingId(id);

    const { error } = await supabase
      .from("bookings")
      .delete()
      .eq("id", id);

    if (error) {
      alert("Failed to delete booking");
      console.log(error);
    } else {
      setBookings((prev) =>
        prev.filter((booking) => booking.id !== id)
      );
    }

    setDeletingId(null);
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">
            Bookings
          </h1>

          <p className="mt-2 text-slate-500">
            Confirmed customer removals.
          </p>
        </div>
      </div>

      <div className="mt-8 rounded-2xl border bg-white shadow-sm">
        {bookings.length === 0 ? (
          <div className="p-12 text-center">
            <h2 className="text-2xl font-bold text-slate-900">
              No Bookings Yet
            </h2>

            <p className="mt-2 text-slate-500">
              Paid quotes will automatically appear here as bookings.
            </p>
          </div>
        ) : (
          bookings.map((booking) => (
            <div
              key={booking.id}
              className="border-b p-6 last:border-b-0"
            >
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <a
                  href={`/dashboard/bookings/${booking.id}`}
                  className="block flex-1"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h2 className="text-xl font-bold text-slate-900">
                        {booking.leads?.customer_name || "Customer"}
                      </h2>

                      <p className="mt-2 text-slate-600">
                        {booking.leads?.customer_email}
                      </p>

                      <p className="mt-1 text-sm text-slate-500">
                        Booking ID: {booking.id.slice(0, 8)}
                      </p>
                    </div>

                    <span className="rounded-full bg-emerald-100 px-3 py-1 text-sm text-emerald-700">
                      {booking.status || "confirmed"}
                    </span>
                  </div>

                  <p className="mt-4 text-slate-600">
                    {booking.leads?.pickup_address} →{" "}
                    {booking.leads?.dropoff_address}
                  </p>
                </a>

                <div className="flex items-center gap-3">
                  <a
                    href={`/dashboard/bookings/${booking.id}`}
                    className="rounded-xl border px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                  >
                    View
                  </a>

                  <button
                    onClick={() => deleteBooking(booking.id)}
                    disabled={deletingId === booking.id}
                    className="rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {deletingId === booking.id ? "Deleting..." : "Delete"}
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