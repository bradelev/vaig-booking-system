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

export interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: string; // ISO datetime
  end: string;   // ISO datetime
  colorId?: string;
}

/**
 * Lists calendar events in a time range.
 * Returns [] if env vars are not configured (graceful degradation).
 * Paginates automatically if there are more than 250 events.
 */
export async function listCalendarEvents(
  timeMin: string,
  timeMax: string,
): Promise<CalendarEvent[]> {
  if (
    !process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ||
    !process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY ||
    !process.env.GOOGLE_CALENDAR_ID
  ) {
    return [];
  }

  const calendar = getCalendarClient();
  const calendarId = getCalendarId();
  const results: CalendarEvent[] = [];
  let pageToken: string | undefined;

  do {
    const res = await calendar.events.list({
      calendarId,
      timeMin,
      timeMax,
      singleEvents: true,
      orderBy: "startTime",
      timeZone: "America/Argentina/Buenos_Aires",
      maxResults: 250,
      pageToken,
    });

    for (const event of res.data.items ?? []) {
      if (!event.id) continue;
      results.push({
        id: event.id,
        summary: event.summary ?? "(sin título)",
        description: event.description ?? undefined,
        start: event.start?.dateTime ?? event.start?.date ?? "",
        end: event.end?.dateTime ?? event.end?.date ?? "",
        colorId: event.colorId ?? undefined,
      });
    }

    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken);

  return results;
}
