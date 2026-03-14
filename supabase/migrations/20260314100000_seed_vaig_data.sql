-- Seed data: profesionales, servicios y config de VAIG
-- Datos extraídos de vaig.koob.uy

-- ============================================================
-- 1. PROFESIONALES
-- ============================================================
INSERT INTO professionals (name, specialties, is_active) VALUES
  ('Cynthia',      ARRAY['masajes','estética'],          true),
  ('Lucia',        ARRAY['masajes','depilación'],         true),
  ('Stephany',     ARRAY['uñas','estética'],              true),
  ('Angel',        ARRAY['masajes','depilación'],         true),
  ('Iara Machado', ARRAY['facial','cejas','pestañas'],    true);

-- ============================================================
-- 2. SERVICIOS
-- ============================================================

-- Masaje Terapéutico
INSERT INTO services (name, duration_minutes, price, deposit_amount, is_active) VALUES
  ('Masaje terapéutico cuerpo completo',            60,  1930, 0, true),
  ('Masaje descontracturante/relajante',            60,  1600, 0, true),
  ('Masaje descontracturante',                      60,  1600, 0, true),
  ('Masaje relajante',                              60,  1600, 0, true),
  ('Masaje piedras calientes',                      60,  1930, 0, true),
  ('Drenaje linfático completo',                    90,  2220, 0, true);

-- Masaje Deportivo
INSERT INTO services (name, duration_minutes, price, deposit_amount, is_active) VALUES
  ('Masaje deportivo',                              45,  1390, 0, true);

-- Masaje Estético
INSERT INTO services (name, duration_minutes, price, deposit_amount, is_active) VALUES
  ('Maderoterapia abdomen y piernas',               60,  1930, 0, true),
  ('Reductores abdomen y piernas',                  90,  1930, 0, true),
  ('Maderoterapia combo',                           90,  2220, 0, true),
  ('Drenaje piernas',                               60,  1600, 0, true),
  ('Reductores zona',                               60,  1600, 0, true);

-- Masaje Revitalizante
INSERT INTO services (name, duration_minutes, price, deposit_amount, is_active) VALUES
  ('Descontracturante + drenaje piernas',           90,  2220, 0, true);

-- Masaje Embarazadas
INSERT INTO services (name, duration_minutes, price, deposit_amount, is_active) VALUES
  ('Masaje relajante embarazadas',                  60,  1680, 0, true),
  ('Masaje descontracturante + drenaje embarazadas',90,  2220, 0, true),
  ('Drenaje completo embarazadas',                  90,  2220, 0, true),
  ('Drenaje piernas embarazadas',                   60,  1600, 0, true);

-- Servicios Faciales
INSERT INTO services (name, duration_minutes, price, deposit_amount, is_active) VALUES
  ('Limpieza facial',                               90,  2000, 0, true),
  ('Dermaplaning',                                  90,  2200, 0, true),
  ('Antiacné luz pulsada',                          30,  1500, 0, true),
  ('Plasmapen',                                     60,  4000, 0, true);

-- Servicios Cejas
INSERT INTO services (name, duration_minutes, price, deposit_amount, is_active) VALUES
  ('Cejas método T.A.S',                            60,  2150, 0, true),
  ('Perfilado de cejas',                            60,  1050, 0, true),
  ('Laminado de cejas',                             90,  1800, 0, true);

-- Lifting de pestañas
INSERT INTO services (name, duration_minutes, price, deposit_amount, is_active) VALUES
  ('Lifting de pestañas',                           90,  1980, 0, true);

-- Manos y Pies
INSERT INTO services (name, duration_minutes, price, deposit_amount, is_active) VALUES
  ('Semi permanente',                               60,  1200, 0, true),
  ('Kapping gel',                                   90,  1400, 0, true),
  ('Estética de pies',                              60,  1200, 0, true),
  ('Esculpidas gel',                               180,  1840, 0, true),
  ('Esmaltado común',                               60,   650, 0, true),
  ('Retirado esculpidas',                           60,   500, 0, true),
  ('Mantenimiento esculpidas',                     120,  1500, 0, true),
  ('Retirado semi + común',                         60,   850, 0, true),
  ('Manos y pies',                                 120,  2340, 0, true);

-- Depilación Láser
INSERT INTO services (name, duration_minutes, price, deposit_amount, is_active) VALUES
  ('Depilación láser labio',                        15,   380, 0, true),
  ('Depilación láser mentón',                       15,   380, 0, true),
  ('Depilación láser axilas',                       15,   550, 0, true),
  ('Depilación láser ingles',                       20,   650, 0, true),
  ('Depilación láser ingles completas',             20,   780, 0, true),
  ('Depilación láser media pierna',                 30,   950, 0, true),
  ('Depilación láser pierna completa',              45,  1400, 0, true),
  ('Depilación láser media pierna + ingles',        45,  1350, 0, true),
  ('Depilación láser pierna + ingles',              60,  1800, 0, true),
  ('Depilación láser zona bikini',                  20,   650, 0, true),
  ('Depilación láser cola',                         20,   550, 0, true),
  ('Depilación láser antebrazo',                    20,   650, 0, true),
  ('Depilación láser brazo completo',               30,   950, 0, true),
  ('Depilación láser espalda',                      30,   950, 0, true),
  ('Depilación láser abdomen',                      20,   550, 0, true);

-- Day Spa
INSERT INTO services (name, duration_minutes, price, deposit_amount, is_active) VALUES
  ('Day Spa Ritual Relax',                         150,  3341, 0, true),
  ('Day Spa Experiencia Premium',                  240,  5083, 0, true),
  ('Day Spa Facial Spa',                           120,  3485, 0, true),
  ('Day Spa Momentos de Desconexión',              150,  3341, 0, true);

-- Aparatología
INSERT INTO services (name, duration_minutes, price, deposit_amount, is_active) VALUES
  ('Ultrasonido',                                   60,  1600, 0, true),
  ('Hidratación facial profunda',                   60,  2400, 0, true);

-- Hifu
INSERT INTO services (name, duration_minutes, price, deposit_amount, is_active) VALUES
  ('Hifu evaluación',                               30,   800, 0, true),
  ('Hifu abdomen',                                 180, 10000, 0, true),
  ('Hifu rostro',                                  120, 10500, 0, true),
  ('Hifu abdomen 4h',                              240, 14000, 0, true),
  ('Hifu papada',                                   60,  4500, 0, true);

-- Otros tratamientos corporales
INSERT INTO services (name, duration_minutes, price, deposit_amount, is_active) VALUES
  ('Electrodos',                                    60,  1930, 0, true),
  ('Ultracavitador',                                60,  1930, 0, true),
  ('Exfoliación corporal',                          60,  1600, 0, true),
  ('Nutrición corporal',                            60,  2400, 0, true);

-- Combos con precio fijo
INSERT INTO services (name, duration_minutes, price, deposit_amount, is_active) VALUES
  ('Combo limpieza facial + perfilado cejas',      120,  2510, 0, true),
  ('Combo lifting pestañas + perfilado cejas',     120,  2580, 0, true),
  ('Combo masajes + limpieza cutis',               180,  3060, 0, true);

-- ============================================================
-- 3. SYSTEM CONFIG adicional
-- ============================================================
INSERT INTO system_config (key, value) VALUES
  ('address',               'REDACTED'),
  ('phone',                 'REDACTED'),
  ('access_instructions',   'PIN DE ACCESO FOXYS PARA INGRESAR: REDACTED. En la puerta de vidrio: REDACTED#'),
  ('preparation_notes',     'Depilación: venir rasurada del día anterior. Facial/lifting/cejas: venir sin maquillaje.'),
  ('bank_brou',             'REDACTED'),
  ('bank_itau',             'REDACTED'),
  ('payment_instructions',  'Transferir a nombre/apellido. Enviar comprobante por WhatsApp. Sin confirmación en 24h se cancela la reserva.')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();
