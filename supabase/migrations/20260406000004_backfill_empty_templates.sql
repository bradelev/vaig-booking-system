-- Backfill empty WA templates in system_config.
-- Uses DO UPDATE only when value IS NULL or '' so user-edited values are preserved.
INSERT INTO system_config (key, value, updated_at) VALUES
  (
    'template_reminder',
    E'⏰ *Recordatorio de turno — {businessName}*\n\nHola {firstName}! Te recordamos tu turno de *{serviceName}* para mañana:\n📅 {dateLabel}\n\n¿Confirmás tu asistencia? Respondé *confirmo* para confirmarlo o *cancelar* si necesitás cancelarlo. 😊',
    now()
  ),
  (
    'template_survey',
    E'⭐ *¿Cómo fue tu experiencia en {businessName}?*\n\nHola {firstName}! Gracias por tu visita de *{serviceName}*.\n\nNos importa mucho tu opinión. Respondé con un número del *1 al 5*:\n\n1️⃣ Muy mala  2️⃣ Mala  3️⃣ Regular  4️⃣ Buena  5️⃣ Excelente{surveyUrlLine}\n\n¡Muchas gracias! 🙏',
    now()
  ),
  (
    'template_google_review',
    E'🌟 *¡Gracias por tu calificación, {firstName}!*\n\nNos alegra saber que tuviste una buena experiencia en *{businessName}*.\n\n¿Te gustaría compartirla con otras personas? Tu reseña nos ayuda mucho a crecer 🙏\n\n👉 {googleReviewUrl}',
    now()
  ),
  (
    'template_payment_reminder',
    E'⚠️ *Recordatorio de pago — {businessName}*\n\nHola {firstName}! Tu reserva de *{serviceName}* tiene un pago pendiente.\n\n💳 Completá el pago para confirmar tu turno:{paymentLine}\n\nSi no recibimos el pago, la reserva se cancelará automáticamente.\n\n¿Necesitás ayuda? Escribinos 😊',
    now()
  ),
  (
    'template_next_session',
    E'💆 *¿Ya es hora de tu próxima sesión?*\n\nHola {firstName}! Han pasado aproximadamente {intervalDays} días desde tu última sesión de *{serviceName}*.\n\n📅 Te sugerimos agendarla alrededor del {dateLabel}.\n\nRespondé *hola* para ver los turnos disponibles o ignorá este mensaje si ya tenés uno coordinado. 😊\n\n_{businessName}_',
    now()
  ),
  (
    'template_cancel_client',
    E'❌ *Reserva cancelada*\n\nHola {firstName}, lamentablemente tu turno fue cancelado porque {reasonText}.\n\n📋 Servicio: {serviceName}\n📅 Turno: {dateLabel}\n\nSi querés, podés volver a reservar escribiéndonos cuando gustes. 😊',
    now()
  ),
  (
    'template_pack_purchased',
    E'🎉 *¡Pack adquirido!*\n\nHola {firstName}! Confirmamos la compra de tu pack:\n\n📦 *{packName}*\n📋 Servicio: {serviceName}\n✅ {sessionsTotal} sesiones disponibles\n\nPodés agendar tus turnos cuando quieras escribiéndonos. ¡Gracias! 😊',
    now()
  ),
  (
    'template_admin_new_booking',
    E'🔔 *Nueva reserva creada*\n\n👤 Cliente: {clientName} ({clientPhone})\n📋 Servicio: {serviceName}\n💆 Profesional: {professionalName}\n📅 Turno: {dateLabel}\n💰 Seña pendiente: ${depositAmount}\n\n_Reserva ID: {bookingId}_',
    now()
  ),
  (
    'template_admin_payment_confirmed',
    E'✅ *Seña confirmada*\n\n👤 Cliente: {clientName} ({clientPhone})\n📋 Servicio: {serviceName}\n📅 Turno: {dateLabel}\n💰 Monto: ${amount} ({methodLabel})\n\n_Reserva ID: {bookingId}_',
    now()
  )
ON CONFLICT (key) DO UPDATE
  SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at
  WHERE system_config.value IS NULL OR system_config.value = '';
