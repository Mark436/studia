// Obtención de los datos del calendario: primero lo que ya está guardado en el
// estado del chequeo; si falta algo (instalación nueva, estado viejo sin fin de
// clases, o un calendario más nuevo en la página oficial), se pide on-demand y
// se persiste. Es el punto de entrada «cuando lleguemos a necesitar los datos».

import {
  estadoTrasAplicarCalendario,
  parseEstadoChequeo,
  serializarEstadoChequeo,
} from "@/lib/busquedaHorarios";
import type { EstadoChequeoHorarios } from "@/lib/busquedaHorarios";
import { leerFechasInicioLabores } from "@/lib/calendarioLabores";
import { urlDocumentoPdf } from "@/lib/pdfTexto";
import { obtenerCalendarioOficial } from "@/lib/prehorario";
import {
  getSetting,
  setSetting,
  SETTING_HORARIOS_CHECKS_STATE,
} from "@/lib/storage/settingsStore";

export interface DatosCalendario {
  calendarioProcesado: string;
  fechaFinDeClases: Date | null;
  fechaInicioLabores: Date;
  fechaPublicacionPrehorarios: Date | null;
}

/** Datos del calendario ya aplicado, o null si falta algo por completar. */
function aDatos(estado: EstadoChequeoHorarios): DatosCalendario | null {
  if (
    !estado.calendarioProcesado ||
    !estado.fechaInicioLabores ||
    // El fin de clases es indispensable para la ventana vacacional; si falta
    // (estado migrado del esquema de ventanas), hay que leer el PDF de nuevo.
    estado.fechaFinDeClases === null
  ) {
    return null;
  }

  return {
    calendarioProcesado: estado.calendarioProcesado,
    fechaFinDeClases: estado.fechaFinDeClases,
    fechaInicioLabores: estado.fechaInicioLabores,
    fechaPublicacionPrehorarios: estado.fechaPublicacionPrehorarios,
  };
}

/**
 * Devuelve los datos del calendario (último día de clases, inicio de labores
 * del siguiente ciclo y publicación de prehorarios). Usa lo guardado si ya
 * está completo; si no, consulta la página oficial `calendario-escolar.html`,
 * lee el calendario vigente y persiste el resultado. Devuelve null si no pudo
 * obtenerlo.
 */
export async function obtenerDatosCalendario(
  clock: { getNow: () => Date },
): Promise<DatosCalendario | null> {
  const estado = parseEstadoChequeo(
    await getSetting(SETTING_HORARIOS_CHECKS_STATE),
  );

  const guardado = aDatos(estado);
  if (guardado) return guardado;

  const oficial = await obtenerCalendarioOficial();
  if (oficial === null) return null;

  const lectura = await leerFechasInicioLabores(urlDocumentoPdf(oficial.archivo), clock.getNow().getFullYear());
  if (lectura.fechas.length === 0) return null;

  const nuevo = estadoTrasAplicarCalendario(
    estado,
    lectura,
    oficial.archivo,
    clock.getNow(),
  );
  await setSetting(SETTING_HORARIOS_CHECKS_STATE, serializarEstadoChequeo(nuevo));

  return aDatos(nuevo);
}