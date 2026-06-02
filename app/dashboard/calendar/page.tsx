import { supabase } from "@/lib/supabase";

function formatDate(dateString: string) {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function groupBookingsByDate(bookings: any[]) {
  return bookings.reduce((groups: Record<string, any[]>, booking) => {
    const dateKey = booking.booking_date || "No date";
    if (!groups[dateKey]) {
      groups[dateKey] = [];
    }
    groups[dateKey].push(booking);
    return groups;
  }, {});
}

export default async function CalendarPage() {
  const { data: bookings, error } = await supabase
    .from("bookings")
    .select(`*, leads ( customer_name, pickup_address, dropoff_address )`)
    .order("booking_date", { ascending: true });

  const groupedBookings = groupBookingsByDate(bookings || []);
  const sortedDates = Object.keys(groupedBookings).sort((a, b) => {
    if (a === "No date") return 1;
    if (b === "No date") return -1;
    return new Date(a).getTime() - new Date(b).getTime();
  });

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Calendar</h1>
          <p className="mt-2 text-slate-500">
            Bookings calendar view with upcoming removals.
          </p>
        </div>
      </div>

      <div className="mt-8 rounded-2xl border bg-white shadow-sm">
        {error ? (
          <div className="p-12 text-center text-red-600">
            <h2 className="text-xl font-bold">Unable to load calendar</h2>
            <p className="mt-2 text-slate-500">{error.message}</p>
          </div>
        ) : bookings && bookings.length === 0 ? (
          <div className="p-12 text-center">
            <h2 className="text-2xl font-bold text-slate-900">No calendar bookings yet</h2>
            <p className="mt-2 text-slate-500">
              Confirmed bookings will appear here by moving date.
            </p>
          </div>
        ) : (
          sortedDates.map((dateKey) => (
            <div key={dateKey} className="border-b last:border-b-0 p-6">
              <h2 className="text-xl font-semibold text-slate-900">
                {dateKey === "No date" ? "No date assigned" : formatDate(dateKey)}
              </h2>

              <div className="mt-4 space-y-4">
                {groupedBookings[dateKey].map((booking) => (
                  <div
                    key={booking.id}
                    className="rounded-3xl border border-slate-200 p-5 hover:border-slate-300"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <a
                          href={`/dashboard/bookings/${booking.id}`}
                          className="text-xl font-semibold text-slate-900 hover:text-slate-700"
                        >
                          {booking.leads?.customer_name || "Customer"}
                        </a>

                        <p className="mt-2 text-slate-600">
                          {booking.leads?.pickup_address || "Pickup not set"} → {booking.leads?.dropoff_address || "Dropoff not set"}
                        </p>

                        <p className="mt-2 text-sm text-slate-500">
                          Booking ID: {booking.id.slice(0, 8)}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
                          {booking.status || "confirmed"}
                        </span>
                        <a
                          href={`/dashboard/bookings/${booking.id}`}
                          className="rounded-full border border-slate-200 bg-white px-3 py-1 text-slate-700 hover:bg-slate-50"
                        >
                          View booking
                        </a>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
