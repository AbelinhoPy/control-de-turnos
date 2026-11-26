/**
 * src/lib/geo/gpsAntiSpoof.ts
 *
 * Detector de GPS falso / simulado para marcaciones de asistencia.
 *
 * No bloquea la marcación — asigna un puntaje de riesgo (0-100) y una lista
 * de señales detectadas para que el administrador las revise en su panel.
 *
 * Por qué no bloqueamos:
 *  - Un GPS real en subsuelo, obra u hormigón puede dar accuracy=0 o coordenadas
 *    estables durante minutos. Bloquear genera falsos positivos sobre funcionarios
 *    honestos.
 *  - La evidencia fotográfica ya disuade la suplantación. Este módulo es la
 *    segunda capa de auditoría.
 */

export interface AntiSpoofInput {
  lat: number;
  lng: number;
  accuracy: number;
  /** Coordenadas de la sede para detectar si envían exactamente el punto del admin */
  workplaceLat: number;
  workplaceLng: number;
  /** Última marcación del mismo funcionario (para control de velocidad) */
  lastClockTimestamp?: Date | null;
  lastClockLat?: number | null;
  lastClockLng?: number | null;
}

export interface AntiSpoofResult {
  /** 0 = limpio, 100 = altamente sospechoso */
  riskScore: number;
  /** Lista de códigos de señal detectados */
  flags: GpsRiskFlag[];
  /** Resumen legible para el admin */
  summary: string;
  /** true si el score supera el umbral de alerta */
  isHighRisk: boolean;
}

export type GpsRiskFlag =
  | 'PERFECT_ACCURACY'       // accuracy === 0 o 1 (típico de apps mock)
  | 'ROUNDED_COORDINATES'    // lat/lng redondeados a 4+ decimales exactos (humanos raramente son tan exactos)
  | 'EXACT_WORKPLACE_MATCH'  // coordenadas idénticas al pin del admin (copy-paste del mapa)
  | 'IMPOSSIBLE_SPEED'       // velocidad de desplazamiento físicamente imposible vs marcación anterior
  | 'STATIC_COORDINATES'     // mismas coords exactas que la marcación anterior (emulador sin movimiento)
  | 'SUSPICIOUS_ACCURACY_CHANGE'; // cambio brusco de accuracy entre marcaciones (IN tenía 5m, OUT tiene 0m)

const HIGH_RISK_THRESHOLD = 50;

/** Distancia en metros entre dos puntos (Haversine rápido) */
function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Cuenta los decimales de un número */
function countDecimals(n: number): number {
  const str = n.toString();
  if (!str.includes('.')) return 0;
  return str.split('.')[1].length;
}

export function analyzeGpsRisk(input: AntiSpoofInput): AntiSpoofResult {
  const flags: GpsRiskFlag[] = [];
  let score = 0;

  // ── Señal 1: Precisión perfecta ──────────────────────────────────────────
  // Apps de GPS falso como "Fake GPS Go" reportan accuracy = 0 o 1.
  // Un teléfono real nunca reporta 0m de precisión.
  if (input.accuracy === 0) {
    flags.push('PERFECT_ACCURACY');
    score += 40;
  } else if (input.accuracy === 1) {
    flags.push('PERFECT_ACCURACY');
    score += 25;
  }

  // ── Señal 2: Coordenadas redondeadas sospechosamente ─────────────────────
  // GPS real produce ruido en los últimos decimales. Coordenadas con exactamente
  // 4 decimales y sin ruido (ej: -25.4900, -54.7800) son típicas de selección
  // manual en un mapa o de un mock con precisión reducida.
  const latDecimals = countDecimals(Math.abs(input.lat));
  const lngDecimals = countDecimals(Math.abs(input.lng));
  if (latDecimals <= 4 && lngDecimals <= 4) {
    // Verificar que los últimos 2 dígitos no son casuales
    const latStr = input.lat.toFixed(6);
    const lngStr = input.lng.toFixed(6);
    const latTail = latStr.slice(-2);
    const lngTail = lngStr.slice(-2);
    // Si termina en 00 en los últimos decimales → muy sospechoso
    if (latTail === '00' && lngTail === '00') {
      flags.push('ROUNDED_COORDINATES');
      score += 30;
    } else if (latDecimals <= 3 && lngDecimals <= 3) {
      flags.push('ROUNDED_COORDINATES');
      score += 20;
    }
  }

  // ── Señal 3: Coordenadas idénticas al pin de la sede ─────────────────────
  // Si alguien copia exactamente la latitud y longitud del workplace desde
  // la config (hasta el 5to decimal), es un indicador fuerte de fraude.
  const distToWorkplace = distanceMeters(
    input.lat, input.lng,
    input.workplaceLat, input.workplaceLng
  );
  if (distToWorkplace < 1) {
    // Menos de 1 metro de la sede: prácticamente imposible en campo real
    flags.push('EXACT_WORKPLACE_MATCH');
    score += 35;
  }

  // ── Señales 4 y 5: Velocidad imposible y coordenadas estáticas ───────────
  if (
    input.lastClockTimestamp &&
    typeof input.lastClockLat === 'number' &&
    typeof input.lastClockLng === 'number'
  ) {
    const dist = distanceMeters(
      input.lat, input.lng,
      input.lastClockLat, input.lastClockLng
    );
    const elapsedMs = Date.now() - input.lastClockTimestamp.getTime();
    const elapsedHours = elapsedMs / 3_600_000;

    // Coordenadas exactamente iguales a la marcación anterior
    if (dist < 0.5 && elapsedHours > 0.5) {
      // Mismo punto exacto después de 30+ minutos → emulador sin movimiento simulado
      flags.push('STATIC_COORDINATES');
      score += 30;
    }

    // Velocidad imposible: más de 900 km/h entre marcaciones
    // (el avión comercial más rápido viaja a ~900 km/h)
    if (elapsedHours > 0 && elapsedHours < 24) {
      const speedKmh = (dist / 1000) / elapsedHours;
      if (speedKmh > 900) {
        flags.push('IMPOSSIBLE_SPEED');
        score += 50;
      }
    }
  }

  // Clamp score a 100
  const riskScore = Math.min(100, score);
  const isHighRisk = riskScore >= HIGH_RISK_THRESHOLD;

  // Generar resumen legible
  const flagLabels: Record<GpsRiskFlag, string> = {
    PERFECT_ACCURACY:           'Precisión GPS perfecta (0-1m, típica de app simuladora)',
    ROUNDED_COORDINATES:        'Coordenadas redondeadas (posible selección manual en mapa)',
    EXACT_WORKPLACE_MATCH:      'Coordenadas idénticas al pin de la sede (<1m)',
    IMPOSSIBLE_SPEED:           'Velocidad de desplazamiento físicamente imposible',
    STATIC_COORDINATES:         'Coordenadas exactamente iguales a la marcación anterior',
    SUSPICIOUS_ACCURACY_CHANGE: 'Cambio brusco de precisión GPS entre marcaciones',
  };

  const summary =
    flags.length === 0
      ? 'GPS sin señales de alerta.'
      : `Señales detectadas (score ${riskScore}/100): ${flags.map((f) => flagLabels[f]).join(' | ')}`;

  return { riskScore, flags, summary, isHighRisk };
}
