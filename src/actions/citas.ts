"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { notifyClientCancellation } from "@/lib/bot/notifications";
import { notifyWaitlistForSlot } from "@/lib/bot/engine";
import { createBookingCalendarEvent, deleteBookingCalendarEvent } from "@/lib/gcal/bookings";
import { artLocalInputToISO } from "@/lib/timezone";
import { normalizePhone } from "@/lib/phone";
import { checkAdminRateLimit } from "@/lib/admin-rate-limit";
import { logger } from "@/lib/logger";
import { withRetry } from "@/lib/whatsapp/retry";
import { shouldIncrementSessionsUsed } from "@/lib/sessions-guard";

export type CancellationReason =
  | "client_request"
  | "professional_unavailable"
  | "scheduling_conflict"
  | "other";

export async function cancelBooking(
  id: string,
  reason: CancellationReason,
  note: string | null,
  cancelledBy: "admin" | "client"
) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const rl = await checkAdminRateLimit(user.id);
    if (!rl.allowed) throw new Error("Demasiadas solicitudes. Esperá un momento antes de continuar.");
  }

  type CancelBookingRow = {
    id: string;
    scheduled_at: string;
    service_id: string;
    professional_id: string | null;
    clients: { phone: string; first_name: string | null; last_name: string | null } | null;
    services: { name: string } | null;
  };
  const { data: rawBooking, error: fetchError } = await supabase
    .from("bookings")
    .select(
      `id, scheduled_at, service_id, professional_id,
       clients(phone, first_name, last_name),
       services(name)`
    )
    .eq("id", id)
    .single();

  if (fetchError) throw new Error(fetchError.message);
  const booking = rawBooking as unknown as CancelBookingRow | null;

  const { error } = await supabase
    .from("bookings")
    .update({
      status: "cancelled",
      cancellation_reason: reason,
      cancellation_note: note,
      cancelled_by: cancelledBy,
    })
    .eq("id", id);

  if (error) throw new Error(error.message);

  if (cancelledBy === "admin" && booking?.clients?.phone) {
    withRetry(
      () =>
        notifyClientCancellation({
          clientPhone: booking.clients!.phone,
          clientName: `${booking.clients!.first_name ?? ""} ${booking.clients!.last_name ?? ""}`.trim(),
          serviceName: booking.services?.name ?? "el servicio",
          scheduledAt: booking.scheduled_at,
          reason,
        }),
      { label: "notifyClientCancellation" }
    ).catch(() => {});
  }

  // VBS-43: Delete Google Calendar event if exists
  deleteBookingCalendarEvent(id).catch((err: unknown) => {
    logger.error("Failed to delete GCal event on cancellation", {
      booking_id: id,
      error: err instanceof Error ? err.message : String(err),
    });
  });

  // VBS-72: Notify waitlist if slot freed
  if (booking?.service_id && booking?.scheduled_at) {
    withRetry(
      () =>
        notifyWaitlistForSlot(
          booking.service_id,
          booking.professional_id ?? null,
          booking.scheduled_at
        ),
      { label: "notifyWaitlistForSlot" }
    ).catch(() => {});
  }

  revalidatePath("/backoffice/citas");
  revalidatePath("/backoffice");
}

export async function updateBookingStatus(id: string, status: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("bookings")
    .update({ status })
    .eq("id", id);

  if (error) throw new Error(error.message);

  // VBS-68: If marking as realized, increment sessions_used on associated pack
  if (status === "realized") {
    const { data: rawBooking } = await supabase
      .from("bookings")
      .select("client_package_id")
      .eq("id", id)
      .single();
    const booking = rawBooking as { client_package_id: string | null } | null;

    if (booking?.client_package_id) {
      const { data: rawCp } = await supabase
        .from("client_packages")
        .select("sessions_used, sessions_total")
        .eq("id", booking.client_package_id)
        .single();
      const cp = rawCp as { sessions_used: number; sessions_total: number } | null;

      if (cp) {
        if (!shouldIncrementSessionsUsed(cp.sessions_used, cp.sessions_total)) {
          logger.warn("sessions_used at cap, skipping increment", {
            client_package_id: booking.client_package_id,
            sessions_used: cp.sessions_used,
            sessions_total: cp.sessions_total,
          });
        } else {
          await supabase
            .from("client_packages")
            .update({ sessions_used: cp.sessions_used + 1 })
            .eq("id", booking.client_package_id);
        }
      }
    }
  }

  // VBS-42: Create Google Calendar event when booking is confirmed
  if (status === "confirmed") {
    createBookingCalendarEvent(id).catch((err: unknown) => {
      logger.error("Failed to create GCal event on confirm", {
        booking_id: id,
        error: err instanceof Error ? err.message : String(err),
      });
    });
  }

  // VBS-43: Delete Google Calendar event when booking is cancelled or no_show
  if (status === "cancelled" || status === "no_show") {
    deleteBookingCalendarEvent(id).catch((err: unknown) => {
      logger.error("Failed to delete GCal event on status change", {
        booking_id: id,
        status,
        error: err instanceof Error ? err.message : String(err),
      });
    });
  }

  revalidatePath("/backoffice/citas");
  revalidatePath("/backoffice");
}

export async function createBooking(formData: FormData) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const rl = await checkAdminRateLimit(user.id);
    if (!rl.allowed) throw new Error("Demasiadas solicitudes. Esperá un momento antes de continuar.");
  }

  const { data: rawInserted, error } = await supabase
    .from("bookings")
    .insert({
      client_id: formData.get("client_id") as string,
      service_id: formData.get("service_id") as string,
      professional_id: (formData.get("professional_id") as string) || null,
      scheduled_at: artLocalInputToISO(formData.get("scheduled_at") as string),
      notes: (formData.get("notes") as string) || null,
      status: "confirmed",
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  const inserted = rawInserted as { id: string } | null;

  // VBS-42/185: Await GCal creation before redirect to avoid serverless cutting the detached promise
  if (inserted?.id) {
    await createBookingCalendarEvent(inserted.id);
  }

  revalidatePath("/backoffice/citas");
  revalidatePath("/backoffice");
  redirect("/backoffice/citas");
}

export async function createBookingFromAgenda(data: {
  client_id: string;
  service_id: string;
  professional_id: string | null;
  scheduled_at: string;
  notes: string | null;
}): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const { data: rawInserted2, error } = await supabase
    .from("bookings")
    .insert({
      client_id: data.client_id,
      service_id: data.service_id,
      professional_id: data.professional_id,
      scheduled_at: data.scheduled_at,
      notes: data.notes,
      status: "confirmed",
    })
    .select("id")
    .single();

  if (error) return { success: false, error: error.message };
  const inserted = rawInserted2 as { id: string } | null;

  if (inserted?.id) {
    createBookingCalendarEvent(inserted.id).catch((err: unknown) => {
      logger.error("Failed to create GCal event from agenda", {
        booking_id: inserted.id,
        error: err instanceof Error ? err.message : String(err),
      });
    });
  }

  revalidatePath("/backoffice/agenda");
  revalidatePath("/backoffice/citas");
  return { success: true };
}

export async function quickCreateClient(data: {
  first_name: string;
  last_name: string;
  phone: string;
}): Promise<
  | { id: string; first_name: string; last_name: string; phone: string; reused: boolean }
  | { error: string }
> {
  const supabase = await createClient();

  const normalized = normalizePhone(data.phone);
  if (normalized.length < 6) return { error: "Teléfono inválido." };

  type ClientRow = { id: string; first_name: string; last_name: string; phone: string };

  // Look up by phone first — tolerant of stored variants (with/without 598 prefix)
  const { data: rawExisting } = await supabase
    .from("clients")
    .select("id, first_name, last_name, phone")
    .or(`phone.eq.${normalized},phone.ilike.%${normalized}`)
    .limit(1)
    .maybeSingle();
  const existing = rawExisting as ClientRow | null;

  if (existing) {
    return {
      id: existing.id,
      first_name: existing.first_name,
      last_name: existing.last_name,
      phone: existing.phone,
      reused: true,
    };
  }

  const { data: rawRow, error } = await supabase
    .from("clients")
    .insert({
      first_name: data.first_name.trim(),
      last_name: data.last_name.trim(),
      phone: normalized,
    })
    .select("id, first_name, last_name, phone")
    .single();
  const row = rawRow as ClientRow | null;

  // Race condition / undetected variant → re-lookup
  if (error) {
    if ((error as { code?: string }).code === "23505") {
      const { data: rawFallback } = await supabase
        .from("clients")
        .select("id, first_name, last_name, phone")
        .or(`phone.eq.${normalized},phone.ilike.%${normalized}`)
        .limit(1)
        .maybeSingle();
      const fallback = rawFallback as ClientRow | null;
      if (fallback) return { ...fallback, reused: true };
    }
    return { error: error.message };
  }

  return { id: row!.id, first_name: row!.first_name, last_name: row!.last_name, phone: row!.phone, reused: false };
}

export async function quickCreateService(data: {
  name: string;
  duration_minutes: number;
  price: number;
  deposit_amount: number;
}): Promise<{ id: string; name: string; duration_minutes: number } | { error: string }> {
  const supabase = await createClient();

  const { data: rawSvc, error } = await supabase
    .from("services")
    .insert({
      name: data.name.trim(),
      duration_minutes: data.duration_minutes,
      price: data.price,
      deposit_amount: data.deposit_amount,
    })
    .select("id, name, duration_minutes")
    .single();

  if (error) return { error: error.message };
  const row = rawSvc as { id: string; name: string; duration_minutes: number };
  return { id: row.id, name: row.name, duration_minutes: row.duration_minutes };
}

export async function moveBooking(
  id: string,
  newScheduledAt: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  // Fetch booking + service duration
  const { data: rawMoveBk, error: fetchError } = await supabase
    .from("bookings")
    .select("id, gcal_event_id, services(duration_minutes)")
    .eq("id", id)
    .single();

  if (fetchError || !rawMoveBk) return { success: false, error: fetchError?.message ?? "Not found" };
  type MoveBkRow = { id: string; gcal_event_id: string | null; services: { duration_minutes: number } | null };
  const booking = rawMoveBk as unknown as MoveBkRow;

  const durationMinutes: number = booking.services?.duration_minutes ?? 60;
  const newStart = new Date(newScheduledAt);
  const newEnd = new Date(newStart.getTime() + durationMinutes * 60_000);

  const { error } = await supabase
    .from("bookings")
    .update({
      scheduled_at: newStart.toISOString(),
      end_at: newEnd.toISOString(),
    })
    .eq("id", id);

  if (error) return { success: false, error: error.message };

  // Recreate GCal event
  if (booking.gcal_event_id) {
    deleteBookingCalendarEvent(id)
      .then(() => createBookingCalendarEvent(id))
      .catch((err: unknown) => {
        logger.error("Failed to recreate GCal event on move", {
          booking_id: id,
          error: err instanceof Error ? err.message : String(err),
        });
      });
  }

  revalidatePath("/backoffice/agenda");
  return { success: true };
}

export async function updateBooking(id: string, formData: FormData) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const rl = await checkAdminRateLimit(user.id);
    if (!rl.allowed) throw new Error("Demasiadas solicitudes. Esperá un momento antes de continuar.");
  }

  const { error } = await supabase
    .from("bookings")
    .update({
      client_id: formData.get("client_id") as string,
      service_id: formData.get("service_id") as string,
      professional_id: (formData.get("professional_id") as string) || null,
      scheduled_at: artLocalInputToISO(formData.get("scheduled_at") as string),
      notes: (formData.get("notes") as string) || null,
    })
    .eq("id", id);

  if (error) throw new Error(error.message);

  revalidatePath("/backoffice/citas");
  revalidatePath("/backoffice");
  redirect("/backoffice/citas");
}

export async function updateBookingInline(
  id: string,
  data: {
    client_id?: string;
    service_id?: string;
    professional_id?: string | null;
    scheduled_at?: string;
    status?: string;
    notes?: string | null;
  }
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  type InlineCurrentRow = { status: string; gcal_event_id: string | null; scheduled_at: string; client_package_id: string | null };
  const { data: rawCurrent, error: fetchError } = await supabase
    .from("bookings")
    .select("status, gcal_event_id, scheduled_at, client_package_id")
    .eq("id", id)
    .single();

  if (fetchError || !rawCurrent) return { success: false, error: fetchError?.message ?? "Not found" };
  const current = rawCurrent as InlineCurrentRow;

  const updatePayload: Record<string, unknown> = {};
  if (data.client_id) updatePayload.client_id = data.client_id;
  if (data.service_id) updatePayload.service_id = data.service_id;
  if ("professional_id" in data) updatePayload.professional_id = data.professional_id;
  if (data.scheduled_at) updatePayload.scheduled_at = data.scheduled_at;
  if (data.status) updatePayload.status = data.status;
  if ("notes" in data) updatePayload.notes = data.notes;

  const { error } = await supabase.from("bookings").update(updatePayload).eq("id", id);
  if (error) return { success: false, error: error.message };

  const newStatus = data.status;
  const oldStatus = current.status;

  if (newStatus && newStatus !== oldStatus) {
    if (newStatus === "confirmed") {
      createBookingCalendarEvent(id).catch((err: unknown) => {
        logger.error("Failed to create GCal event on inline confirm", {
          booking_id: id,
          error: err instanceof Error ? err.message : String(err),
        });
      });
    } else if (newStatus === "cancelled" || newStatus === "no_show") {
      deleteBookingCalendarEvent(id).catch((err: unknown) => {
        logger.error("Failed to delete GCal event on inline status change", {
          booking_id: id,
          status: newStatus,
          error: err instanceof Error ? err.message : String(err),
        });
      });
    }
  }

  if (data.scheduled_at && data.scheduled_at !== current.scheduled_at && current.gcal_event_id) {
    deleteBookingCalendarEvent(id)
      .then(() => createBookingCalendarEvent(id))
      .catch((err: unknown) => {
        logger.error("Failed to recreate GCal event on inline reschedule", {
          booking_id: id,
          error: err instanceof Error ? err.message : String(err),
        });
      });
  }

  if (newStatus === "realized" && oldStatus !== "realized" && current.client_package_id) {
    const { data: rawInlineCp } = await supabase
      .from("client_packages")
      .select("sessions_used, sessions_total")
      .eq("id", current.client_package_id)
      .single();
    const cp = rawInlineCp as { sessions_used: number; sessions_total: number } | null;
    if (cp) {
      if (!shouldIncrementSessionsUsed(cp.sessions_used, cp.sessions_total)) {
        logger.warn("sessions_used at cap, skipping increment", {
          client_package_id: current.client_package_id,
          sessions_used: cp.sessions_used,
          sessions_total: cp.sessions_total,
        });
      } else {
        await supabase
          .from("client_packages")
          .update({ sessions_used: cp.sessions_used + 1 })
          .eq("id", current.client_package_id);
      }
    }
  }

  revalidatePath("/backoffice/citas");
  return { success: true };
}
