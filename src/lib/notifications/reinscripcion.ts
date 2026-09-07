import type { Alumno } from "@/lib/api/client";
import { getNow } from "@/lib/devtools/clock";
import {
  getSetting,
  setSetting,
  SETTING_ADEUDO_ALERTS_OPT_IN,
  SETTING_REINS_ALERTS_STATE,
} from "@/lib/storage/settingsStore";

export type ReinscripcionAlertKind = "discovered" | "24h" | "30min" | "start";
export type ReinscripcionAlertOutcome = ReinscripcionAlertKind | "none";

export interface ReinscripcionAlert {
  kind: ReinscripcionAlertKind;
  fecha: Date;
}

const SEGUNDO_MS = 1_000;
const MINUTO_MS = 60 * SEGUNDO_MS;
const DIA_MS = 24 * 60 * MINUTO_MS;

// Single source for the copy shared by the in-app toast and the system push.
export const REINSCRIPCION_ALERT_MESSAGES: Record<
  ReinscripcionAlertKind,
  string
> = {
  discovered: "Ya tienes fecha para tu reinscripción.",
  "24h": "Reinscripción mañana (faltan 24 horas).",
  "30min": "Tu reinscripción empieza en 30 minutos.",
  start: "Tu turno de reinscripción ya empezó.",
};

const ALERT_KINDS: readonly ReinscripcionAlertKind[] = [
  "discovered",
  "24h",
  "30min",
  "start",
];

function isAlertKind(value: unknown): value is ReinscripcionAlertKind {
  return ALERT_KINDS.includes(value as ReinscripcionAlertKind);
}

export function parseReinscripcionDate(alumno: Alumno | null): Date | null {
  if (!alumno) return null;
  const iso = alumno.fechaReinscripcion?.trim();
  if (!iso) return null;

  const fecha = new Date(iso);
  return Number.isNaN(fecha.getTime()) ? null : fecha;
}

/**
 * Pure helper (no storage, no timers): how far we are from (or into) the
 * student's reinscription turn, given the API date. Used by the alert logic
 * (`getReinscripcionAlert`), by the in-app ReinscripcionCard, and by the dev
 * test button. Returns a status plus split time units relative to `now`.
 */
export type ReinscripcionTimeStatus =
  | { status: "no-date"; fecha: null }
  | {
      status: "future";
      fecha: Date;
      days: number;
      hours: number;
      minutes: number;
    }
  | { status: "active"; fecha: Date; days: number; hours: number; minutes: number }
  | { status: "past"; fecha: Date };

export function getTimeUntilReinscripcion(
  alumno: Alumno | null,
  now: Date,
): ReinscripcionTimeStatus {
  const fecha = parseReinscripcionDate(alumno);
  if (!fecha) return { status: "no-date", fecha: null };

  const remainingMs = fecha.getTime() - now.getTime();

  if (remainingMs > 0) {
    const days = Math.floor(remainingMs / DIA_MS);
    const hours = Math.floor((remainingMs % DIA_MS) / (60 * MINUTO_MS));
    const minutes = Math.floor(
      (remainingMs % (60 * MINUTO_MS)) / MINUTO_MS,
    );
    return { status: "future", fecha, days, hours, minutes };
  }

  // El turno ya empezó (o ha pasado). Lo mantenemos visible un rato razonable
  // (24 h) después de que la fecha ya ocurrió; pasado eso no interesa.
  const sinceMs = Math.abs(remainingMs);
  if (sinceMs <= DIA_MS) {
    const days = Math.floor(sinceMs / DIA_MS);
    const hours = Math.floor((sinceMs % DIA_MS) / (60 * MINUTO_MS));
    const minutes = Math.floor((sinceMs % (60 * MINUTO_MS)) / MINUTO_MS);
    return { status: "active", fecha, days, hours, minutes };
  }

  return { status: "past", fecha };
}

/**
 * Pure decision (no storage, no timers): which alert to fire now, given the
 * previously known date, the current one and the kinds already announced for
 * the current date. Alerts only apply while the reinscription date is still
 * in the future, except `start`, which fires when the turn has begun.
 */
export function getReinscripcionAlert(
  previousIso: string | null,
  currentIso: string | null,
  now: Date,
  fired: readonly ReinscripcionAlertKind[],
): ReinscripcionAlert | null {
  const current = currentIso?.trim();
  if (!current) return null;

  const fecha = new Date(current);
  if (Number.isNaN(fecha.getTime())) return null;

  const remainingMs = fecha.getTime() - now.getTime();

  // El turno (o la fecha) ya empezó/ocurrió: avisamos "start" una sola vez.
  if (remainingMs <= 0) {
    if (fired.includes("start")) return null;
    return { kind: "start", fecha };
  }

  // La fecha aparece por primera vez (o cambió entre dos fetchs reales) y es
  // futura: aviso de descubrimiento una vez por fecha.
  if (
    (previousIso === null || previousIso !== current) &&
    !fired.includes("discovered")
  ) {
    return { kind: "discovered", fecha };
  }

  // Ventanas temporales: se elige la más estrecha que aplica; cada una se
  // anuncia una sola vez. Faltan 30 min / 24 h antes de la fecha.
  const kind: ReinscripcionAlertKind | null =
    remainingMs <= 30 * MINUTO_MS
      ? "30min"
      : remainingMs <= DIA_MS
        ? "24h"
        : null;

  if (kind === null || fired.includes(kind)) return null;
  return { kind, fecha };
}

interface ReinscripcionAlertState {
  fechaIso: string;
  fired: ReinscripcionAlertKind[];
}

async function readAlertState(): Promise<ReinscripcionAlertState | null> {
  const raw = await getSetting(SETTING_REINS_ALERTS_STATE).catch(() => null);
  if (!raw) return null;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      typeof (parsed as Record<string, unknown>).fechaIso === "string" &&
      Array.isArray((parsed as Record<string, unknown>).fired)
    ) {
      const record = parsed as Record<string, unknown>;
      return {
        fechaIso: typeof record.fechaIso === "string" ? record.fechaIso : "",
        fired: (Array.isArray(record.fired) ? record.fired : []).filter(
          isAlertKind,
        ),
      };
    }
  } catch {
    // Estado corrupto: se reemplaza en el siguiente aviso.
  }
  return null;
}

/**
 * Runs on every real fetch (login/refresh). Fires an alert only when the date
 * is still in the future AND the corresponding stage has not been announced
 * yet for that date. The in-app toast surfaces regardless of the system
 * notification opt-in; the push only if opted in and permitted.
 */
export async function notifyNewReinscripcion(
  previousAlumno: Alumno | null,
  nextAlumno: Alumno,
): Promise<ReinscripcionAlertOutcome> {
  const fecha = parseReinscripcionDate(nextAlumno);
  if (!fecha) return "none";

  const iso = nextAlumno.fechaReinscripcion.trim();
  const previousIso = previousAlumno?.fechaReinscripcion?.trim() ?? null;

  const state = await readAlertState();
  const fired = state?.fechaIso === iso ? state.fired : [];

  const alert = getReinscripcionAlert(previousIso, iso, getNow(), fired);
  if (!alert) return "none";

  await showLocalReinscripcionPush(alert.kind);
  await setSetting(
    SETTING_REINS_ALERTS_STATE,
    JSON.stringify({ fechaIso: iso, fired: [...fired, alert.kind] } satisfies
      ReinscripcionAlertState),
  ).catch(() => undefined);

  return alert.kind;
}

// Shares the single system-notification opt-in and permission gate with the
// adeudo and progress alerts: one switch covers all local pushes.
async function showLocalReinscripcionPush(
  kind: ReinscripcionAlertKind,
): Promise<void> {
  try {
    const optedIn =
      (await getSetting(SETTING_ADEUDO_ALERTS_OPT_IN)) === "true";
    if (
      !optedIn ||
      typeof Notification === "undefined" ||
      Notification.permission !== "granted"
    ) {
      return;
    }

    const registration = await navigator.serviceWorker.ready;
    await registration.showNotification("Reinscripción", {
      body: REINSCRIPCION_ALERT_MESSAGES[kind],
      tag: "reinscripcion",
    });
  } catch (error) {
    console.warn(
      "No se pudo mostrar la notificación de reinscripción.",
      error,
    );
  }
}
