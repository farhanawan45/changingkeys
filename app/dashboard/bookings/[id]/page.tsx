"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function BookingDetailPage() {
  const params = useParams();
  const [booking, setBooking] = useState<any>(null);

  useEffect(() => {
    async function fetchBooking() {
      const { data, error } = await supabase
        .from("bookings")
        .select(`
          *,
          leads (
            customer_name,
            customer_email,
            customer_phone,
            pickup_address,
            dropoff_address,
            moving_date
          ),
          quotes (
            price,
            status
          )
        `)
        .eq("id", params.id)
        .single();

      if (error) console.log(error);
      else setBooking(data);
    }

    fetchBooking();
  }, [params.id]);

  if (!booking) return <p className="text-slate-600">Loading booking...</p>;

  return (
    <div>
      <div className="rounded-3xl border bg-white p-8 shadow-sm">
        <h1 className="text-3xl font-bold text-slate-900">
          Booking Detail
        </h1>

        <p className="mt-2 text-slate-500">
          Confirmed removal booking and customer move details.
        </p>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border bg-white p-6 shadow-sm lg:col-span-2">
          <h2 className="text-xl font-bold text-slate-900">
            {booking.leads?.customer_name || "Customer"}
          </h2>

          <div className="mt-6 grid gap-5 md:grid-cols-2">
            <div className="rounded-xl bg-slate-50 p-5">
              <p className="text-sm font-semibold text-slate-500">
                Email
              </p>
              <p className="mt-1 text-slate-900">
                {booking.leads?.customer_email || "Not added"}
              </p>
            </div>

            <div className="rounded-xl bg-slate-50 p-5">
              <p className="text-sm font-semibold text-slate-500">
                Phone
              </p>
              <p className="mt-1 text-slate-900">
                {booking.leads?.customer_phone || "Not added"}
              </p>
            </div>

            <div className="rounded-xl bg-slate-50 p-5">
              <p className="text-sm font-semibold text-slate-500">
                Pickup Address
              </p>
              <p className="mt-1 text-slate-900">
                {booking.leads?.pickup_address || "Not added"}
              </p>
            </div>

            <div className="rounded-xl bg-slate-50 p-5">
              <p className="text-sm font-semibold text-slate-500">
                Dropoff Address
              </p>
              <p className="mt-1 text-slate-900">
                {booking.leads?.dropoff_address || "Not added"}
              </p>
            </div>

            <div className="rounded-xl bg-slate-50 p-5">
              <p className="text-sm font-semibold text-slate-500">
                Moving Date
              </p>
              <p className="mt-1 text-slate-900">
                {booking.leads?.moving_date || "Not added"}
              </p>
            </div>

            <div className="rounded-xl bg-slate-50 p-5">
              <p className="text-sm font-semibold text-slate-500">
                Booking ID
              </p>
              <p className="mt-1 text-slate-900">
                {booking.id.slice(0, 8)}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border bg-emerald-50 p-6 shadow-sm">
          <p className="text-sm font-semibold text-emerald-700">
            Booking Value
          </p>

          <h2 className="mt-3 text-4xl font-bold text-emerald-800">
            £{booking.quotes?.price || 0}
          </h2>

          <span className="mt-6 inline-block rounded-full bg-emerald-100 px-4 py-2 text-sm font-semibold text-emerald-700">
            {booking.status || "confirmed"}
          </span>

          <p className="mt-6 text-sm text-emerald-800">
            This booking was created automatically after the quote was marked as paid.
          </p>
        </div>
      </div>
    </div>
  );
}