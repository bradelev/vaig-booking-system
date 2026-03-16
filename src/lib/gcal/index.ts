/**
 * VBS-41/42/43/44 — Google Calendar API client.
 * OAuth per professional: each professional authorizes their own Google Calendar.
 * Tokens stored in professionals.google_refresh_token / google_calendar_id.
 */
import { google } from "googleapis";
import type { calendar_v3 } from "googleapis";

function getOAuthClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/api/oauth/google/callback`;

  if (!clientId || !clientSecret) {
    throw new Error("GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set");
  }

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

/**
 * Returns the Google OAuth2 authorization URL for a professional.
 */
export function getAuthUrl(professionalId: string): string {
  const oauth2Client = getOAuthClient();
  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: ["https://www.googleapis.com/auth/calendar"],
    state: professionalId,
  });
}

/**
 * Exchanges an authorization code for tokens.
 * Returns { refreshToken, calendarId } to be persisted.
 */
export async function exchangeCodeForTokens(
  code: string
): Promise<{ refreshToken: string; accessToken: string }> {
  const oauth2Client = getOAuthClient();
  const { tokens } = await oauth2Client.getToken(code);

  if (!tokens.refresh_token) {
    throw new Error("No refresh_token received — user must re-authorize with prompt=consent");
  }

  return {
    refreshToken: tokens.refresh_token,
    accessToken: tokens.access_token ?? "",
  };
}

/**
 * Builds an authenticated Google Calendar client for a professional
 * using their stored refresh token.
 */
function getCalendarClient(refreshToken: string): calendar_v3.Calendar {
  const oauth2Client = getOAuthClient();
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  return google.calendar({ version: "v3", auth: oauth2Client });
}

export interface CalendarEventParams {
  calendarId: string;       // e.g. "primary" or the professional's calendar ID
  refreshToken: string;
  summary: string;          // e.g. "VAIG: Juan Pérez — Masaje"
  description: string;
  startIso: string;         // ISO 8601 string
  endIso: string;
  timeZone?: string;
}

/**
 * Creates a Google Calendar event and returns the event ID.
 */
export async function createCalendarEvent(params: CalendarEventParams): Promise<string> {
  const calendar = getCalendarClient(params.refreshToken);

  const event = await calendar.events.insert({
    calendarId: params.calendarId,
    requestBody: {
      summary: params.summary,
      description: params.description,
      start: { dateTime: params.startIso, timeZone: params.timeZone ?? "America/Argentina/Buenos_Aires" },
      end: { dateTime: params.endIso, timeZone: params.timeZone ?? "America/Argentina/Buenos_Aires" },
    },
  });

  const eventId = event.data.id;
  if (!eventId) throw new Error("Google Calendar event created but no ID returned");
  return eventId;
}

/**
 * Deletes a Google Calendar event by event ID.
 * Silently ignores 404 (event already deleted).
 */
export async function deleteCalendarEvent(
  calendarId: string,
  refreshToken: string,
  eventId: string
): Promise<void> {
  const calendar = getCalendarClient(refreshToken);
  try {
    await calendar.events.delete({ calendarId, eventId });
  } catch (err: unknown) {
    const status = (err as { code?: number })?.code;
    if (status === 404 || status === 410) return; // already gone
    throw err;
  }
}
