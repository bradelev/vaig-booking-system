-- VBS-86: Seed missing WA templates into system_config
INSERT INTO system_config (key, value, updated_at) VALUES
  (
    'template_next_session',
    E'💆 *¿Ya es hora de tu próxima sesión?*\n\nHola {firstName}! Han pasado aproximadamente {intervalDays} días desde tu última sesión de *{serviceName}*.\n\n📅 Te sugerimos agendarla alrededor del {dateLabel}.\n\nRespondé *hola* para ver los turnos disponibles o ignorá este mensaje si ya tenés uno coordinado. 😊\n\n_{businessName}_',
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
ON CONFLICT (key) DO NOTHING;
