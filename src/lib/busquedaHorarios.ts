// Chequeo diario de búsqueda de calendario/prehorario. El bucle corre una vez
// por día, anclado a las 18:00 (cuando el instituto ya subió los documentos),
// y no contabiliza si "ya se chequeó": el estado solo recuerda lo que se
// *encontró* para no repetir avisos. Toda la lógica es pura y recibe la hora
// desde fuera (getNow()), de modo que el modo dev la prueba con su reloj
// simulado. El chequeo no depende de una sesión activa.

export const HORA_CHEQUEO = 18;

/** Ventana anual de publicación del calendario escolar (mes 1..12, día). */
export interface VentanaCalendario {
  mes: number;
  dia: number;
}

export interface ConfigChequeoHorarios {
  ventanasBusquedaCalendario: readonly VentanaCalendario[];
  diasTrasLabores: number;
  horaChequeo: number;
}

/** Ventanas de búsqueda del calendario oficial (recurrentes cada año). El mes
 * es 1-based (12 = diciembre) y se convierte a índice al construir las fechas. */
export const CONFIG_CHEQUEO_HORARIOS: ConfigChequeoHorarios = {
  ventanasBusquedaCalendario: [
    { mes: 12, dia: 15 }, // 15 de diciembre → calendario del ciclo ENE-JUN
    { mes: 5, dia: 15 }, //  15 de mayo       → calendario del ciclo AGO-DIC
  ],
  diasTrasLabores: 1,
  horaChequeo: 18,
};

export interface EstadoChequeoHorarios {
  /** Último archivo de calendario oficial visto (null = ninguno). */
  calendarioVisto: string | null;
  /** Inicio de la ventana que se está cazando (ISO de fecha, null = sin asignar). */
  ventanaActiva: string | null;
  /** Fecha de inicio de labores del ciclo en curso (null = sin extraer). */
  fechaInicioLabores: Date | null;
  /** Fecha de publicación de orden de reinscripción + Prehorarios (actividad 5). */
  fechaPublicacionPrehorarios: Date | null;
  /** Último prehorario de la carrera visto (null = ninguno). */
  prehorarioVisto: string | null;
  /** Ya se avisó que el turno de reinscripción puede estar publicado. */
  avisoTurnosEnviado: boolean;
}

export function estadoChequeoVacio(): EstadoChequeoHorarios {
  return {
    calendarioVisto: null,
    ventanaActiva: null,
    fechaInicioLabores: null,
    fechaPublicacionPrehorarios: null,
    prehorarioVisto: null,
    avisoTurnosEnviado: false,
  };
}

export function parseEstadoChequeo(raw: string | null): EstadoChequeoHorarios {
  if (!raw) return estadoChequeoVacio();
  try {
    const obj = JSON.parse(raw) as Record<string, unknown>;

    const fechaDe = (valor: unknown): Date | null =>
      typeof valor === "string" ? new Date(valor) : null;
    const stringO = (valor: unknown): string | null =>
      typeof valor === "string" ? valor : null;

    return {
      calendarioVisto: stringO(obj.calendarioVisto),
      ventanaActiva: stringO(obj.ventanaActiva),
      fechaInicioLabores: fechaDe(obj.fechaInicioLabores),
      fechaPublicacionPrehorarios: fechaDe(obj.fechaPublicacionPrehorarios),
      prehorarioVisto: stringO(obj.prehorarioVisto),
      avisoTurnosEnviado: obj.avisoTurnosEnviado === true,
    };
  } catch {
    return estadoChequeoVacio();
  }
}

export function serializarEstadoChequeo(
  estado: EstadoChequeoHorarios,
): string {
  return JSON.stringify({
    calendarioVisto: estado.calendarioVisto,
    ventanaActiva: estado.ventanaActiva,
    fechaInicioLabores: estado.fechaInicioLabores?.toISOString() ?? null,
    fechaPublicacionPrehorarios:
      estado.fechaPublicacionPrehorarios?.toISOString() ?? null,
    prehorarioVisto: estado.prehorarioVisto,
    avisoTurnosEnviado: estado.avisoTurnosEnviado,
  });
}

/** ¿Ya es el momento del bucle diario (18:00 o después)? */
export function esHoraChequeo(
  ahora: Date,
  hora = CONFIG_CHEQUEO_HORARIOS.horaChequeo,
): boolean {
  return ahora.getHours() >= hora;
}

/** Próximo momento del bucle diario: hoy a las `hora`, o mañana si ya pasó. */
export function proximoMomentoChequeo(
  ahora: Date,
  hora = CONFIG_CHEQUEO_HORARIOS.horaChequeo,
): Date {
  const hoy = new Date(
    ahora.getFullYear(),
    ahora.getMonth(),
    ahora.getDate(),
    hora,
    0,
    0,
    0,
  );

  return ahora.getTime() < hoy.getTime()
    ? hoy
    : new Date(
        ahora.getFullYear(),
        ahora.getMonth(),
        ahora.getDate() + 1,
        hora,
        0,
        0,
        0,
      );
}

function candidatosVentana(
  alrededor: Date,
  config: ConfigChequeoHorarios,
): Date[] {
  const candidatos: Date[] = [];

  for (
    const anio of [
      alrededor.getFullYear() - 1,
      alrededor.getFullYear(),
      alrededor.getFullYear() + 1,
    ]
  ) {
    for (const ventana of config.ventanasBusquedaCalendario) {
      candidatos.push(new Date(anio, ventana.mes - 1, ventana.dia));
    }
  }

  return candidatos.sort((a, b) => a.getTime() - b.getTime());
}

/**
 * Ventana que se está cazando: el inicio más reciente (pasado o presente); si
 * todavía ninguna ha arrancado, la próxima.
 */
export function inicioVentanaVigente(
  ahora: Date,
  config: ConfigChequeoHorarios = CONFIG_CHEQUEO_HORARIOS,
): Date {
  const candidatos = candidatosVentana(ahora, config);
  const pasadas = candidatos.filter(
    candidato => candidato.getTime() <= ahora.getTime(),
  );

  return pasadas.length > 0 ? pasadas[pasadas.length - 1] : candidatos[0];
}

/** Próxima ventana estrictamente posterior a `ventanaActiva` (null si no). */
export function siguienteVentana(
  ventanaActiva: string,
  ahora: Date,
  config: ConfigChequeoHorarios = CONFIG_CHEQUEO_HORARIOS,
): Date | null {
  const activa = new Date(ventanaActiva);
  if (Number.isNaN(activa.getTime())) return null;

  const futuras = candidatosVentana(ahora, config).filter(
    candidato => candidato.getTime() > activa.getTime(),
  );

  return futuras[0] ?? null;
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
  return (
    fechas
      .filter(fecha => fecha.getTime() > ahora.getTime())
      .sort((a, b) => a.getTime() - b.getTime())[0] ?? null
  );
}

export type FaseChequeoHorarios =
  | "antes-buscar-calendario"
  | "buscar-calendario"
  | "procesar-calendario"
  | "esperar-prehorario"
  | "buscar-prehorario"
  | "completado"
  | "siguiente-ventana";

export interface ResultadoChequeo {
  fase: FaseChequeoHorarios;
  tocaAccion: boolean;
  descripcion: string;
}

const FASES_CON_ACCION: ReadonlySet<FaseChequeoHorarios> = new Set([
  "buscar-calendario",
  "procesar-calendario",
  "buscar-prehorario",
  "siguiente-ventana",
]);

function conAccion(
  fase: FaseChequeoHorarios,
  descripcion: string,
): ResultadoChequeo {
  return {
    fase,
    descripcion,
    tocaAccion: FASES_CON_ACCION.has(fase),
  };
}

function objetivoPrehorario(
  estado: EstadoChequeoHorarios,
  config: ConfigChequeoHorarios,
): Date | null {
  if (estado.fechaPublicacionPrehorarios !== null) {
    return estado.fechaPublicacionPrehorarios;
  }

  if (estado.fechaInicioLabores !== null) {
    return new Date(
      estado.fechaInicioLabores.getTime() + config.diasTrasLabores * 86_400_000,
    );
  }

  return null;
}

/** Decide qué toca según el estado persistido y el reloj actual. */
export function decidirFase(
  estado: EstadoChequeoHorarios,
  ahora: Date,
  config: ConfigChequeoHorarios = CONFIG_CHEQUEO_HORARIOS,
): ResultadoChequeo {
  if (estado.ventanaActiva !== null) {
    const siguiente = siguienteVentana(estado.ventanaActiva, ahora, config);
    if (siguiente !== null && ahora.getTime() >= siguiente.getTime()) {
      return conAccion(
        "siguiente-ventana",
        "Comenzó una nueva ventana de publicación; reinicia el ciclo.",
      );
    }
  }

  if (estado.prehorarioVisto !== null) {
    return conAccion(
      "completado",
      "Prehorario ya visto; no hay nada que buscar por ahora.",
    );
  }

  const objetivo = objetivoPrehorario(estado, config);
  if (objetivo !== null) {
    if (ahora.getTime() < objetivo.getTime()) {
      return conAccion(
        "esperar-prehorario",
        `Esperando la publicación del prehorario (${objetivo.toISOString()}).`,
      );
    }

    return conAccion(
      "buscar-prehorario",
      "Toca buscar el prehorario de la carrera.",
    );
  }

  if (estado.calendarioVisto !== null) {
    return conAccion(
      "procesar-calendario",
      "Calendario visto; falta extraer sus fechas del PDF.",
    );
  }

  const ventana = inicioVentanaVigente(ahora, config);
  if (ahora.getTime() < ventana.getTime()) {
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

function esMismaFechaODespues(fecha: Date, ahora: Date): boolean {
  const diaFecha = new Date(
    fecha.getFullYear(),
    fecha.getMonth(),
    fecha.getDate(),
  ).getTime();
  const diaAhora = new Date(
    ahora.getFullYear(),
    ahora.getMonth(),
    ahora.getDate(),
  ).getTime();

  return diaFecha <= diaAhora;
}

/**
 * ¿Toca avisar que puede que ya se sepa el turno de reinscripción? Sí cuando
 * la fecha de publicación (actividad 5: orden de reinscripción + prehorarios)
 * es hoy o ya pasó, y todavía no se ha avisado.
 */
export function tocaAvisarTurnosReinscripcion(
  estado: EstadoChequeoHorarios,
  ahora: Date,
): boolean {
  if (estado.avisoTurnosEnviado) return false;
  if (estado.fechaPublicacionPrehorarios === null) return false;

  return esMismaFechaODespues(estado.fechaPublicacionPrehorarios, ahora);
}