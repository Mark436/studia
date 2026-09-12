// Chequeo diario de búsqueda de calendario/prehorario. El bucle corre una vez
// por día, anclado a las 18:00 (cuando el instituto ya subió los documentos),
// y no contabiliza si "ya se chequeó": el estado solo recuerda lo que se
// *encontró* para no repetir avisos. Toda la lógica es pura y recibe la hora
// desde fuera (getNow()), de modo que el modo dev la prueba con su reloj
// simulado. El chequeo no depende de una sesión activa.
//
// El calendario del ciclo siguiente se rastrea durante las vacaciones de fin
// de clases: desde el último día de clases del periodo en curso
// (`fechaFinDeClases`) hasta el inicio de labores del siguiente
// (`fechaInicioLabores`), consultando la página oficial
// `calendario-escolar.html` (`obtenerCalendarioOficial`) a lo sumo cada 7
// días. Fuera de esa ventana el único calendario que entra es el que se pide
// on-demand cuando faltan los datos.

export const HORA_CHEQUEO = 18;

/** Días que deben pasar entre consultas a la página oficial buscando el calendario. */
export const DIAS_ENTRE_BUSQUEDAS = 7;

export interface ConfigChequeoHorarios {
  /** Días mínimo entre búsquedas del calendario durante las vacaciones. */
  diasEntreBusquedasCalendario: number;
  /** Espera tras inicio de labores si el PDF no trae la actividad 5. */
  diasTrasLabores: number;
  horaChequeo: number;
}

export const CONFIG_CHEQUEO_HORARIOS: ConfigChequeoHorarios = {
  diasEntreBusquedasCalendario: DIAS_ENTRE_BUSQUEDAS,
  diasTrasLabores: 1,
  horaChequeo: 18,
};

export interface EstadoChequeoHorarios {
  /** Último calendario detectado en la página oficial (pendiente o ya aplicado). */
  calendarioVisto: string | null;
  /** Último archivo de calendario *aplicado* (del que vienen las fechas). */
  calendarioProcesado: string | null;
  /** Último día de clases del periodo en curso (inicio de la búsqueda vacacional). */
  fechaFinDeClases: Date | null;
  /** Inicio de labores del siguiente periodo (fin de la búsqueda vacacional). */
  fechaInicioLabores: Date | null;
  /** Fecha de publicación de orden de reinscripción + Prehorarios (actividad 5). */
  fechaPublicacionPrehorarios: Date | null;
  /** Último prehorario de la carrera visto en el ciclo actual (null = ninguno). */
  prehorarioVisto: string | null;
  /** Ya se avisó que el turno de reinscripción puede estar publicado. */
  avisoTurnosEnviado: boolean;
  /** Última consulta a la página oficial buscando calendario (ISO, cadencia 7 días). */
  ultimaBusquedaCalendario: string | null;
}

export function estadoChequeoVacio(): EstadoChequeoHorarios {
  return {
    calendarioVisto: null,
    calendarioProcesado: null,
    fechaFinDeClases: null,
    fechaInicioLabores: null,
    fechaPublicacionPrehorarios: null,
    prehorarioVisto: null,
    avisoTurnosEnviado: false,
    ultimaBusquedaCalendario: null,
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

    // Migración desde el esquema anterior (ventanas 15-dic/15-mayo): ese
    // estado ya tenía un calendario visto y sus fechas aplicadas; se asume que
    // está procesado aunque el campo nuevo no exista.
    const calendarioVisto = stringO(obj.calendarioVisto);
    const calendarioProcesado =
      stringO(obj.calendarioProcesado) ?? calendarioVisto;

    return {
      calendarioVisto,
      calendarioProcesado,
      fechaFinDeClases: fechaDe(obj.fechaFinDeClases),
      fechaInicioLabores: fechaDe(obj.fechaInicioLabores),
      fechaPublicacionPrehorarios: fechaDe(obj.fechaPublicacionPrehorarios),
      prehorarioVisto: stringO(obj.prehorarioVisto),
      avisoTurnosEnviado: obj.avisoTurnosEnviado === true,
      ultimaBusquedaCalendario: stringO(obj.ultimaBusquedaCalendario),
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
    calendarioProcesado: estado.calendarioProcesado,
    fechaFinDeClases: estado.fechaFinDeClases?.toISOString() ?? null,
    fechaInicioLabores: estado.fechaInicioLabores?.toISOString() ?? null,
    fechaPublicacionPrehorarios:
      estado.fechaPublicacionPrehorarios?.toISOString() ?? null,
    prehorarioVisto: estado.prehorarioVisto,
    avisoTurnosEnviado: estado.avisoTurnosEnviado,
    ultimaBusquedaCalendario: estado.ultimaBusquedaCalendario,
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

/**
 * ¿Estamos dentro de la ventana vacacional? Sí entre el fin de clases del
 * periodo en curso y el inicio de labores del siguiente. Si las fechas están
 * invertidas (fin > inicio, p. ej. tras procesar un calendario del ciclo
 * siguiente a mitad de vacaciones) es que ya no hay ventana activa.
 */
export function enVentanaVacacional(
  estado: Pick<EstadoChequeoHorarios, "fechaFinDeClases" | "fechaInicioLabores">,
  ahora: Date,
): boolean {
  const fin = estado.fechaFinDeClases;
  const inicio = estado.fechaInicioLabores;
  if (fin === null || inicio === null) return false;

  return (
    ahora.getTime() >= fin.getTime() && ahora.getTime() < inicio.getTime()
  );
}

/** ¿Ya pasaron los `diasEntreBusquedas` desde la última consulta del calendario? */
export function pasoTiempoBusquedaCalendario(
  estado: EstadoChequeoHorarios,
  ahora: Date,
  config: ConfigChequeoHorarios = CONFIG_CHEQUEO_HORARIOS,
): boolean {
  if (estado.ultimaBusquedaCalendario === null) return true;
  const ultima = new Date(estado.ultimaBusquedaCalendario);
  if (Number.isNaN(ultima.getTime())) return true;

  return (
    ahora.getTime() - ultima.getTime() >=
    config.diasEntreBusquedasCalendario * 86_400_000
  );
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
  | "procesar-calendario"
  | "buscar-calendario"
  | "esperar-prehorario"
  | "buscar-prehorario"
  | "completado"
  | "sin-datos";

export interface ResultadoChequeo {
  fase: FaseChequeoHorarios;
  tocaAccion: boolean;
  descripcion: string;
}

const FASES_CON_ACCION: ReadonlySet<FaseChequeoHorarios> = new Set([
  "procesar-calendario",
  "buscar-calendario",
  "buscar-prehorario",
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
  // Un calendario nuevo detectado (¿pendiente de procesar?) manda antes que
  // cualquier otra fase: hay que terminar de aplicar sus fechas.
  if (
    estado.calendarioVisto !== null &&
    estado.calendarioVisto !== estado.calendarioProcesado
  ) {
    return conAccion(
      "procesar-calendario",
      "Se detectó un calendario nuevo; falta leer sus fechas del PDF.",
    );
  }

  // Vacaciones de fin de clases: toca buscar el calendario del ciclo siguiente
  // (la cadencia de 7 días se decide en el integrador, no aquí).
  if (enVentanaVacacional(estado, ahora)) {
    return conAccion(
      "buscar-calendario",
      "Vacaciones de fin de clases: toca buscar el calendario del siguiente ciclo.",
    );
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

  return conAccion(
    "sin-datos",
    "Faltan las fechas del calendario; se obtienen on-demand.",
  );
}

/**
 * Forma mínima de la lectura del calendario (evita acoplar este módulo con el
 * resultado completo de pdfjs: `ResultadoLecturaCalendario` en calendarioLabores).
 */
export interface LecturaCalendario {
  fechas: readonly Date[];
  publicacionPrehorarios: readonly Date[];
  finDeClases: Date | null;
}

/**
 * Aplica las fechas de un calendario al estado. Si el archivo es distinto del
 * ya procesado, reinicia el ciclo de prehorario (es un periodo nuevo): se
 * limpian `prehorarioVisto` y `avisoTurnosEnviado` para empezar limpios.
 */
export function estadoTrasAplicarCalendario(
  estado: EstadoChequeoHorarios,
  lectura: LecturaCalendario,
  archivo: string,
  ahora: Date,
): EstadoChequeoHorarios {
  const esNuevo = archivo !== estado.calendarioProcesado;

  return {
    ...estado,
    calendarioProcesado: archivo,
    calendarioVisto: archivo,
    fechaInicioLabores:
      elegirProximaFechaLabores(lectura.fechas, ahora) ??
      estado.fechaInicioLabores,
    fechaFinDeClases: lectura.finDeClases ?? estado.fechaFinDeClases,
    fechaPublicacionPrehorarios:
      lectura.publicacionPrehorarios[0] ?? estado.fechaPublicacionPrehorarios,
    ...(esNuevo ? { prehorarioVisto: null, avisoTurnosEnviado: false } : {}),
  };
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