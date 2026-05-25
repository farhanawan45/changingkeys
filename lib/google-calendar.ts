import { google } from "googleapis";

const auth = new google.auth.JWT({
  email: process.env.GOOGLE_CLIENT_EMAIL,
  key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  scopes: ["https://www.googleapis.com/auth/calendar"],
});

export const calendar = google.calendar({
  version: "v3",
  auth,
});

export async function createCalendarBooking({
  summary,
  description,
  startDateTime,
  endDateTime,
}: {
  summary: string;
  description: string;
  startDateTime: string;
  endDateTime: string;
}) {
  const response = await calendar.events.insert({
    calendarId: process.env.GOOGLE_CALENDAR_ID!,
    requestBody: {
      summary,
      description,
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

  return response.data;
}