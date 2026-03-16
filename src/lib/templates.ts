// Template metadata — shared between actions and UI (no "use server")

export const TEMPLATE_KEYS = [
  "template_reminder",
  "template_survey",
  "template_cancel_client",
  "template_pack_purchased",
] as const;

export type TemplateKey = (typeof TEMPLATE_KEYS)[number];

export const TEMPLATE_LABELS: Record<TemplateKey, string> = {
  template_reminder: "Recordatorio de turno (24h)",
  template_survey: "Encuesta post-atención",
  template_cancel_client: "Cancelación de turno (cliente)",
  template_pack_purchased: "Confirmación compra de pack",
};

export const TEMPLATE_PLACEHOLDERS: Record<TemplateKey, string[]> = {
  template_reminder: ["{firstName}", "{serviceName}", "{businessName}", "{dateLabel}"],
  template_survey: ["{firstName}", "{serviceName}", "{businessName}", "{surveyUrl}"],
  template_cancel_client: ["{firstName}", "{serviceName}", "{dateLabel}", "{reasonText}"],
  template_pack_purchased: ["{firstName}", "{packName}", "{serviceName}", "{sessionsTotal}"],
};
