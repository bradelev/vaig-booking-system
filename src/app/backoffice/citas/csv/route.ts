import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatTime, BOOKING_STATUS_LABELS } from "@/lib/utils";

const CSV_LIMIT = 5000;

function getDateRange(filtro: string, desde?: string, hasta?: string) {
  const now = new Date();

  if (filtro === "rango" && desde && hasta) {
    return { start: `${desde}T00:00:00`, end: `${hasta}T23:59:59` };
  }

  const start = new Date(now);
  const end = new Date(now);
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  if (filtro === "semana") {
    const day = now.getDay();
    start.setDate(now.getDate() - day);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
  } else if (filtro === "mes") {
    start.setDate(1);
    end.setMonth(now.getMonth() + 1, 0);
    end.setHours(23, 59, 59, 999);
  }

  return { start: start.toISOString(), end: end.toISOString() };
}

function escapeCell(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const filtro = searchParams.get("filtro") ?? "hoy";
  const desde = searchParams.get("desde") ?? undefined;
  const hasta = searchParams.get("hasta") ?? undefined;
  const estado = searchParams.get("estado") ?? "";
  const profesionalId = searchParams.get("profesional") ?? "";
  const servicioId = searchParams.get("servicio") ?? "";
  const busqueda = searchParams.get("busqueda") ?? "";

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  const { start, end } = getDateRange(filtro, desde, hasta);

  // Resolve search by client name/phone
  let clientIds: string[] | undefined;
  if (busqueda) {
    const { data: matchedClients } = await db
      .from("clients")
      .select("id")
      .or(
        `first_name.ilike.%${busqueda}%,last_name.ilike.%${busqueda}%,phone.ilike.%${busqueda}%`
      );
    const ids: string[] = (matchedClients ?? []).map((c: { id: string }) => c.id);
    clientIds = ids.length === 0 ? ["00000000-0000-0000-0000-000000000000"] : ids;
  }

  let query = db
    .from("bookings")
    .select(
      `scheduled_at, status,
       clients(first_name, last_name, phone),
       services(name),
       professionals(name)`
    )
    .gte("scheduled_at", start)
    .lte("scheduled_at", end)
    .order("scheduled_at")
    .limit(CSV_LIMIT);

  if (estado) query = query.eq("status", estado);
  if (profesionalId) query = query.eq("professional_id", profesionalId);
  if (servicioId) query = query.eq("service_id", servicioId);
  if (clientIds !== undefined) query = query.in("client_id", clientIds);

  const { data: raw } = await query;
  const bookings = raw ?? [];

  const header = ["Fecha", "Hora", "Cliente", "Teléfono", "Servicio", "Profesional", "Estado"];
  const rows = bookings.map(
    (b: {
      scheduled_at: string;
      status: string;
      clients: { first_name: string; last_name: string; phone: string } | null;
      services: { name: string } | null;
      professionals: { name: string } | null;
    }) => {
      const clientName = b.clients
        ? `${b.clients.first_name} ${b.clients.last_name}`.trim()
        : "";
      return [
        formatDate(b.scheduled_at),
        formatTime(b.scheduled_at),
        clientName,
        b.clients?.phone ?? "",
        b.services?.name ?? "",
        b.professionals?.name ?? "",
        BOOKING_STATUS_LABELS[b.status] ?? b.status,
      ].map(escapeCell);
    }
  );

  const csv = [header, ...rows].map((row) => row.join(",")).join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="citas.csv"`,
    },
  });
}
