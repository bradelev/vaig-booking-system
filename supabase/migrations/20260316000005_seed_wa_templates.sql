-- VBS-62: Seed default WhatsApp message templates into system_config
INSERT INTO system_config (key, value, updated_at) VALUES
  (
    'template_reminder',
    E'⏰ *Recordatorio de turno — {businessName}*\n\nHola {firstName}! Te recordamos tu turno de *{serviceName}* para mañana:\n📅 {dateLabel}\n\n¿Confirmás tu asistencia? Respondé *confirmo* para confirmarlo o *cancelar* si necesitás cancelarlo. 😊',
    now()
  ),
  (
    'template_survey',
    E'⭐ *¿Cómo fue tu experiencia en {businessName}?*\n\nHola {firstName}! Gracias por tu visita de *{serviceName}*.\n\nNos importa mucho tu opinión. ¿Podés contarnos cómo estuvo tu experiencia?\n\n📝 Completá esta breve encuesta:\n{surveyUrl}\n\n¡Muchas gracias! 🙏',
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
  )
ON CONFLICT (key) DO NOTHING;
