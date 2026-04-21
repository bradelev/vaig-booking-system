export type MetaError = {
  code: number;
  title?: string;
  message?: string;
  error_data?: { details?: string };
};

type ErrorDescriptor = { title: string; friendly: string };

const META_ERROR_MAP: Record<number, ErrorDescriptor> = {
  470: {
    title: "Re-engagement required",
    friendly: "Se requiere reenganche con el usuario (ventana de 24 h expiró)",
  },
  131026: {
    title: "Message undeliverable",
    friendly: "El número no tiene WhatsApp activo o no aceptó los Términos de Servicio",
  },
  131047: {
    title: "Re-engagement message",
    friendly: "El usuario no escribió en las últimas 24 h — se requiere template de notificación",
  },
  131049: {
    title: "Ecosystem engagement",
    friendly:
      "Meta bloqueó el envío para mantener la calidad del ecosistema — el usuario posiblemente marcó mensajes anteriores como spam",
  },
  131050: {
    title: "User opted out",
    friendly: "El usuario optó por no recibir mensajes de marketing de este número",
  },
  131051: {
    title: "Unsupported message type",
    friendly: "El tipo de mensaje no está soportado por el dispositivo del destinatario",
  },
  131053: {
    title: "Media upload error",
    friendly: "Error al subir el archivo multimedia adjunto",
  },
  132000: {
    title: "Parameter count mismatch",
    friendly: "La cantidad de parámetros no coincide con lo esperado por el template",
  },
  132001: {
    title: "Template not found",
    friendly: "El template no existe en Meta o fue eliminado",
  },
  132005: {
    title: "Translated text too long",
    friendly: "El texto traducido excede el largo máximo permitido por Meta",
  },
  132007: {
    title: "Template format policy violated",
    friendly: "El template viola las políticas de formato de Meta",
  },
  132012: {
    title: "Parameter format mismatch",
    friendly: "El formato de uno o más parámetros no coincide con el tipo esperado",
  },
  132015: {
    title: "Template paused",
    friendly: "El template fue pausado por Meta por calidad baja — revisá el panel de WhatsApp Business",
  },
  132016: {
    title: "Template disabled",
    friendly: "El template está deshabilitado en Meta",
  },
  132018: {
    title: "Parameter format error",
    friendly:
      "Problema con los parámetros del template — el texto contiene saltos de línea, tabs o espacios excesivos no permitidos",
  },
  132068: {
    title: "Flow blocked",
    friendly: "El flujo de WhatsApp está bloqueado",
  },
  132069: {
    title: "Flow throttled",
    friendly: "El flujo de WhatsApp está limitado por rate — intentá más tarde",
  },
  133004: {
    title: "Server temporarily unavailable",
    friendly: "Servidor de Meta temporalmente no disponible — el envío fallará, reintentar más tarde",
  },
  133010: {
    title: "Phone number not registered",
    friendly: "El número no está registrado en WhatsApp Business",
  },
};

export function describeMetaError(
  code: number,
  fallbackMessage?: string
): { code: number; title: string; friendly: string } {
  const descriptor = META_ERROR_MAP[code];
  if (descriptor) return { code, ...descriptor };
  return {
    code,
    title: "Error de Meta",
    friendly:
      fallbackMessage ||
      `Error desconocido de WhatsApp (código ${code}) — consultá la documentación de Meta para más detalles`,
  };
}

export function formatWebhookError(errors: MetaError[] | undefined): {
  errorCode: number | null;
  errorMessage: string | null;
} {
  if (!errors || errors.length === 0) return { errorCode: null, errorMessage: null };

  const primaryCode = errors[0].code;
  const parts = errors.map((e) => {
    const { friendly } = describeMetaError(e.code, e.title || e.message);
    const detail = e.error_data?.details;
    return detail ? `${friendly} (${detail})` : friendly;
  });

  return {
    errorCode: primaryCode,
    errorMessage: parts.join(" · "),
  };
}
