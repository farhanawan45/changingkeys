import { NextResponse } from "next/server";
import { processPendingReminders } from "@/lib/reminders";
import { getSupabaseEnvStatus } from "@/lib/supabase";
import { getSmtpEnvStatus } from "@/lib/email";

export async function POST(req: Request) {
  const url = new URL(req.url);
  const debug = url.searchParams.get("debug") === "true";

  console.log("REMINDER PROCESSING ROUTE HIT", { debug });

  const envStatus = {
    ...getSupabaseEnvStatus(),
    ...getSmtpEnvStatus(),
  };

  try {
    const result = await processPendingReminders();

    return NextResponse.json({
      routeHit: true,
      debugRequested: debug,
      envCheck: envStatus,
      ...result,
    });
  } catch (error) {
    console.log("REMINDER PROCESSING ERROR:", error);

    return NextResponse.json(
      {
        routeHit: true,
        debugRequested: debug,
        envCheck: envStatus,
        error: "Failed to process reminders",
        errorDetails: error instanceof Error ? { message: error.message, stack: error.stack } : error,
      },
      { status: 500 }
    );
  }
}
