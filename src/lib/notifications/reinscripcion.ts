import type { Alumno } from "@/lib/api/client";
import { getNow } from "@/lib/devtools/clock";
import {
  getSetting,
  setSetting,
  SETTING_ADEUDO_ALERTS_OPT_IN,
  SETTING_REINS_ALERTS_STATE,
} from "@/lib/storage/settingsStore";

export type ReinscripcionAlertKind = "changed" | "24h" | "5min" | "10s";
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
  changed: "Cambió tu fecha de reinscripción.",
  "24h": "Reinscripción mañana (faltan 24 horas).",
  "5min": "Tu reinscripción cierra en 5 minutos.",
  "10s": "Tu reinscripción cierra en 10 segundos.",
};

const ALERT_KINDS: readonly ReinscripcionAlertKind[] = [
  "changed",
  "24h",
  "5min",
  "10s",
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
 * Pure decision (no storage, no timers): which alert to fire now, given the
 * previously known date, the current one and the kinds already announced for
 * the current date. Alerts only apply while the reinscription date is still
 * in the future; once it is reached or has passed there is nothing to say.
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
  // Ya ocurrió (o está ocurriendo): no hay aviso.
  if (remainingMs <= 0) return null;

  // La fecha se movió entre dos fetches reales: aviso de cambio (una vez por
  // fecha nueva, sin importar en qué ventana esté).
  if (
    previousIso !== null &&
    previousIso !== current &&
    !fired.includes("changed")
  ) {
    return { kind: "changed", fecha };
  }

  // Ventanas temporales: se elige la más estrecha que aplica; cada una se
  // anuncia una sola vez.
  const kind: ReinscripcionAlertKind | null =
    remainingMs <= 10 * SEGUNDO_MS
      ? "10s"
      : remainingMs <= 5 * MINUTO_MS
        ? "5min"
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
  const raw = await getSetting(SETTING_REINS_ALERTS_STATE).catch(
    () => null,
  );
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