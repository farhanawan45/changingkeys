"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { supabase } from "@/lib/supabase";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const [search, setSearch] = useState("");
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    async function checkAuth() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push("/login");
      } else {
        setCheckingAuth(false);
      }
    }

    checkAuth();
  }, [router]);

  const navItems = [
    ["Dashboard", "/dashboard"],
    ["Leads", "/dashboard/leads"],
    ["Quotes", "/dashboard/quotes"],
    ["Bookings", "/dashboard/bookings"],
    ["Reminders", "/dashboard/reminders"],
    ["Calendar", "/dashboard/calendar"],
    ["Settings", "/dashboard/settings"],
  ];

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();

    const query = search.trim();

    if (!query) return;

    router.push(`/dashboard/search?q=${encodeURIComponent(query)}`);
    setSearch("");
  }

  async function logout() {
    await supabase.auth.signOut();

    toast.success("Logged out successfully");

    router.push("/login");
  }

  if (checkingAuth) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-slate-600">Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 lg:flex">
      <aside className="border-b bg-white p-5 lg:min-h-screen lg:w-72 lg:border-b-0 lg:border-r lg:p-6">
        <div className="mb-6 lg:mb-10">
          <h1 className="text-2xl font-bold text-emerald-700">
            Changing Keys
          </h1>

          <p className="text-sm text-slate-500">
            Automation dashboard
          </p>
        </div>

        <nav className="flex gap-2 overflow-x-auto lg:block lg:space-y-2">
          {navItems.map(([label, href]) => {
            const isActive =
              pathname === href || pathname.startsWith(`${href}/`);

            return (
              <a
                key={label}
                href={href}
                className={`whitespace-nowrap rounded-xl px-4 py-3 transition lg:block ${
                  isActive
                    ? "bg-emerald-600 font-semibold text-white shadow-sm"
                    : "text-slate-700 hover:bg-emerald-50 hover:text-emerald-700"
                }`}
              >
                {label}
              </a>
            );
          })}
        </nav>

        <button
          onClick={logout}
          className="mt-8 w-full rounded-xl bg-red-600 px-4 py-3 font-semibold text-white hover:bg-red-700"
        >
          Logout
        </button>
      </aside>

      <main className="flex-1">
        <header className="border-b bg-white px-5 py-4 lg:px-8 lg:py-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
            <form onSubmit={handleSearch} className="flex-1">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search leads, quotes, bookings, customers"
                className="w-full rounded-xl border px-4 py-3 text-slate-900 outline-none placeholder:text-slate-400 focus:border-emerald-500"
              />
            </form>

            <div className="flex items-center gap-3">
              <a
                href="/dashboard/leads/new"
                className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800"
              >
                + Lead
              </a>

              <a
                href="/dashboard/quotes/new"
                className="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700"
              >
                + Quote
              </a>
            </div>
          </div>
        </header>

        <section className="p-5 lg:p-8">{children}</section>
      </main>
    </div>
  );
}