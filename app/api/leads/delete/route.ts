import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const leadId = typeof body.leadId === "string" ? body.leadId.trim() : "";

    if (!leadId) {
      return NextResponse.json(
        { error: "leadId is required" },
        { status: 400 }
      );
    }

    const { data: existingLead, error: fetchLeadError } = await supabase
      .from("leads")
      .select("id")
      .eq("id", leadId)
      .maybeSingle();

    if (fetchLeadError) {
      console.log("LEAD DELETE FETCH ERROR:", fetchLeadError);
      return NextResponse.json(
        {
          error: "Failed to verify lead before deletion",
          details: fetchLeadError,
        },
        { status: 500 }
      );
    }

    if (!existingLead) {
      return NextResponse.json(
        { error: "Lead not found" },
        { status: 404 }
      );
    }

    const relatedTables = [
      { table: "notifications", column: "lead_id" },
      { table: "reminders", column: "lead_id" },
      { table: "bookings", column: "lead_id" },
      { table: "quotes", column: "lead_id" },
    ];

    for (const relation of relatedTables) {
      const { error } = await supabase
        .from(relation.table)
        .delete()
        .eq(relation.column, leadId);

      if (error) {
        console.log(`LEAD DELETE ERROR: Failed to delete ${relation.table}`, {
          leadId,
          table: relation.table,
          error,
        });

        return NextResponse.json(
          {
            error: `Failed to delete related ${relation.table}`,
            details: error,
          },
          { status: 500 }
        );
      }
    }

    const { error: deleteLeadError } = await supabase
      .from("leads")
      .delete()
      .eq("id", leadId);

    if (deleteLeadError) {
      console.log("LEAD DELETE ERROR: Failed to delete lead record", {
        leadId,
        error: deleteLeadError,
      });

      return NextResponse.json(
        {
          error: "Failed to delete lead",
          details: deleteLeadError,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ message: "Lead deleted successfully" });
  } catch (error) {
    console.log("LEAD DELETE ENDPOINT ERROR:", error);
    return NextResponse.json(
      {
        error: "Failed to delete lead",
        details: error instanceof Error ? error.message : error,
      },
      { status: 500 }
    );
  }
}
