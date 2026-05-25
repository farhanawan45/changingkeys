"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function login(e: React.FormEvent) {
    e.preventDefault();

    if (isLoading) return;

    if (!email || !password) {
      toast.error("Please enter email and password");
      return;
    }

    setIsLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      toast.error(error.message);
      setIsLoading(false);
      return;
    }

    toast.success("Logged in successfully");
    router.push("/dashboard");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-5">
      <form
        onSubmit={login}
        className="w-full max-w-md rounded-3xl border bg-white p-8 shadow-sm"
      >
        <h1 className="text-3xl font-bold text-slate-900">
          Login
        </h1>

        <p className="mt-2 text-slate-500">
          Sign in to Changing Keys dashboard.
        </p>

        <div className="mt-8 space-y-5">
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              Email
            </label>

            <input
              type="email"
              placeholder="admin@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border p-4 text-slate-900 outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              Password
            </label>

            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border p-4 text-slate-900 outline-none focus:border-emerald-500"
            />
          </div>

          <button
            disabled={isLoading}
            className={`w-full rounded-xl py-4 font-semibold text-white ${
              isLoading
                ? "cursor-not-allowed bg-slate-400"
                : "bg-emerald-600 hover:bg-emerald-700"
            }`}
          >
            {isLoading ? "Logging in..." : "Login"}
          </button>

          <p className="text-center text-sm text-slate-500">
            Don&apos;t have an account?{" "}
            <Link
              href="/signup"
              className="font-semibold text-emerald-700 hover:text-emerald-800"
            >
              Create account
            </Link>
          </p>
        </div>
      </form>
    </main>
  );
}