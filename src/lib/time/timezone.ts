// src/lib/time/timezone.ts
// Manejo consistente de zona horaria oficial: America/Asuncion (Paraguay)

export const APP_TIMEZONE = 'America/Asuncion';

/**
 * Obtiene la fecha y hora actual en la zona horaria de Asunción
 */
export function getNowInAsuncion(): Date {
  return new Date();
}

/**
 * Formatea una fecha/instante a string YYYY-MM-DD en America/Asuncion
 */
export function formatDateAsuncion(date: Date | string | number): string {
  const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

/**
 * Formatea una fecha/instante a hora HH:mm en America/Asuncion
 */
export function formatTimeAsuncion(date: Date | string | number | null | undefined): string {
  if (!date) return '--:--';
  const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
  return new Intl.DateTimeFormat('es-PY', {
    timeZone: APP_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d);
}

/**
 * Formatea una fecha a formato legible en español (ej: "Lunes 16 de Noviembre de 2026")
 */
export function formatFullDateEs(dateStr: string | Date): string {
  const d = typeof dateStr === 'string' ? new Date(`${dateStr}T12:00:00Z`) : dateStr;
  return new Intl.DateTimeFormat('es-PY', {
    timeZone: APP_TIMEZONE,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(d);
}

/**
 * Nombre del día en español (ej: "Lunes", "Martes")
 */
export function getDayNameEs(dateStr: string | Date): string {
  const d = typeof dateStr === 'string' ? new Date(`${dateStr}T12:00:00Z`) : dateStr;
  const name = new Intl.DateTimeFormat('es-PY', {
    timeZone: APP_TIMEZONE,
    weekday: 'long',
  }).format(d);
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/**
 * Día corto en español (ej: "Lun", "Mar", "Mié")
 */
export function getShortDayNameEs(dateStr: string | Date): string {
  const d = typeof dateStr === 'string' ? new Date(`${dateStr}T12:00:00Z`) : dateStr;
  const name = new Intl.DateTimeFormat('es-PY', {
    timeZone: APP_TIMEZONE,
    weekday: 'short',
  }).format(d);
  return name.charAt(0).toUpperCase() + name.slice(1).replace('.', '');
}

/**
 * Calcula las horas trabajadas, horas diurnas y nocturnas según entrada y salida.
 * Soporta jornadas que cruzan medianoche (ej: entrada 22:00, salida 06:00).
 * Franja nocturna configurable (por defecto 20:00 a 06:00).
 */
export function calculateShiftHours(
  clockIn: Date | string,
  clockOut: Date | string,
  nightStartHour = 20, // 20:00
  nightEndHour = 6     // 06:00
): {
  totalHours: number;
  dayHours: number;
  nightHours: number;
  workedDays: number;
} {
  const inDate = typeof clockIn === 'string' ? new Date(clockIn) : clockIn;
  const outDate = typeof clockOut === 'string' ? new Date(clockOut) : clockOut;

  const diffMs = outDate.getTime() - inDate.getTime();
  if (diffMs <= 0) {
    return { totalHours: 0, dayHours: 0, nightHours: 0, workedDays: 0 };
  }

  const totalHours = Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100;

  // Calculamos minuto a minuto o por bloques para exactitud total con zona horaria de Asunción
  let nightMinutes = 0;
  const stepMs = 60 * 1000; // 1 minuto
  let currentMs = inDate.getTime();
  const endMs = outDate.getTime();

  while (currentMs < endMs) {
    const curDate = new Date(currentMs);
    // Extraemos la hora en Asunción
    const hourStr = new Intl.DateTimeFormat('en-US', {
      timeZone: APP_TIMEZONE,
      hour: 'numeric',
      hour12: false,
    }).format(curDate);
    const hour = parseInt(hourStr, 10);

    // ¿Es hora nocturna? (hora >= 20 || hora < 6)
    const isNight = hour >= nightStartHour || hour < nightEndHour;
    if (isNight) {
      nightMinutes++;
    }
    currentMs += stepMs;
  }

  const nightHours = Math.round((nightMinutes / 60) * 100) / 100;
  const dayHours = Math.round(Math.max(0, totalHours - nightHours) * 100) / 100;

  // Si trabajó 4 horas o más pero menos de 7 -> medio jornal (0.5), si >= 7 -> día completo (1.0)
  let workedDays = 0;
  if (totalHours >= 7) {
    workedDays = 1.0;
  } else if (totalHours >= 4) {
    workedDays = 0.5;
  } else if (totalHours > 0) {
    workedDays = Math.round((totalHours / 8) * 100) / 100;
  }

  return {
    totalHours,
    dayHours,
    nightHours,
    workedDays,
  };
}

/**
 * Genera el array de fechas para un rango (inclusive)
 */
export function getDatesInRange(startDateStr: string, endDateStr: string): string[] {
  const dates: string[] = [];
  let curr = new Date(`${startDateStr}T12:00:00Z`);
  const end = new Date(`${endDateStr}T12:00:00Z`);

  while (curr <= end) {
    const y = curr.getUTCFullYear();
    const m = String(curr.getUTCMonth() + 1).padStart(2, '0');
    const d = String(curr.getUTCDate()).padStart(2, '0');
    dates.push(`${y}-${m}-${d}`);
    curr.setUTCDate(curr.getUTCDate() + 1);
  }
  return dates;
}

/**
 * Devuelve presets de fechas comunes en Asunción
 */
export function getDateRangePresets(referenceDate = new Date()) {
  const todayStr = formatDateAsuncion(referenceDate);
  const [yearStr, monthStr] = todayStr.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);

  // Último día del mes actual
  const lastDay = new Date(year, month, 0).getDate();

  return {
    hoy: {
      label: 'Hoy',
      startDate: todayStr,
      endDate: todayStr,
    },
    primeraQuincena: {
      label: '1ª Quincena (1 al 15)',
      startDate: `${yearStr}-${monthStr}-01`,
      endDate: `${yearStr}-${monthStr}-15`,
    },
    segundaQuincena: {
      label: `2ª Quincena (16 al ${lastDay})`,
      startDate: `${yearStr}-${monthStr}-16`,
      endDate: `${yearStr}-${monthStr}-${String(lastDay).padStart(2, '0')}`,
    },
    mesCompleto: {
      label: 'Mes completo',
      startDate: `${yearStr}-${monthStr}-01`,
      endDate: `${yearStr}-${monthStr}-${String(lastDay).padStart(2, '0')}`,
    },
    noviembreDemo: {
      label: 'Noviembre 2026 (Demo MEPY)',
      startDate: '2026-11-01',
      endDate: '2026-11-30',
    },
  };
}
