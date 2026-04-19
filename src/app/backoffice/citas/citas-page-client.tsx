"use client";

import { useState } from "react";
import { LOCAL_TIMEZONE } from "@/lib/timezone";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Modal from "@/components/backoffice/modal";
import DayBookingsTable from "@/components/backoffice/citas/day-bookings-table";
import type { ComboboxItem } from "@/components/backoffice/agenda/combobox";
import type { BookingItem } from "./page";

interface CitasPageClientProps {
  weekDates: string[];
  bookingsByDate: Record<string, BookingItem[]>;
  allClients: ComboboxItem[];
  allServices: ComboboxItem[];
  allProfessionals: ComboboxItem[];
}

const DAY_LABELS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

function todayAR(): string {
  return new Date().toLocaleDateString("sv-SE", { timeZone: LOCAL_TIMEZONE });
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().split("T")[0];
}

function formatDDMM(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function CitasPageClient({
  weekDates,
  bookingsByDate,
  allClients,
  allServices,
  allProfessionals,
}: CitasPageClientProps) {
  const router = useRouter();
  const today = todayAR();

  const todayIdx = weekDates.indexOf(today);
  const [activeTab, setActiveTab] = useState<number>(todayIdx >= 0 ? todayIdx : 0);

  const [showSync, setShowSync] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{
    imported: number;
    skipped: number;
    errors: number;
    unmatched: number;
  } | null>(null);

  const weekMonday = weekDates[0];
  const weekSunday = weekDates[6];

  function goToPrevWeek() {
    router.push(`/backoffice/citas?semana=${addDays(weekMonday, -7)}`);
  }
  function goToNextWeek() {
    router.push(`/backoffice/citas?semana=${addDays(weekMonday, 7)}`);
  }
  function goToCurrentWeek() {
    router.push(`/backoffice/citas`);
  }

  async function handleSync() {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch("/api/internal/koobing-import", { method: "POST" });
      const data = await res.json();
      setSyncResult({
        imported: data.imported ?? 0,
        skipped: data.skipped ?? 0,
        errors: data.errors?.length ?? 0,
        unmatched: data.unmatched_service ?? 0,
      });
      if ((data.imported ?? 0) > 0) {
        router.refresh();
      }
    } catch {
      setSyncResult({ imported: 0, skipped: 0, errors: 1, unmatched: 0 });
    } finally {
      setSyncing(false);
    }
  }

  const activeDate = weekDates[activeTab];
  const dayBookings = bookingsByDate[activeDate] ?? [];

  return (
    <div className="max-w-6xl mx-auto space-y-6 p-4 sm:p-6">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Citas</h1>
          <p className="text-sm text-gray-500 mt-1">Vista semanal con edición inline</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => { setShowSync(true); setSyncResult(null); }}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Sincronizar Koobing
          </button>
          <Link
            href="/backoffice/citas/nueva"
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 transition-colors"
          >
            + Nueva cita
          </Link>
        </div>
      </div>

      {/* Week navigator */}
      <div className="flex items-center justify-between gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3">
        <button
          onClick={goToPrevWeek}
          className="rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 transition-colors"
          aria-label="Semana anterior"
        >
          ← Anterior
        </button>
        <div className="text-center">
          <span className="text-sm font-medium text-gray-800">
            Semana del {formatDDMM(weekMonday)} al {formatDDMM(weekSunday)}
          </span>
          {!weekDates.includes(today) && (
            <button
              onClick={goToCurrentWeek}
              className="ml-3 text-xs text-gray-400 hover:text-gray-600 underline"
            >
              Ir a hoy
            </button>
          )}
        </div>
        <button
          onClick={goToNextWeek}
          className="rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 transition-colors"
          aria-label="Semana siguiente"
        >
          Siguiente →
        </button>
      </div>

      {/* Day tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-0 overflow-x-auto" aria-label="Días de la semana">
          {weekDates.map((date, idx) => {
            const isActive = idx === activeTab;
            const isToday = date === today;
            const count = bookingsByDate[date]?.length ?? 0;
            return (
              <button
                key={date}
                onClick={() => setActiveTab(idx)}
                className={`flex flex-col items-center px-3 py-2 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
                  isActive
                    ? "border-gray-900 text-gray-900"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                <span className={isToday ? "font-bold text-blue-600" : ""}>
                  {DAY_LABELS[idx]} {formatDDMM(date)}
                </span>
                {count > 0 && (
                  <span
                    className={`mt-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                      isActive ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Day bookings */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-700">
            Citas del día
          </h2>
          <span className="text-xs text-gray-400">
            {DAY_LABELS[activeTab]} {formatDDMM(activeDate)}
            {activeDate === today && (
              <span className="ml-1 text-blue-500 font-medium">(hoy)</span>
            )}
          </span>
        </div>
        {dayBookings.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-6">
            No hay citas para este día
          </p>
        ) : (
          <DayBookingsTable
            bookings={dayBookings}
            allClients={allClients}
            allServices={allServices}
            allProfessionals={allProfessionals}
          />
        )}
      </div>

      {/* Koobing Sync Modal */}
      <Modal
        open={showSync}
        onClose={() => { if (!syncing) setShowSync(false); }}
        title="Sincronizar Koobing"
      >
        <div className="space-y-4">
          {!syncResult ? (
            <>
              <p className="text-sm text-gray-600">
                Se importarán todas las citas de Koobing desde julio 2024 hasta 90 días en el futuro.
                Las citas ya importadas se saltean. El cliente se crea automáticamente si no existe.
              </p>
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowSync(false)}
                  disabled={syncing}
                  className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSync}
                  disabled={syncing}
                  className="flex-1 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 transition-colors disabled:opacity-50"
                >
                  {syncing ? "Sincronizando..." : "Sincronizar"}
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="rounded-lg border border-gray-100 bg-gray-50 p-4 space-y-1 text-sm">
                <p><span className="font-medium text-green-700">Importadas:</span> {syncResult.imported}</p>
                <p><span className="font-medium text-gray-500">Salteadas (ya vinculadas):</span> {syncResult.skipped}</p>
                {syncResult.unmatched > 0 && (
                  <p><span className="font-medium text-amber-600">Sin servicio identificado:</span> {syncResult.unmatched}</p>
                )}
                {syncResult.errors > 0 && (
                  <p><span className="font-medium text-red-600">Errores:</span> {syncResult.errors}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setShowSync(false)}
                className="w-full rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 transition-colors"
              >
                Cerrar
              </button>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}
