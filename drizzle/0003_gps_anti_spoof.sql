-- Migration: 0003_gps_anti_spoof
-- Agrega columnas de detección de GPS falso a la tabla de asistencias.
-- gps_risk_score: 0-100, 0 = limpio, >=50 = alerta para admin
-- gps_risk_flags: JSON array de señales detectadas (texto serializado)

ALTER TABLE "attendances"
  ADD COLUMN IF NOT EXISTS "gps_risk_score" integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "gps_risk_flags" text;
