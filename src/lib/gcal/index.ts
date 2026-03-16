/**
 * Google Calendar API client — Service Account authentication.
 * All events are created in a single shared calendar (GOOGLE_CALENDAR_ID).
 * No OAuth per-professional flow required.
 */
import { google } from "googleapis";
import type { calendar_v3 } from "googleapis";

function getCalendarClient(): calendar_v3.Calendar {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const rawKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;

  if (!email || !rawKey) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY must be set");
  }

  // Vercel stores the private key with literal \n — replace them
  const privateKey = rawKey.replace(/\\n/g, "\n");

  const auth = new google.auth.GoogleAuth({
    credentials: { client_email: email, private_key: privateKey },
    scopes: ["https://www.googleapis.com/auth/calendar"],
  });

  return google.calendar({ version: "v3", auth });
}

function getCalendarId(): string {
  const id = process.env.GOOGLE_CALENDAR_ID;
  if (!id) throw new Error("GOOGLE_CALENDAR_ID must be set");
  return id;
}

export interface CalendarEventParams {
  summary: string;
  description: string;
  startIso: string;
  endIso: string;
  timeZone?: string;
}

/**
 * Creates a Google Calendar event and returns the event ID.
 */
export async function createCalendarEvent(params: CalendarEventParams): Promise<string> {
  const calendar = getCalendarClient();
  const calendarId = getCalendarId();

  const event = await calendar.events.insert({
    calendarId,
    requestBody: {
      summary: params.summary,
      description: params.description,
      start: {
        dateTime: params.startIso,
        timeZone: params.timeZone ?? "America/Argentina/Buenos_Aires",
      },
      end: {
        dateTime: params.endIso,
        timeZone: params.timeZone ?? "America/Argentina/Buenos_Aires",
      },
    },
  });

  const eventId = event.data.id;
  if (!eventId) throw new Error("Google Calendar event created but no ID returned");
  return eventId;
}

/**
 * Deletes a Google Calendar event by event ID.
 * Silently ignores 404/410 (event already deleted).
 */
export async function deleteCalendarEvent(eventId: string): Promise<void> {
  const calendar = getCalendarClient();
  const calendarId = getCalendarId();

  try {
    await calendar.events.delete({ calendarId, eventId });
  } catch (err: unknown) {
    const status = (err as { code?: number })?.code;
    if (status === 404 || status === 410) return;
    throw err;
  }
}
