import { NextResponse } from "next/server";
import { processPendingReminders } from "@/lib/reminders";

export async function POST(req: Request) {
  try {
    console.log("REMINDER PROCESSING ROUTE HIT");

    const result = await processPendingReminders();

    return NextResponse.json({
      message: "Reminders processed",
      result,
    });
  } catch (error) {
    console.log("REMINDER PROCESSING ERROR:", error);

    return NextResponse.json(
      {
        error: "Failed to process reminders",
        details: error instanceof Error ? error.message : error,
      },
      { status: 500 }
    );
  }
}
