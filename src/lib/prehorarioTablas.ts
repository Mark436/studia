// Parser del PDF del prehorario: convierte las tablas en un JSON estructurado
// por semestre y materia (el mismo formato de `samplegrupos.json`). El PDF es
// una tabla con columnas fijas (Clave, Gpo, Materia, T, P, C, HRS SEM, MAESTRO,
// AULA, Lun..Vie); el texto plano no basta, por eso la lectura posicional vive
// en `pdfTexto.ts` (`leerRenglonesPDF`) y aquí solo se interpreta.

import type { PaginaRenglones, RenglonPDF } from "./pdfTexto";

export type DiaHorario = "lunes" | "martes" | "miercoles" | "jueves" | "viernes";

export const DIAS_HORARIO: readonly DiaHorario[] = [
  "lunes",
  "martes",
  "miercoles",
  "jueves",
  "viernes",
];

export interface PrehorarioHoras {
  teoricas: number | null;
  practicas: number | null;
  semanales: number | null;
}

export interface PrehorarioGrupo {
  grupo: string;
  paquete: string | null;
  turno: "matutino" | "vespertino" | null;
  especialidad: string | null;
  maestro: string | null;
  aula: string | null;
  horario: Record<DiaHorario, string[]>;
}

export interface PrehorarioMateria {
  clave: string;
  nombre: string;
  horas: PrehorarioHoras;
  creditos: number | null;
  grupos: PrehorarioGrupo[];
}

export interface SemestrePrehorario {
  materias: PrehorarioMateria[];
}

export type PrehorarioJson = Record<string, SemestrePrehorario>;

/**
 * Separación vertical máxima (en puntos) entre dos renglones para considerarlos
 * parte de la misma fila de la tabla. Las filas están a ~10-13 pt; los saltos
 * de línea dentro de una celda (clave debajo de sus datos, maestro largo) a
 * ≤ 5 pt. Un maestro que envuelve a más distancia se recupera luego como
 * "continuación" (esContinuacionValida).
 */
const SEPARACION_RENGLONES = 6;

// Rangos de columna medidos en el PDF vigente del prehorario ISC (puntos).
// El encabezado de NEtapa está en: Clave 62, Gpo 100, Materia 124, T 319,
// P 328, C 338, HRS~SEM 350-362, MAESTRO 367, AULA 519, Lun 550, Mar 580,
// Mie 611, Jue 642, Vie 674.
const ZONAS = {
  clave: { min: 40, max: 90 },
  gpo: { min: 90, max: 112 },
  materia: { min: 112, max: 306 },
  teoricas: { min: 306, max: 326 },
  practicas: { min: 326, max: 333 },
  creditos: { min: 333, max: 343 },
  semanales: { min: 343, max: 360 },
  maestro: { min: 366, max: 513 },
  aula: { min: 513, max: 540 },
  lunes: { min: 540, max: 570 },
  martes: { min: 570, max: 598 },
  miercoles: { min: 598, max: 628 },
  jueves: { min: 628, max: 658 },
  viernes: { min: 658, max: 690 },
} as const;

type ZonaTabla = keyof typeof ZONAS;

function zonaDe(x: number): ZonaTabla | null {
  for (const [zona, { min, max }] of Object.entries(ZONAS)) {
    if (x >= min && x < max) return zona as ZonaTabla;
  }
  return null;
}

const CLAVE_RE = /^[A-Z]{1,4}[A-Za-z0-9]*\d{3,4}$/;
const GPO_RE = /^S\d+[A-Z]+$/i;
const NUMERO_RE = /^\d{1,3}$/;
const PAQUETE_RE = /PAQUETE\s+(\d+)\/(\d+)/i;
const TURNO_RE = /TURNO\s+([A-ZÁÉÍÓÚÑ]+)/i;

/** Marca de celda (superscript del PDF) que se descarta del texto. */
const MARCADOR_RE = /[\u00ae\u00ab\u00bb\u00b0\u2666\u25a0\u25cf\u2042]/g;

function limpiarTexto(texto: string): string {
  return texto.replace(MARCADOR_RE, " ").replace(/\s+/g, " ").trim();
}

function esClave(texto: string): boolean {
  return CLAVE_RE.test(texto);
}

function esNumero(texto: string): boolean {
  return NUMERO_RE.test(texto);
}

/** Convierte «7-8» / «13-14» del PDF a «07:00-08:00». */
function aHoraTexto(rango: string): string {
  const [inicio, fin] = rango.split("-");
  const convertir = (valor: string | undefined): string | null => {
    if (!valor) return null;
    const horas = valor.padStart(2, "0");
    return /^\d{2}$/.test(horas) ? `${horas}:00` : null;
  };
  const desde = convertir(inicio);
  const hasta = convertir(fin);
  return desde && hasta ? `${desde}-${hasta}` : rango;
}

interface FilaPrehorario {
  clave: string;
  gpo: string;
  materia: string;
  teoricas: number | null;
  practicas: number | null;
  creditos: number | null;
  semanales: number | null;
  maestro: string | null;
  aula: string | null;
  horario: Record<DiaHorario, string[]>;
}

interface SeccionPrehorario {
  paquete: string | null;
  turno: "matutino" | "vespertino" | null;
  especialidad: string | null;
}

/** Acumulador de celdas de una misma fila de tabla (una materia + grupo). */
interface FilaEnCurso {
  clave: string | null;
  gpo: string[];
  materia: string[];
  num: Record<"teoricas" | "practicas" | "creditos" | "semanales", string>;
  maestro: string[];
  aula: string[];
  horario: Record<DiaHorario, string[]>;
}

function filaNueva(): FilaEnCurso {
  return {
    clave: null,
    gpo: [],
    materia: [],
    num: { teoricas: "", practicas: "", creditos: "", semanales: "" },
    maestro: [],
    aula: [],
    horario: {
      lunes: [],
      martes: [],
      miercoles: [],
      jueves: [],
      viernes: [],
    },
  };
}

/** Acumula una celda en la fila según su columna. */
function acumularCelda(fila: FilaEnCurso, texto: string, zona: ZonaTabla): void {
  switch (zona) {
    case "clave":
      if (esClave(texto)) fila.clave = texto;
      break;
    case "gpo":
      if (GPO_RE.test(texto)) fila.gpo.push(texto);
      break;
    case "materia":
      fila.materia.push(texto);
      break;
    case "teoricas":
    case "practicas":
    case "creditos":
    case "semanales":
      fila.num[zona] += texto;
      break;
    case "maestro":
      fila.maestro.push(texto);
      break;
    case "aula":
      fila.aula.push(texto);
      break;
    case "lunes":
    case "martes":
    case "miercoles":
    case "jueves":
    case "viernes":
      fila.horario[zona].push(texto);
      break;
  }
}

function consolidar(fila: FilaEnCurso): FilaPrehorario | null {
  const clave = fila.clave;
  if (!clave) return null;

  const gpo = fila.gpo.find(valor => GPO_RE.test(valor));
  if (!gpo) return null;

  const maestro = limpiarTexto(fila.maestro.join(" "));
  const aulaRaw = limpiarTexto(fila.aula.join(" "));
  const aula = aulaRaw && aulaRaw.toUpperCase() !== "S/A" ? aulaRaw : null;

  const horario = {} as Record<DiaHorario, string[]>;
  for (const dia of DIAS_HORARIO) {
    horario[dia] = [...new Set(fila.horario[dia].map(aHoraTexto))];
  }

  return {
    clave,
    gpo: gpo.toUpperCase(),
    materia: limpiarTexto(fila.materia.join(" ")) || clave,
    teoricas: esNumero(fila.num.teoricas) ? Number(fila.num.teoricas) : null,
    practicas: esNumero(fila.num.practicas) ? Number(fila.num.practicas) : null,
    creditos: esNumero(fila.num.creditos) ? Number(fila.num.creditos) : null,
    semanales: esNumero(fila.num.semanales) ? Number(fila.num.semanales) : null,
    maestro: maestro || null,
    aula,
    horario,
  };
}

class PrehorarioBuilder {
  private readonly materias = new Map<string, Map<string, PrehorarioMateria>>();

  agregar(fila: FilaPrehorario, seccion: SeccionPrehorario | null): void {
    const semestre = `S${fila.gpo.match(/^S(\d+)/)?.[1] ?? ""}`;
    if (!/^S\d+$/.test(semestre)) return;

    let materias = this.materias.get(semestre);
    if (!materias) {
      materias = new Map<string, PrehorarioMateria>();
      this.materias.set(semestre, materias);
    }

    let materia = materias.get(fila.clave);
    if (!materia) {
      materia = {
        clave: fila.clave,
        nombre: fila.materia,
        horas: {
          teoricas: fila.teoricas,
          practicas: fila.practicas,
          semanales: fila.semanales,
        },
        creditos: fila.creditos,
        grupos: [],
      };
      materias.set(fila.clave, materia);
    }

    materia.grupos.push({
      grupo: fila.gpo,
      paquete: seccion?.paquete ?? null,
      turno: seccion?.turno ?? null,
      especialidad: seccion?.especialidad ?? null,
      maestro: fila.maestro,
      aula: fila.aula,
      horario: fila.horario,
    });
  }

  resultado(): PrehorarioJson {
    const json: PrehorarioJson = {};
    for (const [semestre, materias] of this.materias) {
      json[semestre] = { materias: [...materias.values()] };
    }
    return json;
  }
}

/**
 * Lógica pura: agrupa los renglones posicionales del PDF en filas de tabla y
 * las convierte en el JSON de semestres/materias/grupos.
 */
export function procesarPrehorarioTexto(paginas: PaginaRenglones[]): PrehorarioJson {
  const builder = new PrehorarioBuilder();
  const pendiente = { seccion: null as SeccionPrehorario | null, fila: null as FilaEnCurso | null };

  const cerrarFila = () => {
    if (!pendiente.fila) return;
    const fila = consolidar(pendiente.fila);
    if (fila) builder.agregar(fila, pendiente.seccion);
    pendiente.fila = null;
  };

  for (const pagina of paginas) {
    const clusteres = agruparRenglones(pagina.renglones);

    for (const cluster of clusteres) {
      const texto = cluster.map(celda => celda.texto).join(" ");

      const paquete = PAQUETE_RE.exec(texto);
      const turno = TURNO_RE.exec(texto);

      if (paquete || /ESPECIALIDAD/.test(texto)) {
        cerrarFila();
        const conEncabezado = esCabeceraTabla(texto);
        const espTexto = conEncabezado ? null : extraerEspecialidad(texto);
        const especialidad = espTexto
          ? espTexto
          : paquete
            ? null
            : pendiente.seccion?.especialidad ?? null;
        pendiente.seccion = {
          paquete: paquete ? `${paquete[1]}/${paquete[2]}` : pendiente.seccion?.paquete ?? null,
          turno: extraerTurno(turno, pendiente.seccion),
          especialidad,
        };
        continue;
      }

      if (esCabeceraTabla(texto)) {
        continue;
      }

      const fila = leerFila(cluster);
      if (fila.clave) {
        cerrarFila();
        pendiente.fila = fila;
        continue;
      }

      if (pendiente.fila && esContinuacionValida(cluster)) {
        for (const celda of cluster) {
          const zona = zonaDe(celda.x);
          if (zona) acumularCelda(pendiente.fila, limpiarTexto(celda.texto), zona);
        }
      }
    }
  }
  cerrarFila();

  return builder.resultado();
}

/** Separa los renglones de una página en filas de tabla (agrupadas por cercanía). */
function agruparRenglones(renglones: RenglonPDF[]): CeldaAgrupada[][] {
  const grupos: CeldaAgrupada[][] = [];
  let anterior: RenglonPDF | null = null;

  for (const renglon of renglones) {
    const celdas: CeldaAgrupada[] = renglon.celdas
      .filter(celda => celda.texto.trim().length > 0)
      .map(celda => ({ x: celda.x, texto: celda.texto }));

    if (
      !grupos.length ||
      (anterior && anterior.y - renglon.y > SEPARACION_RENGLONES)
    ) {
      grupos.push(celdas);
    } else {
      grupos[grupos.length - 1].push(...celdas);
    }
    anterior = renglon;
  }

  return grupos;
}

interface CeldaAgrupada {
  x: number;
  texto: string;
}

function esCabeceraTabla(texto: string): boolean {
  return /\bClave\b/.test(texto) && /\bLun\b/.test(texto) && /\bMAESTRO\b/.test(texto);
}

/** Clasifica las celdas de una fila de datos y devuelve la fila en curso. */
function leerFila(cluster: CeldaAgrupada[]): FilaEnCurso {
  const fila = filaNueva();
  for (const celda of cluster) {
    const texto = limpiarTexto(celda.texto);
    if (!texto) continue;
    const zona = zonaDe(celda.x);
    if (zona) acumularCelda(fila, texto, zona);
  }
  return fila;
}

/**
 * Un continuo solo se agrega a la fila en curso si trae contenido de las
 * columnas numéricas/maestro/aula/días; los pies de página quedan fuera.
 */
function esContinuacionValida(cluster: CeldaAgrupada[]): boolean {
  if (/\bNOTAS IMPORTANTES\b|\bCONSIDERACI\b|\bDISPOSICIONES\b|https?:|www\./i.test(
    cluster.map(celda => celda.texto).join(" "),
  )) {
    return false;
  }
  return cluster.some(celda => celda.x >= 306);
}

function extraerTurno(
  coincidencia: RegExpExecArray | null,
  seccion: SeccionPrehorario | null,
): "matutino" | "vespertino" | null {
  if (!coincidencia) return seccion?.turno ?? null;
  const turno = coincidencia[1].toLowerCase();
  return turno === "matutino" || turno === "vespertino" ? turno : null;
}

function extraerEspecialidad(texto: string): string | null {
  const limpiado = texto
    .replace(PAQUETE_RE, " ")
    .replace(/\bTURNO\s+[A-ZÁÉÍÓÚÑ]+\b/gi, " ")
    .replace(/ESPECIALIDAD|ESP\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  return limpiado || null;
}