-- VBS-84: Seed payment reminder template and config keys
INSERT INTO system_config (key, value, updated_at) VALUES
  (
    'template_payment_reminder',
    E'⚠️ *Recordatorio de pago — {businessName}*\n\nHola {firstName}! Tu reserva de *{serviceName}* tiene un pago pendiente.\n\n💳 Completá el pago para confirmar tu turno:{paymentLine}\n\nSi no recibimos el pago, la reserva se cancelará automáticamente.\n\n¿Necesitás ayuda? Escribinos 😊',
    now()
  ),
  -- payment_reminder_after_hours: hours after booking creation to send reminder (before auto-cancel)
  ('payment_reminder_after_hours', '12', now())
ON CONFLICT (key) DO NOTHING;
