import { google } from "googleapis";

const googleClientEmail = process.env.GOOGLE_CLIENT_EMAIL;
const googlePrivateKey = process.env.GOOGLE_PRIVATE_KEY
  ? process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n").replace(/\r/g, "")
  : undefined;
const googleCalendarId = process.env.GOOGLE_CALENDAR_ID;

const auth = new google.auth.JWT({
  email: googleClientEmail,
  key: googlePrivateKey,
  scopes: ["https://www.googleapis.com/auth/calendar"],
});

export const calendar = google.calendar({
  version: "v3",
  auth,
});

export async function createCalendarBooking({
  summary,
  description,
  location,
  startDateTime,
  endDateTime,
}: {
  summary: string;
  description: string;
  location?: string;
  startDateTime: string;
  endDateTime: string;
}) {
  console.log("GOOGLE CALENDAR START:", {
    summary,
    location,
    startDateTime,
    endDateTime,
    calendarId: googleCalendarId,
    timestamp: new Date().toISOString(),
  });

  if (!googleClientEmail || !googlePrivateKey || !googleCalendarId) {
    console.log("GOOGLE CALENDAR ERROR: missing env vars", {
      googleClientEmail: !!googleClientEmail,
      googlePrivateKey: !!googlePrivateKey,
      googleCalendarId: !!googleCalendarId,
    });
    throw new Error("Missing Google Calendar environment variables");
  }

  const response = await calendar.events.insert({
    calendarId: googleCalendarId,
    requestBody: {
      summary,
      description,
      location: location || undefined,
      start: {
        dateTime: startDateTime,
        timeZone: "Europe/London",
      },
      end: {
        dateTime: endDateTime,
        timeZone: "Europe/London",
      },
    },
  });

  console.log("GOOGLE CALENDAR EVENT CREATED:", {
    eventId: response.data.id,
    summary: response.data.summary,
    start: response.data.start,
    end: response.data.end,
    htmlLink: response.data.htmlLink,
    timestamp: new Date().toISOString(),
  });

  return response.data;
}