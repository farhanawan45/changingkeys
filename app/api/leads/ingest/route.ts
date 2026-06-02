import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    console.log("LEAD INGEST RAW BODY", {
      body,
      timestamp: new Date().toISOString(),
    });

    const {
      customerName,
      customerEmail,
      customerPhone,
      pickupAddress,
      dropoffAddress,
      movingDate,
      estimatedHours,
      distanceMiles,
      itemsCount,
    } = body;

    console.log("LEAD INGEST CUSTOMER NAME", {
      customerName,
      customerEmail,
      customerPhone,
      timestamp: new Date().toISOString(),
    });

    // Extract name from email prefix if customerName is missing
    let derivedCustomerName = customerName;
    if (!derivedCustomerName && customerEmail) {
      const emailPrefix = customerEmail.split("@")[0];
      derivedCustomerName = emailPrefix
        .split(/[._-]/)
        .map((part: string) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
      console.log("LEAD INGEST NAME DERIVED FROM EMAIL", {
        customerEmail,
        emailPrefix,
        derivedCustomerName,
        timestamp: new Date().toISOString(),
      });
    }

    console.log("LEAD INGEST FINAL CUSTOMER NAME", {
      inputCustomerName: customerName,
      derivedCustomerName,
      finalCustomerName: derivedCustomerName || "",
      timestamp: new Date().toISOString(),
    });

    if (!derivedCustomerName && !customerEmail && !customerPhone) {
      return NextResponse.json(
        { error: "Customer name, email or phone is required" },
        { status: 400 }
      );
    }

    if (customerEmail) {
      const { data: existingLead } = await supabase
        .from("leads")
        .select("*")
        .eq("customer_email", customerEmail)
        .maybeSingle();

      if (existingLead) {
        return NextResponse.json({
          message: "Lead already exists",
          lead: existingLead,
        });
      }
    }

    const hours = estimatedHours ? Number(estimatedHours) : 0;
    const miles = distanceMiles ? Number(distanceMiles) : 0;
    const items = itemsCount ? Number(itemsCount) : 0;

    console.log("LEAD CREATE MOVING DATE INPUT", {
      movingDate,
      customerName,
      customerEmail,
      timestamp: new Date().toISOString(),
    });

    const leadInsertData = {
      customer_name: derivedCustomerName || "",
      customer_email: customerEmail || "",
      customer_phone: customerPhone || "",
      pickup_address: pickupAddress || "",
      dropoff_address: dropoffAddress || "",
      moving_date: movingDate || null,
      estimated_hours: hours,
      distance_miles: miles,
      items_count: items,
      status: "new",
    };

    console.log("LEAD INSERT DATA", {
      leadInsertData,
      timestamp: new Date().toISOString(),
    });

    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .insert([leadInsertData])
      .select()
      .single();

    if (leadError) {
      console.log("LEAD ERROR:", leadError);

      return NextResponse.json(
        {
          error: "Failed to create lead",
          details: leadError,
        },
        { status: 500 }
      );
    }

    console.log("LEAD CREATE SUCCESS", {
      leadId: lead.id,
      movingDate: lead.moving_date,
      lead,
      timestamp: new Date().toISOString(),
    });

    const { error: notificationError } = await supabase
      .from("notifications")
      .insert([
        {
          title: "New Lead Received",
          message: `New lead received: ${
            lead.customer_name || lead.customer_email || "Customer"
          }`,
          type: "lead",
          is_read: false,
          lead_id: lead.id,
        },
      ]);

    if (notificationError) {
      console.log("NOTIFICATION ERROR:", notificationError);
    }

    const { data: settings, error: settingsError } = await supabase
      .from("settings")
      .select("*")
      .limit(1)
      .single();

    if (settingsError) {
      console.log("SETTINGS ERROR:", settingsError);
    }

    const hourlyRate = Number(settings?.hourly_rate || 0);
    const mileRate = Number(settings?.mile_rate || 0);
    const itemRate = 5;

    const calculatedPrice =
      hours * hourlyRate + miles * mileRate + items * itemRate;

    let quote = null;
    let quoteErrorDetails = null;

    if (calculatedPrice > 0) {
      const { data: quoteData, error: quoteError } = await supabase
        .from("quotes")
        .insert([
          {
            lead_id: lead.id,
            price: calculatedPrice,
            status: "pending",
          },
        ])
        .select()
        .single();

      if (quoteError) {
        console.log("QUOTE ERROR:", quoteError);
        quoteErrorDetails = quoteError;
      } else {
        quote = quoteData;

        await supabase
          .from("leads")
          .update({ status: "quoted" })
          .eq("id", lead.id);
      }
    }

    return NextResponse.json({
      message: "Lead created successfully",
      lead,
      quote,
      calculatedPrice,
      quoteError: quoteErrorDetails,
    });
  } catch (error) {
    console.log("API ERROR:", error);

    return NextResponse.json(
      {
        error: "Invalid request",
        details: error,
      },
      { status: 500 }
    );
  }
}
