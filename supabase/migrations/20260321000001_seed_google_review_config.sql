-- VBS-48: Seed Google review template and config keys into system_config
INSERT INTO system_config (key, value, updated_at) VALUES
  (
    'template_google_review',
    E'🌟 *¡Gracias por tu calificación, {firstName}!*\n\nNos alegra saber que tuviste una buena experiencia en *{businessName}*.\n\n¿Te gustaría compartirla con otras personas? Tu reseña nos ayuda mucho a crecer 🙏\n\n👉 {googleReviewUrl}',
    now()
  ),
  (
    'template_survey',
    E'⭐ *¿Cómo fue tu experiencia en {businessName}?*\n\nHola {firstName}! Gracias por tu visita de *{serviceName}*.\n\nNos importa mucho tu opinión. Respondé con un número del *1 al 5*:\n\n1️⃣ Muy mala  2️⃣ Mala  3️⃣ Regular  4️⃣ Buena  5️⃣ Excelente{surveyUrlLine}\n\n¡Muchas gracias! 🙏',
    now()
  ),
  -- google_review_url: set to your Google Maps review link
  ('google_review_url', '', now()),
  -- google_review_score_threshold: min score (1-5) to trigger Google review request
  ('google_review_score_threshold', '4', now())
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();
