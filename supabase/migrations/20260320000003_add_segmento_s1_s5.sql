-- Add segmento S1-S5 to clientes_metricas view
-- Must DROP both views first because alertas_semanales depends on clientes_metricas
DROP VIEW IF EXISTS alertas_semanales;
DROP VIEW IF EXISTS clientes_metricas;

CREATE OR REPLACE VIEW clientes_metricas AS
WITH todas_sesiones AS (
  -- Active bookings (not cancelled/no_show)
  SELECT
    b.client_id,
    b.scheduled_at::DATE AS fecha,
    s.name               AS tipo_servicio,
    COALESCE(p.amount, 0) AS monto,
    NULL::text           AS operadora,
    NULL::text           AS metodo_pago
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
    COALESCE(sh.monto_cobrado, 0) AS monto,
    sh.operadora,
    sh.metodo_pago
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
    COUNT(DISTINCT tipo_servicio)      AS n_servicios_distintos,
    COUNT(DISTINCT date_trunc('month', fecha::timestamptz)) AS meses_activo,
    array_agg(DISTINCT tipo_servicio ORDER BY tipo_servicio) FILTER (WHERE tipo_servicio IS NOT NULL) AS servicios_usados
  FROM todas_sesiones
  GROUP BY client_id
),
-- MODE() of tipo_servicio per client
servicio_frecuente AS (
  SELECT DISTINCT ON (client_id)
    client_id,
    tipo_servicio AS servicio_mas_frecuente
  FROM todas_sesiones
  WHERE tipo_servicio IS NOT NULL
  GROUP BY client_id, tipo_servicio
  ORDER BY client_id, COUNT(*) DESC
),
-- MODE() of operadora per client (from sesiones_historicas only, has the field)
operadora_favorita_cte AS (
  SELECT DISTINCT ON (client_id)
    client_id,
    operadora AS operadora_favorita
  FROM todas_sesiones
  WHERE operadora IS NOT NULL
  GROUP BY client_id, operadora
  ORDER BY client_id, COUNT(*) DESC
),
-- MODE() of metodo_pago per client
metodo_pago_cte AS (
  SELECT DISTINCT ON (client_id)
    client_id,
    metodo_pago AS metodo_pago_preferido
  FROM todas_sesiones
  WHERE metodo_pago IS NOT NULL
  GROUP BY client_id, metodo_pago
  ORDER BY client_id, COUNT(*) DESC
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
),
-- Clients with sesion_n >= 5 in sesiones_historicas (cuponera avanzada)
cuponera_avanzada AS (
  SELECT DISTINCT client_id
  FROM sesiones_historicas
  WHERE sesion_n >= 5
),
base AS (
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
    COALESCE(m.meses_activo, 0)          AS meses_activo,
    CASE
      WHEN COALESCE(m.meses_activo, 0) > 0
      THEN ROUND(m.total_sesiones::numeric / m.meses_activo, 2)
      ELSE NULL
    END                                  AS frecuencia_mensual,
    m.servicios_usados,
    sf.servicio_mas_frecuente,
    of2.operadora_favorita,
    mp.metodo_pago_preferido,
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
    END AS candidata_reactivacion,
    ca.client_id IS NOT NULL AS es_cuponera_avanzada
  FROM clients c
  LEFT JOIN metricas m ON m.client_id = c.id
  LEFT JOIN servicio_frecuente sf ON sf.client_id = c.id
  LEFT JOIN operadora_favorita_cte of2 ON of2.client_id = c.id
  LEFT JOIN metodo_pago_cte mp ON mp.client_id = c.id
  LEFT JOIN ultimo_contacto uc ON uc.client_id = c.id
  LEFT JOIN cuponera_avanzada ca ON ca.client_id = c.id
)
SELECT
  *,
  -- Segmento S1-S5 en orden de prioridad (S5 > S4 > S3 > S2 > S1)
  CASE
    WHEN total_sesiones >= 11 AND dias_inactivo >= 30
      THEN 'S5'
    WHEN total_sesiones = 1 AND dias_inactivo BETWEEN 30 AND 90
      THEN 'S4'
    WHEN n_servicios_distintos = 1
     AND servicio_mas_frecuente ILIKE '%depilaci%'
     AND categoria IN ('activa', 'en_riesgo')
      THEN 'S3'
    WHEN es_cuponera_avanzada
      THEN 'S2'
    WHEN dias_inactivo BETWEEN 60 AND 120
      THEN 'S1'
    ELSE NULL
  END AS segmento
FROM base;

-- alertas_semanales: re-create to pick up new columns (including segmento)
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
  servicio_mas_frecuente,
  operadora_favorita,
  ultimo_contacto_fecha,
  categoria,
  oportunidad_cross_sell,
  candidata_reactivacion,
  segmento,
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
