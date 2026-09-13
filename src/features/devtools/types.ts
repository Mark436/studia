import { DEFAULT_TOAST_DURATION_MS } from "@/components/ui/toastVariants";

export interface DevMateria {
  clave: string;
  nombre: string;
  docente: string;
  salon: string;
  // Weekdays following mapHorario's convention: 1 = lunes … 6 = sábado.
  dias: number[];
  inicio: string;
  fin: string;
  calificacion: string;
}

// Developer/simulation overrides only. Data simulation (grades, materias,
// adeudos, clock) lives in the DevTestEnvironment mock state; this config is
// reduced to the panel's own preferences.
export interface DevConfig {
  // Dev-only toast test duration; applied only while the panel is enabled.
  toastDurationMs: number;
}

export const EMPTY_DEV_CONFIG: DevConfig = {
  toastDurationMs: DEFAULT_TOAST_DURATION_MS,
};