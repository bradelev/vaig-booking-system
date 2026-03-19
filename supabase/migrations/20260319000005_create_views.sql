-- Analytical views: clientes_metricas and alertas_semanales

CREATE OR REPLACE VIEW clientes_metricas AS
WITH todas_sesiones AS (
  -- Active bookings (not cancelled/no_show)
  SELECT
    b.client_id,
    b.scheduled_at::DATE AS fecha,
    s.name               AS tipo_servicio,
    COALESCE(p.amount, 0) AS monto
  FROM bookings b
  JOIN services s ON s.id = b.service_id
  LEFT JOIN payments p ON p.booking_id = b.id
  WHERE b.status NOT IN ('cancelled', 'no_show')

  UNION ALL

  -- Historical sessions from spreadsheet
  SELECT
    sh.client_id,
    sh.fecha,
    sh.tipo_servicio,
    COALESCE(sh.monto_cobrado, 0) AS monto
  FROM sesiones_historicas sh
),
metricas AS (
  SELECT
    client_id,
    MIN(fecha)                         AS primera_visita,
    MAX(fecha)                         AS ultima_visita,
    COUNT(*)                           AS total_sesiones,
    SUM(monto)                         AS total_cobrado,
    ROUND(AVG(monto), 2)               AS ticket_promedio,
    COUNT(DISTINCT tipo_servicio)      AS n_servicios_distintos
  FROM todas_sesiones
  GROUP BY client_id
),
ultimo_contacto AS (
  SELECT
    client_id,
    fecha AS ultimo_contacto_fecha
  FROM (
    SELECT
      client_id,
      fecha,
      ROW_NUMBER() OVER (PARTITION BY client_id ORDER BY fecha DESC) AS rn
    FROM contactos
  ) sub
  WHERE rn = 1
)
SELECT
  c.id,
  c.first_name,
  c.last_name,
  c.nombre_normalizado,
  c.phone,
  c.email,
  c.source,
  c.instagram,
  c.es_historico,
  c.activa_membresia,
  c.created_at,
  m.primera_visita,
  m.ultima_visita,
  COALESCE(m.total_sesiones, 0)        AS total_sesiones,
  COALESCE(m.total_cobrado, 0)         AS total_cobrado,
  m.ticket_promedio,
  COALESCE(m.n_servicios_distintos, 0) AS n_servicios_distintos,
  uc.ultimo_contacto_fecha,
  CURRENT_DATE - m.ultima_visita       AS dias_inactivo,
  -- Categoria segun actividad
  CASE
    WHEN m.ultima_visita >= CURRENT_DATE - INTERVAL '30 days'  THEN 'activa'
    WHEN m.ultima_visita >= CURRENT_DATE - INTERVAL '90 days'  THEN 'en_riesgo'
    WHEN m.ultima_visita >= CURRENT_DATE - INTERVAL '180 days' THEN 'inactiva'
    WHEN m.ultima_visita IS NOT NULL                            THEN 'perdida'
    ELSE 'sin_visitas'
  END AS categoria,
  -- Cross-sell: has visited but uses only 1 service type
  CASE
    WHEN COALESCE(m.n_servicios_distintos, 0) = 1
     AND COALESCE(m.total_sesiones, 0) >= 3
    THEN TRUE ELSE FALSE
  END AS oportunidad_cross_sell,
  -- Reactivation: inactive 60-180 days, no recent contact
  CASE
    WHEN m.ultima_visita < CURRENT_DATE - INTERVAL '60 days'
     AND m.ultima_visita >= CURRENT_DATE - INTERVAL '180 days'
     AND (uc.ultimo_contacto_fecha IS NULL OR uc.ultimo_contacto_fecha < CURRENT_DATE - INTERVAL '14 days')
    THEN TRUE ELSE FALSE
  END AS candidata_reactivacion
FROM clients c
LEFT JOIN metricas m ON m.client_id = c.id
LEFT JOIN ultimo_contacto uc ON uc.client_id = c.id;

-- Weekly alerts view
CREATE OR REPLACE VIEW alertas_semanales AS
SELECT
  id,
  first_name,
  last_name,
  phone,
  email,
  instagram,
  ultima_visita,
  dias_inactivo,
  total_sesiones,
  total_cobrado,
  ticket_promedio,
  ultimo_contacto_fecha,
  categoria,
  oportunidad_cross_sell,
  candidata_reactivacion,
  CASE
    WHEN dias_inactivo BETWEEN 58 AND 65   THEN 'reactivacion_60d'
    WHEN dias_inactivo BETWEEN 85 AND 95   THEN 'reactivacion_90d'
    WHEN dias_inactivo BETWEEN 175 AND 185 THEN 'reactivacion_180d'
    WHEN oportunidad_cross_sell             THEN 'cross_sell'
  END AS tipo_alerta
FROM clientes_metricas
WHERE
  -- Inactivity alerts
  (
    dias_inactivo BETWEEN 58 AND 65
    OR dias_inactivo BETWEEN 85 AND 95
    OR dias_inactivo BETWEEN 175 AND 185
    OR oportunidad_cross_sell
  )
  -- No recent contact in last 14 days
  AND (
    ultimo_contacto_fecha IS NULL
    OR ultimo_contacto_fecha < CURRENT_DATE - 14
  );
