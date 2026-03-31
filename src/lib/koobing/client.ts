/**
 * Koobing API client
 * Auth: `session` header with JWT token from /account/refreshtoken
 */

export interface KoobingAppointment {
  id: number;
  created_at: string;
  status: number; // 2=confirmed, -1=cancelled, 1=pending
  date: string;   // ISO date, time is always T00:00:00
  start_time: number; // HHMM integer, e.g. 1500 = 15:00
  end_time: number;
  service_id: number;
  worker_id: number;
  name: string;   // client full name
  phone: string;  // with country code e.g. "59894020096"
  email: string;
  calendar_id: string | null; // GCal event id
}

export interface KoobingService {
  id: number;
  name: string;
  category: string | null;
  duration: number; // minutes
  price: number | null;
}

export interface KoobingWorker {
  id: number;
  name: string;
  deleted_at: string | null;
}

function getToken(): string {
  const token = process.env.KOOBING_SESSION_TOKEN;
  if (!token) throw new Error("KOOBING_SESSION_TOKEN env var is not set");
  return token;
}

async function koobingFetch(path: string): Promise<unknown> {
  const url = `https://api.koob.uy${path}`;
  const res = await fetch(url, {
    headers: { session: getToken() },
    cache: "no-store",
  });
  const text = await res.text();
  if (text === "account_no_session_found") {
    throw new Error("Koobing session token is invalid or expired. Refresh via /account/refreshtoken.");
  }
  return JSON.parse(text);
}

export async function fetchKoobingAppointments(
  from: string, // YYYY-MM-DD
  to: string    // YYYY-MM-DD
): Promise<KoobingAppointment[]> {
  const data = await koobingFetch(`/appointment?dateRange=${from}to${to}`) as { appointments?: KoobingAppointment[] };
  return data.appointments ?? [];
}

export async function fetchKoobingServices(): Promise<KoobingService[]> {
  const data = await koobingFetch("/service") as { services?: KoobingService[] };
  return data.services ?? [];
}

export async function fetchKoobingWorkers(): Promise<KoobingWorker[]> {
  const data = await koobingFetch("/worker") as { workers?: KoobingWorker[] };
  return data.workers ?? [];
}
