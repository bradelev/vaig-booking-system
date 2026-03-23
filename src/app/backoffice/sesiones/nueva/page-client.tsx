"use client";

import { useRouter } from "next/navigation";
import SessionForm, { type Professional } from "@/components/backoffice/sesiones/session-form";
import DaySessionsTable from "@/components/backoffice/sesiones/day-sessions-table";
import { type BookingToConfirm } from "@/components/backoffice/sesiones/confirm-booking-modal";

interface BookingItem {
  id: string;
  scheduledAt: string;
  status: string;
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
  clientName: string;
  clientSource?: string;
}

interface SessionsPageClientProps {
  professionals: Professional[];
  serviceCategories: string[];
  initialDate: string;
  bookings: BookingItem[];
  sesiones: SesionItem[];
}

function formatTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Argentina/Buenos_Aires",
  });
}

export default function SessionsPageClient({
  professionals,
  serviceCategories,
  initialDate,
  bookings,
  sesiones,
}: SessionsPageClientProps) {
  const router = useRouter();

  function handleDateChange(date: string) {
    router.push(`/backoffice/sesiones/nueva?fecha=${date}`);
  }

  // Build unified table rows
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
          serviceName: b.serviceName,
          scheduledAt: b.scheduledAt,
          professionalName: b.professionalName,
          professionalId: b.professionalId,
        } as BookingToConfirm,
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
      source: (s.fuente === "backoffice" ? "backoffice" : "system") as "backoffice" | "system",
      clientName: s.clientName,
      tipoServicio: s.tipoServicio,
      descripcion: s.descripcion,
      operadora: s.operadora,
      montoCobrado: s.montoCobrado,
      metodoPago: s.metodoPago,
      clientSource: s.clientSource,
      time: undefined,
      isPendingBooking: false,
      bookingData: undefined,
    })),
  ];

  const dateFormatted = new Date(initialDate + "T12:00:00").toLocaleDateString("es-AR", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="max-w-5xl mx-auto space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Registrar sesión</h1>
        <p className="text-sm text-gray-500 mt-1">
          Registrá sesiones manuales y confirmá citas del sistema
        </p>
      </div>

      {/* Form card */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 sm:p-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Nueva sesión</h2>
        <SessionForm
          professionals={professionals}
          serviceCategories={serviceCategories}
          initialDate={initialDate}
          onDateChange={handleDateChange}
        />
      </div>

      {/* Day sessions card */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-700">
            Sesiones del día
          </h2>
          <span className="text-xs text-gray-400 capitalize">{dateFormatted}</span>
        </div>
        {tableRows.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-6">
            No hay sesiones para este día
          </p>
        ) : (
          <DaySessionsTable sessions={tableRows} />
        )}
      </div>
    </div>
  );
}
