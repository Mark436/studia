// Lógica pura de interpretación del texto del calendario oficial. La descarga
// y extracción del texto del PDF vive en `pdfTexto.ts` (pdfjs + worker); este
// módulo solo interpreta las fechas de «inicio de labores» sobre ese texto.

import { leerTextoPDF } from "./pdfTexto";

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
  const match = /(?:19|20)\d\s?\d/.exec(texto);
  return match ? Number(match[0].replace(/\s/g, "")) : null;
}

/**
 * Encuentra el año del periodo al que pertenece el calendario («PERIODO: …
 * AGOSTO-DICIEMBRE 2026»). Sustituye el fallback del año por celda.
 */
function anioDelPeriodo(texto: string): number | null {
  const match = /periodo:[\s\S]{0,80}?((?:19|20)\d\s?\d)/i.exec(texto);

  return match ? Number(match[1].replace(/\s/g, "")) : null;
}

/**
 * Interpreta la celda que sigue a «Inicio de labores» y devuelve su fecha.
 *
 * Formatos reales observados:
 *   «Inicio de Labores  03 agosto»
 *   «Inicio de labores  6 de enero 2026»   (el PDF escribe «202 6» y año de
 *    un dígito corrido; y para enero el instituto pone el año del periodo,
 *    aunque esa fecha pertenezca al ciclo siguiente).
 *   «Inicio de labores  03 ago»
 *
 * Regla del año: el ciclo académico inicia en agosto (mes >= 7). Los labores
 * de un mes anterior a agosto pertenecen al ciclo siguiente, así que si el mes
 * detectado es < 7 se suma un año al base (explícito, o el año del periodo, o
 * el año actual).
 */
function interpretarFechaInicio(ventana: string, periodoAnio: number | null): Date | null {
  const diaMatch = /\b(\d{1,2})\b/.exec(ventana);
  if (!diaMatch) return null;

  const dia = Number(diaMatch[1]);
  if (dia < 1 || dia > 31) return null;

  const mes = indiceMes(ventana);
  const anioExplicito = anioEnTexto(ventana);
  const anioBase = anioExplicito ?? periodoAnio ?? new Date().getFullYear();
  const anio = mes !== null && mes < 7 ? anioBase + 1 : anioBase;

  const fecha = new Date(anio, mes ?? 0, dia);

  return Number.isNaN(fecha.getTime()) ? null : fecha;
}

/**
 * Lógica pura: extrae todas las fechas de «inicio de labores» del texto de un
 * calendario. Normaliza el espacio de la extracción de PDF (a veces deja
 * espacios entre caracteres, «202 6»).
 */
export function extraerFechasInicioLabores(texto: string): Date[] {
  const normalizado = texto.replace(/\s+/g, " ");
  const periodoAnio = anioDelPeriodo(normalizado);
  const fechas: Date[] = [];

  const re = /inicio\s+de\s+labores[\s\S]{0,100}/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(normalizado)) !== null) {
    const fecha = interpretarFechaInicio(match[0], periodoAnio);
    if (fecha) fechas.push(fecha);
  }

  return fechas;
}

export interface ResultadoLecturaCalendario {
  fechas: Date[];
  texto: string;
}

/**
 * Descarga el PDF del calendario, extrae su texto con pdf.js y devuelve las
 * fechas de «inicio de labores» junto con el texto crudo.
 */
export async function leerFechasInicioLabores(
  url: string,
): Promise<ResultadoLecturaCalendario> {
  const texto = await leerTextoPDF(url);

  return { fechas: extraerFechasInicioLabores(texto), texto };
}