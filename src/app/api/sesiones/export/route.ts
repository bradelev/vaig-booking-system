import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from") ?? "2026-01-01";
  const to = searchParams.get("to") ?? "2026-12-31";

  const supabase = await createClient();

  const { data: rows, error } = await supabase
    .from("sesiones_historicas")
    .select(
      `id, fecha, tipo_servicio, descripcion, operadora, monto_cobrado, metodo_pago,
       banco, monto_lista, descuento_pct, sesion_n, sesion_total_cuponera, notas,
       clients(first_name, last_name)`
    )
    .gte("fecha", from)
    .lte("fecha", to)
    .order("fecha")
    .order("created_at");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  type SesionRow = {
    id: string;
    fecha: string;
    tipo_servicio: string;
    descripcion: string | null;
    operadora: string | null;
    monto_cobrado: number | null;
    metodo_pago: string | null;
    banco: string | null;
    monto_lista: number | null;
    descuento_pct: number | null;
    sesion_n: number | null;
    sesion_total_cuponera: number | null;
    notas: string | null;
    clients: { first_name: string; last_name: string } | null;
  };

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "VAIG Booking System";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Sesiones");

  sheet.columns = [
    { header: "Fecha", key: "fecha", width: 12 },
    { header: "Cliente", key: "cliente", width: 24 },
    { header: "Profesional / Operadora", key: "profesional", width: 22 },
    { header: "Tipo de servicio", key: "tipo_servicio", width: 22 },
    { header: "Descripción", key: "descripcion", width: 28 },
    { header: "Monto cobrado", key: "monto_cobrado", width: 16 },
    { header: "Método de pago", key: "metodo_pago", width: 18 },
    { header: "Banco", key: "banco", width: 14 },
    { header: "Monto lista", key: "monto_lista", width: 14 },
    { header: "Descuento %", key: "descuento_pct", width: 13 },
    { header: "Sesión N°", key: "sesion_n", width: 11 },
    { header: "Total sesiones", key: "sesion_total", width: 15 },
    { header: "Notas", key: "notas", width: 30 },
  ];

  // Style header row
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE5E7EB" },
  };
  headerRow.alignment = { vertical: "middle" };

  for (const row of (rows ?? []) as unknown as SesionRow[]) {
    const clientName = row.clients
      ? `${row.clients.first_name} ${row.clients.last_name}`
      : "—";

    sheet.addRow({
      fecha: row.fecha,
      cliente: clientName,
      profesional: row.operadora ?? "",
      tipo_servicio: row.tipo_servicio,
      descripcion: row.descripcion ?? "",
      monto_cobrado: row.monto_cobrado ?? "",
      metodo_pago: row.metodo_pago?.replace(/_/g, " ") ?? "",
      banco: row.banco ?? "",
      monto_lista: row.monto_lista ?? "",
      descuento_pct: row.descuento_pct ?? "",
      sesion_n: row.sesion_n ?? "",
      sesion_total: row.sesion_total_cuponera ?? "",
      notas: row.notas ?? "",
    });
  }

  // Auto-filter on header
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: sheet.columns.length },
  };

  const buffer = await workbook.xlsx.writeBuffer();

  const filename = `sesiones_${from}_${to}.xlsx`;

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
