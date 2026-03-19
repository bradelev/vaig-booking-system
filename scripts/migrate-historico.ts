/**
 * migrate-historico.ts
 *
 * Migrates historical data from two CSV files into Supabase:
 *   1. docs/clients_rows.csv         — ~771 clients from previous Supabase project
 *   2. "docs/Ingresos 2025.xlsx - Ingresos pacientes.csv" — ~2700 session rows
 *
 * Usage:
 *   npm install csv-parse fastest-levenshtein
 *   npx tsx scripts/migrate-historico.ts
 *
 * Requires .env.local (or process.env) with:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import { parse } from 'csv-parse/sync'
import { distance } from 'fastest-levenshtein'
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

// Load env from .env.local
config({ path: path.resolve(process.cwd(), '.env.local') })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

const CLIENTS_CSV = path.resolve(process.cwd(), 'docs/clients_rows.csv')
const INGRESOS_CSV = path.resolve(
  process.cwd(),
  'docs/Ingresos 2025.xlsx - Ingresos pacientes.csv'
)
const ERRORS_CSV = path.resolve(process.cwd(), 'scripts/migration-errors.csv')

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0300-\u036f]/g, '') // strip combining diacritics
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '')
}

function parseMontoUY(raw: string): number | null {
  if (!raw || raw.trim() === '' || raw.trim() === '-') return null
  // Remove "$", ".", then replace "," with "."
  const cleaned = raw.replace(/\$/g, '').replace(/\./g, '').replace(/,/g, '.').trim()
  const n = parseFloat(cleaned)
  return isNaN(n) ? null : n
}

/** Parse "2/10" → { n: 2, total: 10 } */
function parseSesionFrac(val: string): { n: number; total: number } | null {
  const m = val.match(/(\d+)\s*\/\s*(\d+)/)
  if (!m) return null
  return { n: parseInt(m[1]), total: parseInt(m[2]) }
}

function normalizeMetodoPago(raw: string): string {
  const v = raw.toLowerCase().trim()
  if (v.includes('transfer')) return 'transferencia'
  if (v.includes('efectivo') || v.includes('cash')) return 'efectivo'
  if (v.includes('cuponera') || v.includes('cupon')) return 'cuponera'
  if (v.includes('mercadopago') || v.includes('mp')) return 'mercadopago'
  if (v.includes('canje')) return 'canje'
  if (v === '' || v === '-' || v === 'n/a') return 'otro'
  return v
}

// ---------------------------------------------------------------------------
// Error tracking
// ---------------------------------------------------------------------------

interface ErrorRow {
  source: string
  row: string
  motivo: string
}
const errors: ErrorRow[] = []

function logError(source: string, row: string, motivo: string) {
  errors.push({ source, row, motivo })
}

// ---------------------------------------------------------------------------
// PASO 1 — Migrate clients from clients_rows.csv
// ---------------------------------------------------------------------------

interface ClientsCSVRow {
  id: string
  name: string
  phone: string
  email: string
  notes: string
  total_visits: string
  last_visit_at: string
  created_at: string
  updated_at: string
}

interface ClientRecord {
  id?: string
  first_name: string
  last_name: string
  phone: string
  email: string | null
  notes: string | null
  source: string
  es_historico: boolean
  nombre_normalizado: string
}

async function paso1MigrateClients(): Promise<{
  phoneToId: Map<string, string>
  nombreToId: Map<string, string>
  inserted: number
  existing: number
}> {
  console.log('\n=== PASO 1: Migrating clients from clients_rows.csv ===')

  const raw = fs.readFileSync(CLIENTS_CSV, 'utf-8')
  const rows: ClientsCSVRow[] = parse(raw, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  })

  console.log(`  Read ${rows.length} rows from CSV`)

  const phoneToId = new Map<string, string>()
  const nombreToId = new Map<string, string>()
  let inserted = 0
  let existing = 0

  // Fetch existing phones from DB in one query
  const { data: existingClients } = await supabase
    .from('clients')
    .select('id, phone, nombre_normalizado')

  const dbPhoneMap = new Map<string, string>()
  const dbNombreMap = new Map<string, string>()
  for (const c of existingClients ?? []) {
    if (c.phone) dbPhoneMap.set(normalizePhone(c.phone), c.id)
    if (c.nombre_normalizado) dbNombreMap.set(c.nombre_normalizado, c.id)
  }

  for (const row of rows) {
    const nameParts = (row.name ?? '').trim().split(/\s+/)
    const first_name = nameParts[0] ?? row.name
    const last_name = nameParts.slice(1).join(' ') || ''
    const nombre_normalizado = normalizeName(row.name ?? '')
    const phone = normalizePhone(row.phone ?? '')
    const email = row.email ? row.email.toLowerCase().trim() : null

    // Check for duplicate by phone
    if (phone && dbPhoneMap.has(phone)) {
      const existingId = dbPhoneMap.get(phone)!
      phoneToId.set(phone, existingId)
      nombreToId.set(nombre_normalizado, existingId)
      existing++
      continue
    }

    // Check for duplicate by nombre_normalizado
    if (dbNombreMap.has(nombre_normalizado)) {
      const existingId = dbNombreMap.get(nombre_normalizado)!
      if (phone) phoneToId.set(phone, existingId)
      nombreToId.set(nombre_normalizado, existingId)
      existing++
      continue
    }

    // Insert new client
    const record: ClientRecord = {
      first_name,
      last_name,
      phone: phone || `migrated_nophone_${row.id}`, // phone is NOT NULL UNIQUE
      email,
      notes: row.notes || null,
      source: 'migrated',
      es_historico: true,
      nombre_normalizado,
    }

    const { data, error } = await supabase
      .from('clients')
      .insert(record)
      .select('id')
      .single()

    if (error) {
      logError('clients_csv', row.id, error.message)
      continue
    }

    const newId = data.id
    if (phone) {
      phoneToId.set(phone, newId)
      dbPhoneMap.set(phone, newId)
    }
    nombreToId.set(nombre_normalizado, newId)
    dbNombreMap.set(nombre_normalizado, newId)
    inserted++
  }

  console.log(`  Inserted: ${inserted}, Already existed: ${existing}`)
  return { phoneToId, nombreToId, inserted, existing }
}

// ---------------------------------------------------------------------------
// PASO 2+3 — Normalize sheet names + upsert clients from ingresos CSV
// ---------------------------------------------------------------------------

interface IngresosCSVRow {
  dia: string
  'Fecha Original': string
  Fecha: string
  'Anio-Mes': string
  Paciente: string
  'Tipo de Servicio': string
  'Descripción del servicio realizado': string
  'Atendido por:': string
  'Monto del servicio': string
  'Descuento aplicado': string
  'Monto cobrado': string
  'Metodo de pago': string
  'Forma de pago': string
  Comentarios: string
  [key: string]: string
}

/** Group names by fuzzy similarity using Levenshtein */
function groupNombresFuzzy(
  nombres: string[]
): Map<string, string[]> {
  const THRESHOLD = 3 // max edit distance to consider same person (with 2+ words)

  const groups: Map<string, string[]> = new Map()
  const assigned = new Set<string>()

  for (const nombre of nombres) {
    if (assigned.has(nombre)) continue

    const group = [nombre]
    assigned.add(nombre)

    // Only apply fuzzy to multi-word names (has last name)
    const hasLastName = nombre.split(' ').length >= 2

    for (const other of nombres) {
      if (assigned.has(other)) continue
      const otherHasLastName = other.split(' ').length >= 2
      if (!hasLastName || !otherHasLastName) continue

      const dist = distance(nombre, other)
      if (dist <= THRESHOLD && dist > 0) {
        group.push(other)
        assigned.add(other)
      }
    }

    groups.set(nombre, group)
  }

  return groups
}

/** Returns the canonical name (most frequent variant in the group) */
function canonicalName(
  group: string[],
  freqMap: Map<string, number>
): string {
  return group.sort(
    (a, b) => (freqMap.get(b) ?? 0) - (freqMap.get(a) ?? 0)
  )[0]
}

async function paso23UpsertIngresosClients(
  existingNombreToId: Map<string, string>
): Promise<{
  nombreToId: Map<string, string>
  inserted: number
  existing: number
  canonicalMap: Map<string, string> // rawNorm → canonical
}> {
  console.log('\n=== PASO 2+3: Normalize + upsert clients from ingresos CSV ===')

  const raw = fs.readFileSync(INGRESOS_CSV, 'utf-8')
  // The CSV header spans two lines; csv-parse relax_column_count handles extra cols
  const rows: IngresosCSVRow[] = parse(raw, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
  })

  console.log(`  Read ${rows.length} rows from ingresos CSV`)

  // Build frequency map of normalized names
  const freqMap = new Map<string, number>()
  for (const row of rows) {
    const norm = normalizeName(row.Paciente ?? '')
    if (!norm) continue
    freqMap.set(norm, (freqMap.get(norm) ?? 0) + 1)
  }

  const uniqueNombres = Array.from(freqMap.keys())
  console.log(`  Unique normalized names: ${uniqueNombres.length}`)

  // Fuzzy group
  const groups = groupNombresFuzzy(uniqueNombres)

  // Build rawNorm → canonical map
  const canonicalMap = new Map<string, string>()
  for (const [representative, group] of groups) {
    const canon = canonicalName(group, freqMap)
    for (const variant of group) {
      canonicalMap.set(variant, canon)
    }
    // Also map representative itself
    canonicalMap.set(representative, canon)
  }

  // Fetch current DB state
  const { data: existingClients } = await supabase
    .from('clients')
    .select('id, nombre_normalizado')

  const dbNombreMap = new Map<string, string>(existingNombreToId)
  for (const c of existingClients ?? []) {
    if (c.nombre_normalizado && !dbNombreMap.has(c.nombre_normalizado)) {
      dbNombreMap.set(c.nombre_normalizado, c.id)
    }
  }

  let inserted = 0
  let existing = 0
  const nombreToId = new Map<string, string>(existingNombreToId)

  // Process each unique canonical name
  const processedCanonicals = new Set<string>()

  for (const rawNorm of uniqueNombres) {
    const canon = canonicalMap.get(rawNorm) ?? rawNorm

    if (processedCanonicals.has(canon)) continue
    processedCanonicals.add(canon)

    // Check if exists in DB
    if (dbNombreMap.has(canon)) {
      const existingId = dbNombreMap.get(canon)!
      nombreToId.set(canon, existingId)
      existing++
      continue
    }

    // Parse name parts from canonical
    const parts = canon.split(' ')
    const first_name = parts[0]
    const last_name = parts.slice(1).join(' ') || ''

    const { data, error } = await supabase
      .from('clients')
      .insert({
        first_name,
        last_name,
        phone: `historico_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        email: null,
        source: 'migrated',
        es_historico: true,
        nombre_normalizado: canon,
      })
      .select('id')
      .single()

    if (error) {
      logError('ingresos_csv_client', canon, error.message)
      continue
    }

    nombreToId.set(canon, data.id)
    dbNombreMap.set(canon, data.id)
    inserted++
  }

  console.log(`  Inserted: ${inserted}, Already existed: ${existing}`)
  return { nombreToId, inserted, existing, canonicalMap }
}

// ---------------------------------------------------------------------------
// PASO 4 — Insert sesiones_historicas
// ---------------------------------------------------------------------------

async function paso4InsertSesiones(
  nombreToId: Map<string, string>,
  canonicalMap: Map<string, string>
): Promise<{ inserted: number; skipped: number }> {
  console.log('\n=== PASO 4: Inserting sesiones_historicas ===')

  const raw = fs.readFileSync(INGRESOS_CSV, 'utf-8')
  const rows: IngresosCSVRow[] = parse(raw, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
  })

  let inserted = 0
  let skipped = 0

  // Batch inserts for performance
  const BATCH_SIZE = 50
  const batch: object[] = []

  const flush = async () => {
    if (batch.length === 0) return
    const { error } = await supabase
      .from('sesiones_historicas')
      .insert(batch)

    if (error) {
      // Try row-by-row to isolate conflicts
      for (const row of batch) {
        const { error: rowErr } = await supabase
          .from('sesiones_historicas')
          .insert(row)
        if (rowErr) {
          if (rowErr.code === '23505') {
            // unique violation — already exists, skip
            skipped++
          } else {
            logError('sesiones', JSON.stringify(row).slice(0, 80), rowErr.message)
            skipped++
          }
        } else {
          inserted++
        }
      }
    } else {
      inserted += batch.length
    }
    batch.length = 0
  }

  for (const row of rows) {
    const rawFecha = row.Fecha?.trim()
    if (!rawFecha || rawFecha === '') {
      logError('sesiones', row.dia, 'Fecha vacía')
      skipped++
      continue
    }

    const fecha = new Date(rawFecha)
    if (isNaN(fecha.getTime())) {
      logError('sesiones', row.dia, `Fecha inválida: ${rawFecha}`)
      skipped++
      continue
    }

    const rawNombre = normalizeName(row.Paciente ?? '')
    if (!rawNombre) {
      logError('sesiones', row.dia, 'Paciente vacío')
      skipped++
      continue
    }

    const canon = canonicalMap.get(rawNombre) ?? rawNombre
    const clientId = nombreToId.get(canon)
    if (!clientId) {
      logError('sesiones', row.dia, `Cliente no encontrado: ${canon}`)
      skipped++
      continue
    }

    const tipoServicio = (row['Tipo de Servicio'] ?? '').trim()
    if (!tipoServicio) {
      logError('sesiones', row.dia, 'Tipo de servicio vacío')
      skipped++
      continue
    }

    const descripcion = (row['Descripción del servicio realizado'] ?? '').trim() || null
    const operadora = (row['Atendido por:'] ?? '').trim() || null
    const monto_lista = parseMontoUY(row['Monto del servicio'])
    const monto_cobrado = parseMontoUY(row['Monto cobrado'])

    // Calculate discount percentage
    let descuento_pct: number | null = null
    if (monto_lista && monto_cobrado && monto_lista > 0) {
      descuento_pct = Math.round(((monto_lista - monto_cobrado) / monto_lista) * 100 * 100) / 100
    }

    const metodo_pago = row['Metodo de pago']
      ? normalizeMetodoPago(row['Metodo de pago'])
      : null
    const banco = (row['Forma de pago'] ?? '').trim() || null
    const notas = (row.Comentarios ?? '').trim() || null

    // Parse sesion fractions from descripcion (e.g. "cuponera 2/10")
    let sesion_n: number | null = null
    let sesion_total_cuponera: number | null = null
    if (descripcion) {
      const frac = parseSesionFrac(descripcion)
      if (frac) {
        sesion_n = frac.n
        sesion_total_cuponera = frac.total
      }
    }

    batch.push({
      client_id: clientId,
      fecha: rawFecha,
      tipo_servicio: tipoServicio,
      descripcion,
      operadora,
      monto_lista,
      descuento_pct,
      monto_cobrado,
      metodo_pago,
      banco,
      sesion_n,
      sesion_total_cuponera,
      notas,
      fuente: 'sheet_historico',
    })

    if (batch.length >= BATCH_SIZE) {
      await flush()
    }
  }

  await flush()

  console.log(`  Inserted: ${inserted}, Skipped: ${skipped}`)
  return { inserted, skipped }
}

// ---------------------------------------------------------------------------
// PASO 5 — Output errors CSV
// ---------------------------------------------------------------------------

function writeErrorsCSV() {
  if (errors.length === 0) {
    console.log('\n✓ No errors to write')
    return
  }

  const lines = [
    'source,row,motivo',
    ...errors.map(e =>
      [e.source, e.row, e.motivo]
        .map(v => `"${String(v).replace(/"/g, '""')}"`)
        .join(',')
    ),
  ]
  fs.writeFileSync(ERRORS_CSV, lines.join('\n'), 'utf-8')
  console.log(`\n⚠ ${errors.length} errors written to ${ERRORS_CSV}`)
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('=== migrate-historico.ts ===')
  console.log(`Supabase URL: ${SUPABASE_URL}`)

  // Paso 1: Migrate clients from CSV
  const { phoneToId, nombreToId: nombreToIdFromCsv } =
    await paso1MigrateClients()

  // Paso 2+3: Normalize ingresos names + upsert
  const { nombreToId, canonicalMap } =
    await paso23UpsertIngresosClients(nombreToIdFromCsv)

  // Paso 4: Insert sesiones
  const { inserted: sesInserted, skipped: sesSkipped } =
    await paso4InsertSesiones(nombreToId, canonicalMap)

  // Paso 5: Write errors
  writeErrorsCSV()

  console.log('\n=== RESUMEN ===')
  console.log(`Sesiones históricas insertadas: ${sesInserted}`)
  console.log(`Sesiones saltadas:              ${sesSkipped}`)
  console.log(`Errores totales:                ${errors.length}`)

  // Suppress unused var warning for phoneToId (kept for potential future use)
  void phoneToId
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
