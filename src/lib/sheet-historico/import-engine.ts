/**
 * Sheet Historico import engine
 *
 * Imports historical session data from Google Sheets "Ingresos pacientes"
 * spreadsheet into the sesiones_historicas table.
 *
 * - Fetches XLSX directly from public Google Sheets export URL
 * - Client resolution by name: exact → includes → word overlap
 * - Unmatched clients created with HIST-NNNN placeholder phone
 * - Idempotent: duplicate rows (client_id + fecha + tipo_servicio + descripcion) skipped
 * - Per-row error handling — never aborts batch
 */

import ExcelJS from "exceljs";
import { createAdminClient } from "@/lib/supabase/admin";

const SHEET_EXPORT_URL =
  "https://docs.google.com/spreadsheets/d/1WMzhgTMYu3Qt4O1zErtNU3DAe5P7pFI_/export?format=xlsx&sheet=Ingresos%20pacientes";

export interface SheetSyncResult {
  imported: number;
  skipped: number;
  errors: string[];
  clientsCreated: string[];
}

/** Operadora abbreviation → full name */
const OPERADORA_MAP: Record<string, string> = {
  cyn: "Cynthia",
  lu: "Lucia",
  mica: "Micaela",
  ste: "Stephany",
  angel: "Angel",
  iara: "Iara Machado",
};

/** Strip "$", spaces, commas → parseFloat. Returns null for empty/NaN. */
function parseMoney(raw: unknown): number | null {
  if (raw == null) return null;
  const str = String(raw).replace(/[$\s,]/g, "").trim();
  if (!str) return null;
  const n = parseFloat(str);
  return isNaN(n) ? null : n;
}

/** Lowercase, trim, collapse whitespace */
function normalize(s: string): string {
  return s.toLowerCase().trim().replace(/\s+/g, " ");
}

/** Title case: "gabriela frankel" → "Gabriela Frankel" */
function titleCase(s: string): string {
  return s
    .trim()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

/** Map operadora abbreviation to full name */
function mapOperadora(raw: unknown): string | null {
  if (raw == null) return null;
  const str = String(raw).trim();
  if (!str) return null;
  return OPERADORA_MAP[str.toLowerCase()] ?? str;
}

/** Build notas from descuento (col 10) and comentarios (col 15) */
function buildNotas(descuento: unknown, comentarios: unknown): string | null {
  const parts: string[] = [];
  const desc = descuento != null ? String(descuento).trim() : "";
  const com = comentarios != null ? String(comentarios).trim() : "";
  if (desc) parts.push(`Descuento: ${desc}`);
  if (com) parts.push(com);
  return parts.length > 0 ? parts.join(" | ") : null;
}

/** Get cell value as string or null */
function cellStr(row: ExcelJS.Row, col: number): string | null {
  const cell = row.getCell(col);
  if (cell.value == null) return null;
  const str = String(cell.value).trim();
  return str || null;
}

interface ClientRecord {
  id: string;
  normalized: string;
  firstName: string;
  lastName: string;
}

/**
 * Three-tier client name matching:
 * 1. Exact normalized match
 * 2. Includes (one name contains the other)
 * 3. Word overlap (≥2 shared words)
 */
function findClientByName(
  name: string,
  clients: ClientRecord[]
): ClientRecord | null {
  const norm = normalize(name);

  // 1. Exact match
  const exact = clients.find((c) => c.normalized === norm);
  if (exact) return exact;

  // 2. Includes match
  const includes = clients.find(
    (c) => c.normalized.includes(norm) || norm.includes(c.normalized)
  );
  if (includes) return includes;

  // 3. Word overlap (≥2 words)
  const words = norm.split(" ").filter(Boolean);
  if (words.length < 2) return null;

  let bestMatch: ClientRecord | null = null;
  let bestOverlap = 0;
  for (const c of clients) {
    const cWords = c.normalized.split(" ").filter(Boolean);
    const overlap = words.filter((w) =>
      cWords.some((cw) => cw === w || cw.includes(w) || w.includes(cw))
    ).length;
    if (overlap >= 2 && overlap > bestOverlap) {
      bestOverlap = overlap;
      bestMatch = c;
    }
  }
  return bestMatch;
}

/** Generate next HIST-NNNN phone placeholder */
function nextHistPhone(existingCount: number): string {
  return `HIST-${String(existingCount + 1).padStart(4, "0")}`;
}

export async function syncSheetHistorico(): Promise<SheetSyncResult> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createAdminClient() as any;

  const result: SheetSyncResult = {
    imported: 0,
    skipped: 0,
    errors: [],
    clientsCreated: [],
  };

  // 1. Fetch XLSX
  const response = await fetch(SHEET_EXPORT_URL);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch spreadsheet: ${response.status} ${response.statusText}`
    );
  }
  const arrayBuffer = await response.arrayBuffer();

  // 2. Parse with ExcelJS
  const workbook = new ExcelJS.Workbook();
  // ExcelJS .load() accepts ArrayBuffer at runtime; cast needed for Node 22 Buffer types
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await workbook.xlsx.load(arrayBuffer as any);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new Error("No worksheet found in the XLSX file");
  }

  // 3. Find header row (scan for row containing "Paciente")
  let headerRowNum = 0;
  worksheet.eachRow((row, rowNumber) => {
    if (headerRowNum > 0) return;
    row.eachCell((cell) => {
      if (
        cell.value != null &&
        String(cell.value).trim().toLowerCase() === "paciente"
      ) {
        headerRowNum = rowNumber;
      }
    });
  });
  if (headerRowNum === 0) {
    throw new Error('Could not find header row containing "Paciente"');
  }

  // 4. Pre-fetch clients
  const { data: clientsRaw } = await db
    .from("clients")
    .select("id, first_name, last_name, nombre_normalizado");
  const clients: ClientRecord[] = (clientsRaw ?? []).map(
    (c: {
      id: string;
      first_name: string;
      last_name: string;
      nombre_normalizado: string | null;
    }) => ({
      id: c.id,
      normalized:
        c.nombre_normalizado ?? normalize(`${c.first_name} ${c.last_name}`),
      firstName: c.first_name,
      lastName: c.last_name,
    })
  );

  // Count existing HIST- phones to generate unique placeholders
  const { count: histCount } = await db
    .from("clients")
    .select("id", { count: "exact", head: true })
    .like("phone", "HIST-%");
  let histCounter = histCount ?? 0;

  // 5. Pre-fetch existing sesiones_historicas for idempotency
  const { data: existingRows } = await db
    .from("sesiones_historicas")
    .select("client_id, fecha, tipo_servicio, descripcion")
    .eq("fuente", "sheet_historico");
  const existingSet = new Set<string>(
    (
      existingRows ??
      ([] as Array<{
        client_id: string;
        fecha: string;
        tipo_servicio: string;
        descripcion: string | null;
      }>)
    ).map(
      (r: {
        client_id: string;
        fecha: string;
        tipo_servicio: string;
        descripcion: string | null;
      }) =>
        `${r.client_id}|${r.fecha}|${r.tipo_servicio}|${r.descripcion ?? ""}`
    )
  );

  // 6. Process data rows
  const totalRows = worksheet.rowCount;
  for (let rowNum = headerRowNum + 1; rowNum <= totalRows; rowNum++) {
    const row = worksheet.getRow(rowNum);

    try {
      // Column 3 = Fecha (YYYY-MM-DD)
      const fechaRaw = cellStr(row, 3);
      if (!fechaRaw || !/^\d{4}-\d{2}-\d{2}$/.test(fechaRaw)) continue;
      const fecha = fechaRaw;

      // Column 5 = Paciente
      const paciente = cellStr(row, 5);
      if (!paciente) {
        result.errors.push(`Row ${rowNum}: missing Paciente`);
        continue;
      }

      // Resolve client
      const clientMatch = findClientByName(paciente, clients);
      let clientId: string;

      if (clientMatch) {
        clientId = clientMatch.id;
      } else {
        // Create new client with placeholder phone
        const nameParts = titleCase(paciente).split(/\s+/);
        const firstName = nameParts[0];
        const lastName = nameParts.slice(1).join(" ") || ".";
        const phone = nextHistPhone(histCounter);
        histCounter++;

        const { data: newClient, error: insertErr } = await db
          .from("clients")
          .insert({
            first_name: firstName,
            last_name: lastName,
            phone,
            es_historico: true,
            source: "sheet_historico",
            nombre_normalizado: normalize(paciente),
          })
          .select("id")
          .single();

        if (insertErr || !newClient) {
          result.errors.push(
            `Row ${rowNum}: failed to create client "${paciente}" — ${insertErr?.message ?? "unknown error"}`
          );
          continue;
        }

        clientId = newClient.id;
        result.clientsCreated.push(titleCase(paciente));

        // Add to in-memory client list for subsequent rows
        clients.push({
          id: clientId,
          normalized: normalize(paciente),
          firstName,
          lastName,
        });
      }

      // Map columns
      const tipoServicio = cellStr(row, 6);
      if (!tipoServicio) {
        result.errors.push(`Row ${rowNum}: missing Tipo de Servicio`);
        continue;
      }
      const descripcion = cellStr(row, 7);
      const operadora = mapOperadora(cellStr(row, 8));
      const montoLista = parseMoney(row.getCell(9).value);
      const montoCobrado = parseMoney(row.getCell(11).value);
      const metodoPago = cellStr(row, 12);
      const banco = cellStr(row, 13);
      const notas = buildNotas(cellStr(row, 10), cellStr(row, 15));

      // Idempotency check
      const dedupKey = `${clientId}|${fecha}|${tipoServicio}|${descripcion ?? ""}`;
      if (existingSet.has(dedupKey)) {
        result.skipped++;
        continue;
      }

      // Insert
      const { error: insertError } = await db
        .from("sesiones_historicas")
        .insert({
          client_id: clientId,
          fecha,
          tipo_servicio: tipoServicio,
          descripcion,
          operadora,
          monto_lista: montoLista,
          monto_cobrado: montoCobrado,
          metodo_pago: metodoPago,
          banco,
          notas,
          fuente: "sheet_historico",
        });

      if (insertError) {
        result.errors.push(`Row ${rowNum}: ${insertError.message}`);
        continue;
      }

      // Track for idempotency within same run
      existingSet.add(dedupKey);
      result.imported++;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      result.errors.push(`Row ${rowNum}: ${msg}`);
    }
  }

  return result;
}
