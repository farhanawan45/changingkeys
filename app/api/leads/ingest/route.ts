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
      customerName: rawCustomerName,
      customerEmail: rawCustomerEmail,
      customerPhone: rawCustomerPhone,
      pickupAddress: rawPickupAddress,
      dropoffAddress: rawDropoffAddress,
      movingDate: rawMovingDate,
      estimatedHours: rawEstimatedHours,
      distanceMiles: rawDistanceMiles,
      itemsCount: rawItemsCount,
      customer_name: rawCustomerNameSnake,
      customer_email: rawCustomerEmailSnake,
      customer_phone: rawCustomerPhoneSnake,
      pickup_address: rawPickupAddressSnake,
      dropoff_address: rawDropoffAddressSnake,
      moving_date: rawMovingDateSnake,
      estimated_hours: rawEstimatedHoursSnake,
      distance_miles: rawDistanceMilesSnake,
      items_count: rawItemsCountSnake,
    } = body;

    const customerName =
      typeof rawCustomerName === "string" && rawCustomerName.trim().length > 0
        ? rawCustomerName.trim()
        : typeof rawCustomerNameSnake === "string"
        ? rawCustomerNameSnake.trim()
        : "";
    const customerEmail =
      typeof rawCustomerEmail === "string" && rawCustomerEmail.trim().length > 0
        ? rawCustomerEmail.trim()
        : typeof rawCustomerEmailSnake === "string"
        ? rawCustomerEmailSnake.trim()
        : "";
    const customerPhone =
      typeof rawCustomerPhone === "string" && rawCustomerPhone.trim().length > 0
        ? rawCustomerPhone.trim()
        : typeof rawCustomerPhoneSnake === "string"
        ? rawCustomerPhoneSnake.trim()
        : "";
    const pickupAddress =
      typeof rawPickupAddress === "string" && rawPickupAddress.trim().length > 0
        ? rawPickupAddress.trim()
        : typeof rawPickupAddressSnake === "string"
        ? rawPickupAddressSnake.trim()
        : "";
    const dropoffAddress =
      typeof rawDropoffAddress === "string" && rawDropoffAddress.trim().length > 0
        ? rawDropoffAddress.trim()
        : typeof rawDropoffAddressSnake === "string"
        ? rawDropoffAddressSnake.trim()
        : "";
    const movingDate =
      typeof rawMovingDate === "string" && rawMovingDate.trim().length > 0
        ? rawMovingDate.trim()
        : typeof rawMovingDateSnake === "string"
        ? rawMovingDateSnake.trim()
        : "";
    const estimatedHours =
      rawEstimatedHours ?? rawEstimatedHoursSnake ?? null;
    const distanceMiles =
      rawDistanceMiles ?? rawDistanceMilesSnake ?? null;
    const itemsCount = rawItemsCount ?? rawItemsCountSnake ?? null;

    console.log("LEAD INGEST CUSTOMER NAME", {
      customerName,
      customerEmail,
      customerPhone,
      timestamp: new Date().toISOString(),
    });

    const normalizedEmail = customerEmail?.trim().toLowerCase() || "";

    // Extract name from email prefix if customerName is missing
    let derivedCustomerName = customerName;
    if (!derivedCustomerName && normalizedEmail) {
      const emailPrefix = normalizedEmail.split("@")[0];
      derivedCustomerName = emailPrefix
        .split(/[._-]/)
        .map((part: string) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
      console.log("LEAD INGEST NAME DERIVED FROM EMAIL", {
        normalizedEmail,
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

    if (!derivedCustomerName && !normalizedEmail && !customerPhone) {
      return NextResponse.json(
        { error: "Customer name, email or phone is required" },
        { status: 400 }
      );
    }

    if (normalizedEmail) {
      const { data: existingLead, error: existingLeadError } = await supabase
        .from("leads")
        .select("*")
        .eq("customer_email", normalizedEmail)
        .maybeSingle();

      if (existingLeadError) {
        console.log("LEAD INGEST EXISTING LEAD QUERY ERROR", {
          existingLeadError,
          timestamp: new Date().toISOString(),
        });
      }

      if (existingLead) {
        const updateData: Record<string, any> = {};

        if (
          derivedCustomerName &&
          derivedCustomerName !== existingLead.customer_name
        ) {
          updateData.customer_name = derivedCustomerName;
        }

        if (customerPhone && customerPhone !== existingLead.customer_phone) {
          updateData.customer_phone = customerPhone;
        }

        if (pickupAddress && pickupAddress !== existingLead.pickup_address) {
          updateData.pickup_address = pickupAddress;
        }

        if (dropoffAddress && dropoffAddress !== existingLead.dropoff_address) {
          updateData.dropoff_address = dropoffAddress;
        }

        if (movingDate && movingDate !== existingLead.moving_date) {
          updateData.moving_date = movingDate;
        }

        if (Object.keys(updateData).length > 0) {
          const { data: updatedLead, error: updateError } = await supabase
            .from("leads")
            .update(updateData)
            .eq("id", existingLead.id)
            .select()
            .single();

          if (updateError) {
            console.log("LEAD INGEST DUPLICATE UPDATE ERROR", {
              updateError,
              leadId: existingLead.id,
              updateData,
              timestamp: new Date().toISOString(),
            });
          } else {
            return NextResponse.json({
              message: "Lead already exists and was updated",
              lead: updatedLead,
            });
          }
        }

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
      customer_email: normalizedEmail || "",
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
