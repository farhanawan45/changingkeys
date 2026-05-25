import { NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { supabase } from "@/lib/supabase";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const quoteId = id;

    console.log("PDF QUOTE ID:", quoteId);

    const { data: quote, error } = await supabase
      .from("quotes")
      .select("*")
      .eq("id", quoteId)
      .single();

    console.log("PDF SUPABASE ERROR:", error);
    console.log("PDF QUOTE:", quote);

    if (error || !quote) {
      return NextResponse.json(
        {
          error: "Quote not found",
          quoteId,
          details: error,
        },
        { status: 404 }
      );
    }

    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .select("*")
      .eq("id", quote.lead_id)
      .single();

    console.log("PDF LEAD ERROR:", leadError);
    console.log("PDF LEAD:", lead);

    const pdfDoc = await PDFDocument.create();

    const page = pdfDoc.addPage([595, 842]);

    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

    const boldFont = await pdfDoc.embedFont(
      StandardFonts.HelveticaBold
    );

    page.drawText("Changing Keys", {
      x: 50,
      y: 780,
      size: 28,
      font: boldFont,
      color: rgb(0.02, 0.45, 0.28),
    });

    page.drawText("Removal Service Quote", {
      x: 50,
      y: 745,
      size: 16,
      font,
    });

    page.drawText(`Quote ID: ${quote.id}`, {
      x: 50,
      y: 700,
      size: 10,
      font,
    });

    page.drawText(
      `Customer: ${lead?.customer_name || "Not added"}`,
      {
        x: 50,
        y: 660,
        size: 12,
        font,
      }
    );

    page.drawText(
      `Email: ${lead?.customer_email || "Not added"}`,
      {
        x: 50,
        y: 635,
        size: 12,
        font,
      }
    );

    page.drawText(
      `Phone: ${lead?.customer_phone || "Not added"}`,
      {
        x: 50,
        y: 610,
        size: 12,
        font,
      }
    );

    page.drawText(
      `Pickup: ${lead?.pickup_address || "Not added"}`,
      {
        x: 50,
        y: 570,
        size: 12,
        font,
      }
    );

    page.drawText(
      `Dropoff: ${lead?.dropoff_address || "Not added"}`,
      {
        x: 50,
        y: 545,
        size: 12,
        font,
      }
    );

    page.drawText(
      `Moving Date: ${lead?.moving_date || "Not added"}`,
      {
        x: 50,
        y: 520,
        size: 12,
        font,
      }
    );

    page.drawText(`Total Quote Price: £${quote.price}`, {
      x: 50,
      y: 460,
      size: 22,
      font: boldFont,
      color: rgb(0.02, 0.45, 0.28),
    });

    page.drawText(
      "Thank you for choosing Changing Keys.",
      {
        x: 50,
        y: 390,
        size: 12,
        font,
      }
    );

    const pdfBytes = await pdfDoc.save();

    return new NextResponse(pdfBytes, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="quote-${quote.id}.pdf"`,
      },
    });
  } catch (error) {
    console.log("PDF GENERATION ERROR:", error);

    return NextResponse.json(
      {
        error: "Failed to generate PDF",
        details: error,
      },
      { status: 500 }
    );
  }
}