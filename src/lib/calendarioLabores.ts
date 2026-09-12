// Lógica pura de interpretación del texto del calendario oficial. La descarga
// y extracción del texto del PDF vive en `pdfTexto.ts` (pdfjs + worker); este
// módulo solo interpreta las fechas de «inicio de labores» sobre ese texto.
//
// El PDF del calendario suele traer el texto espaciado letra a letra («F i n
// de cl as es», «P E R IODO»): cada frase marcadora se casa con
// `patronEspaciado`, que tolera un espacio opcional entre letras.

import { leerTextoPDF } from "./pdfTexto";

/**
 * Convierte una frase en un patrón que tolera el espaciado letra a letra de la
 * extracción del PDF: entre letras se permite «ninguno o un espacio» (`\s*`) y
 * entre palabras «al menos un espacio» (`\s+`). «Fin de clases» casa con
 * «F i n de cl as es» y también con «Fin de clases».
 */
function patronEspaciado(frase: string): string {
  return frase
    .toLowerCase()
    .split("")
    .map(car => (/[a-z0-9]/.test(car) ? `${car}\\s*` : `\\s+`))
    .join("");
}

/** Meses con su índice (0 = enero). Los abreviados comparten prefijo con el nombre. */
const MESES: readonly [string, number][] = [
  ["enero", 0],
  ["febrero", 1],
  ["marzo", 2],
  ["abril", 3],
  ["mayo", 4],
  ["junio", 5],
  ["julio", 6],
  ["agosto", 7],
  ["septiembre", 8],
  ["octubre", 9],
  ["noviembre", 10],
  ["diciembre", 11],
];

// RegEx: primero los nombres completos, luego abreviaturas. Las fronteras de
// palabra evitan que «mar» robe «marzo».
const MESES_RE = new RegExp(
  `\\b(?:${MESES.map(([nombre]) => nombre).join("|")}|ene|feb|mar|abr|may|jun|jul|ago|sep|sept|oct|nov|dic)\\b`,
  "i",
);

/** Detecta el índice del primer mes nombrado en el texto (null si no hay). */
function indiceMes(texto: string): number | null {
  const match = MESES_RE.exec(texto);
  if (!match) return null;
  const nombre = match[0].toLowerCase();
  const mes = MESES.find(([completo]) => completo.startsWith(nombre));
  return mes ? mes[1] : null;
}

/** Detecta un año de 4 cifras, con un espacio opcional dentro («20 26»). */
function anioEnTexto(texto: string): number | null {
  const match = /(?:19|20)\s?\d\s?\d/.exec(texto);
  return match ? Number(match[0].replace(/\s/g, "")) : null;
}

/**
 * Encuentra el año del periodo al que pertenece el calendario («P E R IODO: …
 * A G O S T O - D ICIE M B R E 20 26»). Sustituye el fallback del año por celda.
 */
function anioDelPeriodo(texto: string): number | null {
  const re = new RegExp(
    `${patronEspaciado("periodo")}:?[\\s\\S]{0,80}?((?:19|20)\\s?\\d\\s?\\d)`,
    "i",
  );
  const match = re.exec(texto);

  return match ? Number(match[1].replace(/\s/g, "")) : null;
}

/**
 * Interpreta una celda como «<día> <mes> [<año>]» y devuelve su fecha.
 * Identifica el mes por palabra; sin mes usa enero del año base.
 *
 * Regla del año: el ciclo académico inicia en agosto (mes >= 7). El «inicio de
 * labores» de un mes anterior a agosto pertenece al ciclo siguiente, así que
 * con `saltarCicloSiguiente` se suma un año al base (explícito, o el año del
 * periodo, o el año actual). El «fin de clases» NO se mueve: pertenece al
 * periodo del propio calendario.
 */
function interpretarFecha(
  ventana: string,
  periodoAnio: number | null,
  saltarCicloSiguiente: boolean,
  currentYear: number,
): Date | null {
  const diaMatch = /\b(\d{1,2})\b/.exec(ventana);
  if (!diaMatch) return null;

  const dia = Number(diaMatch[1]);
  if (dia < 1 || dia > 31) return null;

  const mes = indiceMes(ventana);
  const anioExplicito = anioEnTexto(ventana);
  const anioBase = anioExplicito ?? periodoAnio ?? currentYear;
  const anio =
    mes !== null && mes < 7 && saltarCicloSiguiente ? anioBase + 1 : anioBase;

  const fecha = new Date(anio, mes ?? 0, dia);

  return Number.isNaN(fecha.getTime()) ? null : fecha;
}

function interpretarFechaInicio(ventana: string, periodoAnio: number | null, currentYear: number): Date | null {
  return interpretarFecha(ventana, periodoAnio, true, currentYear);
}

/**
 * Lógica pura: extrae todas las fechas de «inicio de labores» del texto de un
 * calendario. Tolerante al espaciado letra a letra de la extracción de PDF
 * («Inicio de Labores» y, en otros calendarios, «I n i ci o de l a bo r e s»).
 */
export function extraerFechasInicioLabores(texto: string, currentYear: number): Date[] {
  const normalizado = texto.replace(/\s+/g, " ");
  const periodoAnio = anioDelPeriodo(normalizado);
  const fechas: Date[] = [];

  const re = new RegExp(patronEspaciado("inicio de labores"), "gi");
  let match: RegExpExecArray | null;
  while ((match = re.exec(normalizado)) !== null) {
    const ventana = normalizado.slice(match.index, match.index + 100);
    const fecha = interpretarFechaInicio(ventana, periodoAnio, currentYear);
    if (fecha) fechas.push(fecha);
    re.lastIndex = match.index + match[0].length;
  }

  return fechas;
}

/**
 * Índice del mes que encabeza la columna donde cae `posicion`: el nombre de
 * mes más cercano hacia atrás (el encabezado de sección se repite en el texto
 * aplanado como «ENERO   ENERO», «AGOSTO   MAYO», etc.).
 */
function mesAntesDe(texto: string, posicion: number): number | null {
  const re = new RegExp(MESES_RE.source, "gi");
  let actual: number | null = null;
  let match: RegExpExecArray | null;
  while ((match = re.exec(texto)) !== null) {
    if (match.index >= posicion) break;
    const nombre = match[0].toLowerCase();
    actual = MESES.find(([completo]) => completo.startsWith(nombre))?.[1] ?? actual;
  }

  return actual;
}

// La actividad 5 es «Publicación de orden de reinscripción, referencia
// bancaria y Prehorarios»; su celda solo trae el día («9») y el mes viene de
// la columna. El texto del PDF corrompe los acentos («reinscripci├│n») y a
// veces escribe el 6 antes del 5, así que se busca por «orden de reinscripci».
function rePublicacionPrehorarios(): RegExp {
  return new RegExp(
    `${patronEspaciado("orden de reinscripci")}[\\s\\S]{0,100}?\\s(\\d{1,2})(?=\\s|$)`,
    "gi",
  );
}

/**
 * Lógica pura: extrae la fecha de publicación de la orden de reinscripción /
 * Prehorarios (actividad 5). El día está en la celda de la fila; el mes se
 * infiere del encabezado de columna más cercano hacia atrás. Año: el del
 * periodo (esta actividad está siempre en el primer mes del ciclo, no se le
 * aplica la regla +1 de «inicio de labores»).
 */
export function extraerFechasPublicacionPrehorarios(texto: string, currentYear: number): Date[] {
  const normalizado = texto.replace(/\s+/g, " ");
  const periodoAnio = anioDelPeriodo(normalizado);
  const fechas: Date[] = [];

  const re = rePublicacionPrehorarios();
  let match: RegExpExecArray | null;
  while ((match = re.exec(normalizado)) !== null) {
    const dia = Number(match[1]);
    if (dia < 1 || dia > 31) continue;

    const mes = mesAntesDe(normalizado, match.index);
    if (mes === null) continue;

    const anio = periodoAnio ?? currentYear;
    const fecha = new Date(anio, mes, dia);
    if (!Number.isNaN(fecha.getTime())) fechas.push(fecha);
  }

  return fechas;
}

// La fila «Fin de clases» (licenciatura/posgrado e idiomas) marca el último
// día de clases del periodo en curso; de ahí parte la búsqueda del calendario
// siguiente durante las vacaciones. «Fin de cursos de … extraescolares» NO
// cuenta (los extraescolares terminan antes que las clases).
function reFinDeClases(): RegExp {
  return new RegExp(patronEspaciado("fin de clases"), "gi");
}

/**
 * Lógica pura: extrae el último día de clases del periodo en curso. Si el
 * PDF trae más de una fila (licenciatura y posgrado / idiomas) se queda con la
 * más tardía. Año: el del periodo (el fin de clases pertenece al propio
 * calendario, no se le aplica la regla +1 de «inicio de labores»).
 */
export function extraerFinDeClases(texto: string): Date | null {
  const normalizado = texto.replace(/\s+/g, " ");
  const periodoAnio = anioDelPeriodo(normalizado);
  let mejor: Date | null = null;

  const re = reFinDeClases();
  let match: RegExpExecArray | null;
  while ((match = re.exec(normalizado)) !== null) {
    // Ventana acotada desde el marcador: la fecha de la fila es la primera
    // que aparece después de «fin de clases». Se avanza el cursor solo hasta
    // el final del marcador para no tragarse la fila siguiente y poder
    // comparar varias («licenciatura» vs «idiomas»).
    const ventana = normalizado.slice(match.index, match.index + 100);
    const fecha = interpretarFecha(ventana, periodoAnio, false, new Date().getFullYear());
    if (fecha !== null && (mejor === null || fecha.getTime() > mejor.getTime())) {
      mejor = fecha;
    }
    re.lastIndex = match.index + match[0].length;
  }

  return mejor;
}

export interface ResultadoLecturaCalendario {
  fechas: Date[];
  publicacionPrehorarios: Date[];
  /** Último día de clases del periodo en curso (null si el PDF no lo trae). */
  finDeClases: Date | null;
  texto: string;
}

/**
 * Descarga el PDF del calendario, extrae su texto con pdf.js y devuelve las
 * fechas de «inicio de labores», la de publicación de prehorarios (actividad
 * 5), el fin de clases y el texto crudo.
 */
export async function leerFechasInicioLabores(
  url: string,
  currentYear: number,
): Promise<ResultadoLecturaCalendario> {
  const texto = await leerTextoPDF(url);

  return {
    fechas: extraerFechasInicioLabores(texto, currentYear),
    publicacionPrehorarios: extraerFechasPublicacionPrehorarios(texto, currentYear),
    finDeClases: extraerFinDeClases(texto),
    texto,
  };
}