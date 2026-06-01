import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

/**
 * TEST ROUTE: Direct reminder insertion
 * GET /api/reminders/test
 * 
 * This route tests if reminders can be inserted directly into the database.
 * It bypasses the reminder creation logic and directly inserts a test row.
 */
export async function GET(req: Request) {
  console.log("TEST REMINDER ROUTE STARTED");

  try {
    const testReminder = {
      lead_id: null,
      quote_id: null,
      booking_id: null,
      type: "test",
      status: "pending",
      scheduled_for: new Date().toISOString(),
    };

    console.log("TEST: Inserting test reminder:", {
      data: testReminder,
      timestamp: new Date().toISOString(),
    });

    const { data, error } = await supabase
      .from("reminders")
      .insert([testReminder]);

    if (error) {
      console.log("TEST: INSERT FAILED:", {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });

      return NextResponse.json(
        {
          success: false,
          error: "Failed to insert test reminder",
          details: {
            code: error.code,
            message: error.message,
            details: error.details,
            hint: error.hint,
          },
        },
        { status: 500 }
      );
    }

    console.log("TEST: INSERT SUCCESS:", {
      data,
      timestamp: new Date().toISOString(),
    });

    // Verify the row was actually inserted
    const { data: verify, error: verifyError } = await supabase
      .from("reminders")
      .select("*")
      .eq("type", "test")
      .order("created_at", { ascending: false })
      .limit(1);

    console.log("TEST: VERIFICATION QUERY:", {
      rowsFound: verify?.length || 0,
      data: verify,
      verifyError,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      message: "Test reminder inserted successfully",
      inserted: data,
      verified: verify,
    });
  } catch (error) {
    console.log("TEST: EXCEPTION:", {
      error,
      errorMessage: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json(
      {
        success: false,
        error: "Test route exception",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
