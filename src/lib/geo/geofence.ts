// src/lib/geo/geofence.ts
// Validación geolocalizada precisa para marcaciones móviles con fórmula de Haversine

export interface GeoCoordinate {
  latitude: number;
  longitude: number;
}

export interface GeofenceConfig {
  center: GeoCoordinate;
  radiusMeters: number;
  maxAcceptableAccuracyMeters?: number; // Ej: 100 metros
}

export interface GeofenceValidationResult {
  isValid: boolean;
  distanceMeters: number;
  accuracy: number;
  isAccuracyAcceptable: boolean;
  isWithinRadius: boolean;
  errorCode?: 'OUT_OF_BOUNDS' | 'LOW_ACCURACY' | 'INVALID_COORDINATES';
  message: string;
}

/**
 * Calcula la distancia en metros entre dos puntos geográficos (Haversine)
 */
export function calculateDistanceMeters(point1: GeoCoordinate, point2: GeoCoordinate): number {
  const R = 6371e3; // Radio de la Tierra en metros
  const lat1Rad = (point1.latitude * Math.PI) / 180;
  const lat2Rad = (point2.latitude * Math.PI) / 180;
  const deltaLatRad = ((point2.latitude - point1.latitude) * Math.PI) / 180;
  const deltaLngRad = ((point2.longitude - point1.longitude) * Math.PI) / 180;

  const a =
    Math.sin(deltaLatRad / 2) * Math.sin(deltaLatRad / 2) +
    Math.cos(lat1Rad) * Math.cos(lat2Rad) * Math.sin(deltaLngRad / 2) * Math.sin(deltaLngRad / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
}

/**
 * Valida si las coordenadas del usuario están dentro del radio permitido y tienen precisión aceptable
 */
export function validateGeofence(
  userCoord: GeoCoordinate,
  accuracy: number,
  config: GeofenceConfig
): GeofenceValidationResult {
  // Validar coordenadas válidas
  if (
    typeof userCoord.latitude !== 'number' ||
    typeof userCoord.longitude !== 'number' ||
    isNaN(userCoord.latitude) ||
    isNaN(userCoord.longitude) ||
    userCoord.latitude < -90 ||
    userCoord.latitude > 90 ||
    userCoord.longitude < -180 ||
    userCoord.longitude > 180
  ) {
    return {
      isValid: false,
      distanceMeters: -1,
      accuracy,
      isAccuracyAcceptable: false,
      isWithinRadius: false,
      errorCode: 'INVALID_COORDINATES',
      message: 'Las coordenadas enviadas no son válidas.',
    };
  }

  const maxAccuracy = config.maxAcceptableAccuracyMeters ?? 120; // Hasta 120 metros de tolerancia en GPS móvil
  const isAccuracyAcceptable = accuracy <= maxAccuracy;

  const distanceMeters = calculateDistanceMeters(userCoord, config.center);
  // Permitimos un margen de tolerancia basado en la precisión del GPS
  // Si el usuario está a 320m con radio de 300m pero su precisión es de 30m, puede estar dentro.
  const effectiveTolerance = config.radiusMeters + Math.min(accuracy / 2, 50);
  const isWithinRadius = distanceMeters <= effectiveTolerance;

  if (!isAccuracyAcceptable) {
    return {
      isValid: false,
      distanceMeters,
      accuracy,
      isAccuracyAcceptable: false,
      isWithinRadius,
      errorCode: 'LOW_ACCURACY',
      message: `La precisión del GPS es baja (±${Math.round(accuracy)}m). Te recomendamos salir a cielo abierto o esperar unos segundos para que el sensor capte mejor señal.`,
    };
  }

  if (!isWithinRadius) {
    const diff = Math.round(distanceMeters - config.radiusMeters);
    return {
      isValid: false,
      distanceMeters,
      accuracy,
      isAccuracyAcceptable: true,
      isWithinRadius: false,
      errorCode: 'OUT_OF_BOUNDS',
      message: `Estás fuera del radio de marcación. Te encuentras a ${distanceMeters}m de la sede (el límite es ${config.radiusMeters}m, estás a ${diff}m de distancia). Si estás en tu puesto de trabajo, podés solicitar una revisión.`,
    };
  }

  return {
    isValid: true,
    distanceMeters,
    accuracy,
    isAccuracyAcceptable: true,
    isWithinRadius: true,
    message: `Ubicación verificada correctamente (a ${distanceMeters}m de la sede, precisión ±${Math.round(accuracy)}m).`,
  };
}
