"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import SessionForm, { type Professional } from "@/components/backoffice/sesiones/session-form";
import DaySessionsTable, { type PendingBookingData } from "@/components/backoffice/sesiones/day-sessions-table";
import Modal from "@/components/backoffice/modal";

interface BookingItem {
  id: string;
  scheduledAt: string;
  status: string;
  clientId?: string;
  clientName: string;
  serviceName: string;
  serviceCategory: string;
  professionalName?: string;
  professionalId?: string;
  clientSource?: string;
  alreadyConfirmed: boolean;
}

interface SesionItem {
  id: string;
  tipoServicio: string;
  descripcion?: string;
  operadora?: string;
  montoCobrado?: number;
  metodoPago?: string;
  fuente: string;
  montoLista?: number;
  descuentoPct?: number;
  banco?: string;
  sesionN?: number;
  sesionTotal?: number;
  notas?: string;
  professionalId?: string;
  clientName: string;
  clientSource?: string;
}

interface ServiceOption {
  id: string;
  name: string;
  category: string | null;
  price: number;
}

interface SessionsPageClientProps {
  professionals: Professional[];
  serviceCategories: string[];
  services: ServiceOption[];
  weekDates: string[]; // 7 items, Mon..Sun, YYYY-MM-DD
  bookingsByDate: Record<string, BookingItem[]>;
  sesionesByDate: Record<string, SesionItem[]>;
}

const DAY_LABELS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

function formatTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Argentina/Buenos_Aires",
  });
}

/** Returns YYYY-MM-DD for today in Argentina TZ */
function todayAR(): string {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "America/Argentina/Buenos_Aires" });
}

/** Add N days to a YYYY-MM-DD string */
function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().split("T")[0];
}

/** Format a date as DD/MM */
function formatDDMM(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}`;
}

export default function SessionsPageClient({
  professionals,
  serviceCategories,
  services,
  weekDates,
  bookingsByDate,
  sesionesByDate,
}: SessionsPageClientProps) {
  const router = useRouter();
  const today = todayAR();

  // Determine the default active tab: today if in week, else Monday
  const todayIdx = weekDates.indexOf(today);
  const [activeTab, setActiveTab] = useState<number>(todayIdx >= 0 ? todayIdx : 0);

  // Export modal state
  const [showExport, setShowExport] = useState(false);
  const currentYear = new Date().getFullYear();
  const [exportFrom, setExportFrom] = useState(`${currentYear}-01-01`);
  const [exportTo, setExportTo] = useState(`${currentYear}-12-31`);

  // Sheet sync state
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{
    imported: number;
    skipped: number;
    errors: string[];
    clientsCreated: string[];
  } | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  async function handleSheetSync() {
    setSyncing(true);
    setSyncResult(null);
    setSyncError(null);
    try {
      const res = await fetch("/api/internal/sheet-sync", { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? `Error ${res.status}`);
      }
      const data = await res.json();
      setSyncResult(data);
    } catch (err: unknown) {
      setSyncError(err instanceof Error ? err.message : String(err));
    } finally {
      setSyncing(false);
    }
  }

  const weekMonday = weekDates[0];
  const weekSunday = weekDates[6];

  function goToPrevWeek() {
    router.push(`/backoffice/sesiones/nueva?semana=${addDays(weekMonday, -7)}`);
  }

  function goToNextWeek() {
    router.push(`/backoffice/sesiones/nueva?semana=${addDays(weekMonday, 7)}`);
  }

  function goToCurrentWeek() {
    router.push(`/backoffice/sesiones/nueva`);
  }

  function handleExport() {
    window.location.href = `/api/sesiones/export?from=${exportFrom}&to=${exportTo}`;
  }

  // Build session rows for the active date
  const activeDate = weekDates[activeTab];
  const bookings = bookingsByDate[activeDate] ?? [];
  const sesiones = sesionesByDate[activeDate] ?? [];

  const tableRows = [
    // Pending bookings (not yet confirmed as session)
    ...bookings
      .filter((b) => b.status !== "realized" && !b.alreadyConfirmed)
      .map((b) => ({
        id: `booking-${b.id}`,
        source: "system" as const,
        clientName: b.clientName,
        tipoServicio: b.serviceCategory,
        descripcion: b.serviceName !== b.serviceCategory ? b.serviceName : undefined,
        operadora: b.professionalName,
        montoCobrado: undefined,
        metodoPago: undefined,
        clientSource: b.clientSource,
        time: formatTime(b.scheduledAt),
        isPendingBooking: true,
        bookingData: {
          id: b.id,
          clientName: b.clientName,
          clientId: b.clientId,
          serviceName: b.serviceName,
          serviceCategory: b.serviceCategory,
          scheduledAt: b.scheduledAt,
          professionalName: b.professionalName,
          professionalId: b.professionalId,
        } as PendingBookingData,
      })),

    // Realized bookings (already confirmed)
    ...bookings
      .filter((b) => b.status === "realized" && !b.alreadyConfirmed)
      .map((b) => ({
        id: `booking-realized-${b.id}`,
        source: "system" as const,
        clientName: b.clientName,
        tipoServicio: b.serviceCategory,
        descripcion: b.serviceName !== b.serviceCategory ? b.serviceName : undefined,
        operadora: b.professionalName,
        montoCobrado: undefined,
        metodoPago: undefined,
        clientSource: b.clientSource,
        time: formatTime(b.scheduledAt),
        isPendingBooking: false,
        bookingData: undefined,
      })),

    // Manual sessions from backoffice
    ...sesiones.map((s) => ({
      id: `session-${s.id}`,
      sessionId: s.id,
      source: (s.fuente === "backoffice" ? "backoffice" : "system") as "backoffice" | "system",
      clientName: s.clientName,
      tipoServicio: s.tipoServicio,
      descripcion: s.descripcion,
      operadora: s.operadora,
      montoCobrado: s.montoCobrado,
      metodoPago: s.metodoPago,
      montoLista: s.montoLista,
      descuentoPct: s.descuentoPct,
      banco: s.banco,
      sesionN: s.sesionN,
      sesionTotal: s.sesionTotal,
      notas: s.notas,
      professionalId: s.professionalId,
      clientSource: s.clientSource,
      time: undefined,
      isPendingBooking: false,
      bookingData: undefined,
    })),
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-6 p-4 sm:p-6">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Registrar sesión</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Registrá sesiones manuales y confirmá citas del sistema
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleSheetSync}
            disabled={syncing}
            className="shrink-0 rounded-lg border border-input px-3 py-2 text-sm font-medium text-foreground hover:bg-accent transition-colors disabled:opacity-50"
          >
            {syncing ? "Sincronizando..." : "Importar Sheet"}
          </button>
          <button
            onClick={() => setShowExport(true)}
            className="shrink-0 rounded-lg border border-input px-3 py-2 text-sm font-medium text-foreground hover:bg-accent transition-colors"
          >
            Exportar XLSX
          </button>
        </div>
      </div>

      {/* Sheet sync result */}
      {(syncResult || syncError) && (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            syncError
              ? "border-destructive/50 bg-destructive/10 text-destructive"
              : "border-border bg-card text-foreground"
          }`}
        >
          {syncError && <p>Error al sincronizar: {syncError}</p>}
          {syncResult && (
            <div className="space-y-1">
              <p>
                Sync completado — <strong>{syncResult.imported}</strong>{" "}
                insertados, <strong>{syncResult.skipped}</strong> omitidos
                {syncResult.errors.length > 0 && (
                  <>, <strong className="text-destructive">{syncResult.errors.length}</strong> errores</>
                )}
              </p>
              {syncResult.clientsCreated.length > 0 && (
                <p className="text-muted-foreground">
                  Clientes nuevos: {syncResult.clientsCreated.join(", ")}
                </p>
              )}
              {syncResult.errors.length > 0 && (
                <details className="mt-1">
                  <summary className="cursor-pointer text-destructive text-xs">
                    Ver errores
                  </summary>
                  <ul className="mt-1 text-xs space-y-0.5 text-muted-foreground">
                    {syncResult.errors.map((e, i) => (
                      <li key={i}>{e}</li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          )}
        </div>
      )}

      {/* Week navigator */}
      <div className="flex items-center justify-between gap-2 rounded-xl border border-border bg-card px-4 py-3">
        <button
          onClick={goToPrevWeek}
          className="rounded border border-input px-3 py-1.5 text-sm hover:bg-accent transition-colors"
          aria-label="Semana anterior"
        >
          ← Anterior
        </button>

        <div className="text-center">
          <span className="text-sm font-medium text-foreground">
            Semana del {formatDDMM(weekMonday)} al {formatDDMM(weekSunday)}
          </span>
          {weekDates.includes(today) ? null : (
            <button
              onClick={goToCurrentWeek}
              className="ml-3 text-xs text-muted-foreground hover:text-foreground underline"
            >
              Ir a hoy
            </button>
          )}
        </div>

        <button
          onClick={goToNextWeek}
          className="rounded border border-input px-3 py-1.5 text-sm hover:bg-accent transition-colors"
          aria-label="Semana siguiente"
        >
          Siguiente →
        </button>
      </div>

      {/* Day tabs */}
      <div className="border-b border-border">
        <nav className="flex gap-0 overflow-x-auto" aria-label="Días de la semana">
          {weekDates.map((date, idx) => {
            const isActive = idx === activeTab;
            const isToday = date === today;
            const dayCount =
              (bookingsByDate[date]?.length ?? 0) + (sesionesByDate[date]?.length ?? 0);
            return (
              <button
                key={date}
                onClick={() => setActiveTab(idx)}
                className={`flex flex-col items-center px-3 py-2 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
                  isActive
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                }`}
              >
                <span className={isToday ? "font-bold text-primary" : ""}>
                  {DAY_LABELS[idx]} {formatDDMM(date)}
                </span>
                {dayCount > 0 && (
                  <span
                    className={`mt-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                      isActive ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {dayCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Form card */}
      <div className="rounded-xl border border-border bg-card p-4 sm:p-6">
        <h2 className="text-sm font-semibold text-foreground mb-4">Nueva sesión</h2>
        <SessionForm
          professionals={professionals}
          serviceCategories={serviceCategories}
          initialDate={activeDate}
          onDateChange={(date) => {
            // When date changes in form, switch to closest tab or navigate to that week
            const idx = weekDates.indexOf(date);
            if (idx >= 0) {
              setActiveTab(idx);
            } else {
              router.push(`/backoffice/sesiones/nueva?semana=${date}`);
            }
          }}
        />
      </div>

      {/* Day sessions card */}
      <div className="rounded-xl border border-border bg-card p-4 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-foreground">Sesiones del día</h2>
          <span className="text-xs text-muted-foreground">
            {DAY_LABELS[activeTab]} {formatDDMM(activeDate)}
            {activeDate === today && (
              <span className="ml-1 text-primary font-medium">(hoy)</span>
            )}
          </span>
        </div>
        {tableRows.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            No hay sesiones para este día
          </p>
        ) : (
          <DaySessionsTable
            sessions={tableRows}
            serviceCategories={serviceCategories}
            services={services}
            professionals={professionals}
          />
        )}
      </div>

      {/* Export Modal */}
      <Modal open={showExport} onClose={() => setShowExport(false)} title="Exportar sesiones XLSX">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Desde</label>
              <input
                type="date"
                value={exportFrom}
                onChange={(e) => setExportFrom(e.target.value)}
                className="w-full rounded-lg border border-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Hasta</label>
              <input
                type="date"
                value={exportTo}
                onChange={(e) => setExportTo(e.target.value)}
                className="w-full rounded-lg border border-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={() => setShowExport(false)}
              className="flex-1 rounded-lg border border-input px-4 py-2 text-sm font-medium text-foreground hover:bg-accent transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleExport}
              className="flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Exportar
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
