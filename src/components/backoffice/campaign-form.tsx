"use client";

import { useRef, useState, useTransition, useId, useCallback, useEffect } from "react";
import { createCampaign, createAndScheduleCampaign, updateCampaign, uploadCampaignImage, scheduleCampaign } from "@/actions/campaigns";

interface Client {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
  consent_accepted_at: string | null;
}

interface CampaignFormProps {
  clients: Client[];
  campaign?: {
    id: string;
    name: string;
    body: string;
    image_url: string | null;
    scheduled_at: string | null;
    target_all: boolean;
    status: string;
    recipient_ids: string[];
  };
}

function toLocalDatetimeValue(isoString: string | null): string {
  if (!isoString) return "";
  // Convert UTC ISO to ART (UTC-3) datetime-local format
  const date = new Date(isoString);
  const artOffset = -3 * 60;
  const local = new Date(date.getTime() + (artOffset - date.getTimezoneOffset()) * -60000);
  // Format as YYYY-MM-DDTHH:MM
  return local.toISOString().slice(0, 16);
}

function formatTimeART(isoString: string | null): string {
  if (!isoString) return "";
  return new Date(isoString).toLocaleTimeString("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function CampaignForm({ clients, campaign }: CampaignFormProps) {
  const isEdit = !!campaign;
  const isDraft = !campaign || campaign.status === "draft";

  const [name, setName] = useState(campaign?.name ?? "");
  const [body, setBody] = useState(campaign?.body ?? "");
  const [imageUrl, setImageUrl] = useState(campaign?.image_url ?? "");
  const [imagePreview, setImagePreview] = useState(campaign?.image_url ?? "");
  const [targetAll, setTargetAll] = useState(campaign?.target_all ?? true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set(campaign?.recipient_ids ?? [])
  );
  const [comboboxQuery, setComboboxQuery] = useState("");
  const [comboboxOpen, setComboboxOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [scheduledAt, setScheduledAt] = useState(
    toLocalDatetimeValue(campaign?.scheduled_at ?? null)
  );
  const [uploading, setUploading] = useState(false);
  const [isPending, startTransition] = useTransition();

  const fileRef = useRef<HTMLInputElement>(null);
  const comboboxId = useId();
  const listboxId = `${comboboxId}-listbox`;
  const inputRef = useRef<HTMLInputElement>(null);

  const dropdownClients = clients.filter((c) => {
    if (selectedIds.has(c.id)) return false;
    const q = comboboxQuery.toLowerCase();
    return (
      c.first_name.toLowerCase().includes(q) ||
      c.last_name.toLowerCase().includes(q) ||
      c.phone.includes(q)
    );
  }).slice(0, 8);

  const selectedClients = clients.filter((c) => selectedIds.has(c.id));

  const selectClient = useCallback((id: string) => {
    setSelectedIds((prev) => new Set([...prev, id]));
    setComboboxQuery("");
    setComboboxOpen(false);
    setActiveIndex(-1);
    inputRef.current?.focus();
  }, []);

  const removeClient = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  function handleComboboxKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!comboboxOpen) {
      if (e.key === "ArrowDown") {
        setComboboxOpen(true);
        setActiveIndex(0);
        e.preventDefault();
      }
      return;
    }
    if (e.key === "ArrowDown") {
      setActiveIndex((i) => Math.min(i + 1, dropdownClients.length - 1));
      e.preventDefault();
    } else if (e.key === "ArrowUp") {
      setActiveIndex((i) => Math.max(i - 1, -1));
      e.preventDefault();
    } else if (e.key === "Enter" && activeIndex >= 0 && dropdownClients[activeIndex]) {
      selectClient(dropdownClients[activeIndex].id);
      e.preventDefault();
    } else if (e.key === "Escape") {
      setComboboxOpen(false);
      setActiveIndex(-1);
    }
  }

  // Close dropdown on outside click
  useEffect(() => {
    if (!comboboxOpen) return;
    function handleClick(e: MouseEvent) {
      const container = document.getElementById(comboboxId);
      if (container && !container.contains(e.target as Node)) {
        setComboboxOpen(false);
        setActiveIndex(-1);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [comboboxOpen, comboboxId]);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Local preview
    const reader = new FileReader();
    reader.onload = (ev) => setImagePreview(ev.target?.result as string);
    reader.readAsDataURL(file);

    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const result = await uploadCampaignImage(fd);
      setImageUrl(result.url);
    } catch (err) {
      alert(`Error al subir imagen: ${err instanceof Error ? err.message : "Error desconocido"}`);
      setImagePreview(imageUrl); // revert preview
    } finally {
      setUploading(false);
    }
  }

  function removeImage() {
    setImageUrl("");
    setImagePreview("");
    if (fileRef.current) fileRef.current.value = "";
  }

  function buildFormData(): FormData {
    const fd = new FormData();
    fd.append("name", name);
    fd.append("body", body);
    fd.append("image_url", imageUrl);
    fd.append("target_all", String(targetAll));
    fd.append("scheduled_at", scheduledAt);
    if (!targetAll) {
      for (const id of selectedIds) {
        fd.append("client_ids", id);
      }
    }
    return fd;
  }

  function handleSaveDraft() {
    startTransition(async () => {
      const fd = buildFormData();
      if (isEdit && campaign) {
        await updateCampaign(campaign.id, fd);
      } else {
        await createCampaign(fd);
      }
    });
  }

  function handleScheduleNew() {
    if (!scheduledAt) {
      alert("Configurá una fecha y hora de envío antes de programar");
      return;
    }
    startTransition(async () => {
      // createAndScheduleCampaign inserts the campaign directly as "scheduled"
      const fd = buildFormData();
      await createAndScheduleCampaign(fd);
    });
  }

  async function handleScheduleExisting() {
    if (!campaign) return;
    startTransition(async () => {
      await scheduleCampaign(campaign.id);
    });
  }

  const minDatetime = toLocalDatetimeValue(new Date().toISOString());

  return (
    <div className="space-y-6">
      {/* Two-column layout on desktop */}
      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        {/* LEFT: Form fields */}
        <div className="space-y-5">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre de la campaña <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Promo Marzo 2026"
              disabled={!isDraft}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 disabled:bg-gray-50 disabled:text-gray-500"
            />
            <p className="mt-1 text-xs text-gray-400">Referencia interna, no se envía al cliente.</p>
          </div>

          {/* Image */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Imagen (opcional)</label>
            {imagePreview ? (
              <div className="relative inline-block">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imagePreview}
                  alt="Preview"
                  className="h-32 w-auto rounded-lg border border-gray-200 object-cover"
                />
                {isDraft && (
                  <button
                    type="button"
                    onClick={removeImage}
                    className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white text-xs hover:bg-red-600"
                  >
                    ×
                  </button>
                )}
              </div>
            ) : isDraft ? (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-2 rounded-md border border-dashed border-gray-300 px-4 py-3 text-sm text-gray-500 hover:border-gray-400 hover:text-gray-700 transition-colors disabled:opacity-50"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
                {uploading ? "Subiendo..." : "Adjuntar imagen"}
              </button>
            ) : null}
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          {/* Message body */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Mensaje <span className="text-red-500">*</span>
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Escribí tu mensaje..."
              rows={5}
              disabled={!isDraft}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 resize-y disabled:bg-gray-50 disabled:text-gray-500"
            />
          </div>

          {/* Recipients */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Destinatarios</label>
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="target_all"
                  checked={targetAll}
                  onChange={() => setTargetAll(true)}
                  disabled={!isDraft}
                  className="h-4 w-4 text-gray-900"
                />
                <span className="text-sm text-gray-700">Todos los clientes activos</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="target_all"
                  checked={!targetAll}
                  onChange={() => setTargetAll(false)}
                  disabled={!isDraft}
                  className="h-4 w-4 text-gray-900"
                />
                <span className="text-sm text-gray-700">Seleccionar manualmente</span>
              </label>
            </div>

            {!targetAll && (
              <div className="mt-3 space-y-2">
                {/* Combobox input */}
                <div id={comboboxId} className="relative">
                  <input
                    ref={inputRef}
                    type="text"
                    role="combobox"
                    aria-expanded={comboboxOpen}
                    aria-controls={listboxId}
                    aria-activedescendant={
                      activeIndex >= 0 && dropdownClients[activeIndex]
                        ? `${comboboxId}-option-${dropdownClients[activeIndex].id}`
                        : undefined
                    }
                    value={comboboxQuery}
                    onChange={(e) => {
                      setComboboxQuery(e.target.value);
                      setComboboxOpen(true);
                      setActiveIndex(-1);
                    }}
                    onFocus={() => setComboboxOpen(true)}
                    onKeyDown={handleComboboxKeyDown}
                    placeholder="Buscar cliente..."
                    disabled={!isDraft}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 disabled:bg-gray-50 disabled:text-gray-500"
                    autoComplete="off"
                  />
                  {comboboxOpen && (
                    <ul
                      id={listboxId}
                      role="listbox"
                      className="absolute z-10 mt-1 w-full rounded-md border border-gray-200 bg-white shadow-lg max-h-56 overflow-y-auto divide-y divide-gray-100"
                    >
                      {dropdownClients.length === 0 ? (
                        <li className="px-3 py-3 text-sm text-gray-400 text-center">Sin resultados</li>
                      ) : (
                        dropdownClients.map((c, idx) => (
                          <li
                            key={c.id}
                            id={`${comboboxId}-option-${c.id}`}
                            role="option"
                            aria-selected={idx === activeIndex}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              selectClient(c.id);
                            }}
                            onMouseEnter={() => setActiveIndex(idx)}
                            className={`flex items-center justify-between px-3 py-2 cursor-pointer text-sm ${
                              idx === activeIndex ? "bg-gray-100" : "hover:bg-gray-50"
                            }`}
                          >
                            <span className="text-gray-800">
                              {c.first_name} {c.last_name}
                              <span className="ml-2 text-gray-400 text-xs">{c.phone}</span>
                            </span>
                            {!c.consent_accepted_at && (
                              <span className="ml-2 shrink-0 rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">
                                Sin RNPD
                              </span>
                            )}
                          </li>
                        ))
                      )}
                    </ul>
                  )}
                </div>

                {/* Selected chips */}
                {selectedClients.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {selectedClients.map((c) => (
                      <span
                        key={c.id}
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${
                          !c.consent_accepted_at
                            ? "border border-orange-300 bg-orange-50 text-orange-800"
                            : "border border-gray-200 bg-gray-100 text-gray-700"
                        }`}
                      >
                        {!c.consent_accepted_at && (
                          <svg className="h-3 w-3 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-label="Sin RNPD">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                          </svg>
                        )}
                        {c.first_name} {c.last_name}
                        {isDraft && (
                          <button
                            type="button"
                            onClick={() => removeClient(c.id)}
                            className="ml-0.5 rounded-full hover:bg-gray-300 hover:text-gray-900 leading-none"
                            aria-label={`Quitar ${c.first_name} ${c.last_name}`}
                          >
                            ×
                          </button>
                        )}
                      </span>
                    ))}
                  </div>
                )}

                <p className="text-xs text-gray-500">{selectedIds.size} seleccionado{selectedIds.size !== 1 ? "s" : ""}</p>
              </div>
            )}
          </div>

          {/* Scheduled at */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fecha y hora de envío (hora Argentina)
            </label>
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              min={minDatetime}
              disabled={!isDraft}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 disabled:bg-gray-50 disabled:text-gray-500"
            />
            <p className="mt-1 text-xs text-gray-400">
              Timezone: America/Argentina/Buenos_Aires (UTC-3). Si elegís una hora pasada, el envío será inmediato.
            </p>
          </div>

          {/* Action buttons */}
          {isDraft && (
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={handleSaveDraft}
                disabled={isPending || !name.trim()}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                {isPending ? "Guardando..." : "Guardar borrador"}
              </button>
              {isEdit ? (
                <button
                  type="button"
                  onClick={handleScheduleExisting}
                  disabled={isPending || !scheduledAt}
                  className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 transition-colors disabled:opacity-50"
                >
                  {isPending ? "Procesando..." : "Programar envío"}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleScheduleNew}
                  disabled={isPending || !name.trim() || !scheduledAt}
                  className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 transition-colors disabled:opacity-50"
                >
                  {isPending ? "Procesando..." : "Programar envío"}
                </button>
              )}
            </div>
          )}
        </div>

        {/* RIGHT: WhatsApp preview (sticky on desktop) */}
        <div className="md:sticky md:top-6 md:self-start">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400 mb-3">Vista previa</p>
          <div
            className="rounded-2xl p-4 max-w-xs mx-auto shadow-sm"
            style={{ backgroundColor: "#E5DDD5", backgroundImage: "none" }}
          >
            {/* Chat bubble */}
            <div
              className="rounded-2xl rounded-tl-none overflow-hidden max-w-[280px] ml-auto shadow"
              style={{ backgroundColor: "#DCF8C6" }}
            >
              {/* Image area */}
              {imagePreview && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={imagePreview}
                  alt="Preview"
                  className="w-full object-cover max-h-48 rounded-t-2xl rounded-tl-none"
                />
              )}
              {/* Text */}
              <div className="px-3 py-2">
                {body ? (
                  <p className="text-sm text-gray-800 whitespace-pre-wrap break-words leading-snug">
                    {body}
                  </p>
                ) : (
                  <p className="text-sm text-gray-400 italic">Tu mensaje aparecerá aquí...</p>
                )}
                {/* Timestamp */}
                <div className="mt-1 flex justify-end">
                  <span className="text-xs text-gray-500">
                    {scheduledAt
                      ? formatTimeART(new Date(`${scheduledAt}:00-03:00`).toISOString())
                      : new Date().toLocaleTimeString("es-AR", {
                          timeZone: "America/Argentina/Buenos_Aires",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                    {" ✓✓"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Meta info */}
          <div className="mt-4 rounded-md bg-gray-50 border border-gray-200 p-3 space-y-1 text-xs text-gray-500">
            <div className="flex justify-between">
              <span>Destinatarios</span>
              <span className="font-medium text-gray-700">
                {targetAll ? `Todos los activos` : `${selectedIds.size} seleccionados`}
              </span>
            </div>
            {scheduledAt && (
              <div className="flex justify-between">
                <span>Programado</span>
                <span className="font-medium text-gray-700">
                  {new Date(`${scheduledAt}:00-03:00`).toLocaleString("es-AR", {
                    timeZone: "America/Argentina/Buenos_Aires",
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
