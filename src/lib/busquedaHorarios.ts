// Chequeo diario de búsqueda de calendario/prehorario. Toda la lógica es pura
// y recibe la hora desde fuera (getNow()), de modo que el modo dev puede
// testearlo con su reloj simulado. El chequeo no depende de una sesión activa:
// aunque los datos del alumno estén desactualizados, el avance de fases se
// decide solo con el reloj y el estado persistido.

export const HORAS_ENTRE_CHEQUEOS = 24;

export interface ConfigChequeoHorarios {
  /** Primer día en que toca buscar el calendario oficial (null = nunca). */
  arranqueBusquedaCalendario: Date | null;
  /** Días a esperar desde el inicio de labores antes de buscar prehorario. */
  diasTrasLabores: number;
}

/** Ventana de búsqueda del calendario oficial (15 de diciembre del ciclo en curso). */
export const FECHA_INICIO_BUSQUEDA_CALENDARIO = new Date(2026, 11, 15);

export const CONFIG_CHEQUEO_HORARIOS: ConfigChequeoHorarios = {
  arranqueBusquedaCalendario: FECHA_INICIO_BUSQUEDA_CALENDARIO,
  diasTrasLabores: 1,
};

export interface EstadoChequeoHorarios {
  /** Última vez que se ejecutó el chequeo (null = nunca). */
  ultimoChequeo: Date | null;
  /** Archivo del calendario oficial visto por última vez (null = ninguno). */
  calendarioVisto: string | null;
  /** Fecha de inicio de labores elegida (null = sin extraer/asignar). */
  fechaInicioLabores: Date | null;
  /** Archivo del prehorario visto por última vez (null = ninguno). */
  prehorarioVisto: string | null;
}

export function estadoChequeoVacio(): EstadoChequeoHorarios {
  return {
    ultimoChequeo: null,
    calendarioVisto: null,
    fechaInicioLabores: null,
    prehorarioVisto: null,
  };
}

export function parseEstadoChequeo(raw: string | null): EstadoChequeoHorarios {
  if (!raw) return estadoChequeoVacio();
  try {
    const obj = JSON.parse(raw) as Record<string, string | null>;

    return {
      ultimoChequeo: obj.ultimoChequeo ? new Date(obj.ultimoChequeo) : null,
      calendarioVisto: obj.calendarioVisto ?? null,
      fechaInicioLabores: obj.fechaInicioLabores
        ? new Date(obj.fechaInicioLabores)
        : null,
      prehorarioVisto: obj.prehorarioVisto ?? null,
    };
  } catch {
    return estadoChequeoVacio();
  }
}

export function serializarEstadoChequeo(
  estado: EstadoChequeoHorarios,
): string {
  return JSON.stringify({
    ultimoChequeo: estado.ultimoChequeo?.toISOString() ?? null,
    calendarioVisto: estado.calendarioVisto,
    fechaInicioLabores: estado.fechaInicioLabores?.toISOString() ?? null,
    prehorarioVisto: estado.prehorarioVisto,
  });
}

/** Faltan `horas` desde el último chequeo (referencia null = nunca se chequeó). */
export function tocaChequear(
  ultimoChequeo: Date | null,
  ahora: Date,
  horas = HORAS_ENTRE_CHEQUEOS,
): boolean {
  if (ultimoChequeo === null) return true;

  return ahora.getTime() - ultimoChequeo.getTime() >= horas * 3_600_000;
}

/**
 * Elige UNA (la próxima) fecha de inicio de labores que aún no haya pasado.
 * El calendario oficial trae dos (uno por periodo); la que ya ocurrió se
 * descarta.
 */
export function elegirProximaFechaLabores(
  fechas: readonly Date[],
  ahora: Date,
): Date | null {
  return fechas
    .filter(fecha => fecha.getTime() > ahora.getTime())
    .sort((a, b) => a.getTime() - b.getTime())[0] ?? null;
}

export type FaseChequeoHorarios =
  | "antes-buscar-calendario"
  | "buscar-calendario"
  | "procesar-calendario"
  | "esperar-labores"
  | "buscar-prehorario"
  | "completado";

export interface ResultadoChequeo {
  fase: FaseChequeoHorarios;
  tocaAccion: boolean;
  descripcion: string;
}

const FASES_CON_ACCION: ReadonlySet<FaseChequeoHorarios> = new Set([
  "buscar-calendario",
  "procesar-calendario",
  "buscar-prehorario",
]);

/** Decide qué toca según el estado persistido y el reloj actual. */
export function decidirFase(
  estado: EstadoChequeoHorarios,
  ahora: Date,
  config: ConfigChequeoHorarios = CONFIG_CHEQUEO_HORARIOS,
): ResultadoChequeo {
  const conAccion = (fase: FaseChequeoHorarios, descripcion: string) => ({
    fase,
    descripcion,
    tocaAccion: FASES_CON_ACCION.has(fase),
  });

  if (estado.prehorarioVisto !== null) {
    return conAccion(
      "completado",
      "Prehorario ya visto; no hay nada que buscar por ahora.",
    );
  }

  if (estado.fechaInicioLabores !== null) {
    const espera = new Date(
      estado.fechaInicioLabores.getTime() + config.diasTrasLabores * 86_400_000,
    );
    if (ahora.getTime() >= espera.getTime()) {
      return conAccion(
        "buscar-prehorario",
        `Toca buscar el prehorario (inicio de labores ${estado.fechaInicioLabores.toISOString()} + ${config.diasTrasLabores} día).`,
      );
    }

    return conAccion(
      "esperar-labores",
      `Esperando al inicio de labores ${estado.fechaInicioLabores.toISOString()} (+ ${config.diasTrasLabores} día).`,
    );
  }

  if (estado.calendarioVisto !== null) {
    return conAccion(
      "procesar-calendario",
      "Calendario visto; falta extraer las fechas de inicio de labores del PDF.",
    );
  }

  if (
    config.arranqueBusquedaCalendario === null ||
    ahora.getTime() < config.arranqueBusquedaCalendario.getTime()
  ) {
    return conAccion(
      "antes-buscar-calendario",
      "Todavía no toca buscar el calendario.",
    );
  }

  return conAccion(
    "buscar-calendario",
    "Toca buscar el calendario oficial.",
  );
}