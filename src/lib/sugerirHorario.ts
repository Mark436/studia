// Sugerencia de horario: combina los grupos del prehorario con las materias
// pendientes (ya filtradas por seriación por el llamador) para proponer un
// horario sin choques. Toda la lógica es pura y no depende de React.
//
// Reglas actuales:
//  1. Restricción dura: ningún grupo elegido se puede empalmar (por día y por
//     bloque de hora-minuto).
//  2. Objetivo primario: cubrir el máximo de materias posible.
//  3. Objetivo secundario: minimizar los huecos entre clases (por ahora);
//     el cálculo de puntaje es el punto de extensión para los criterios
//     futuros (evitar maestro, evitar huecos de ciertos tamaños, priorizar
//     horas, etc.).
//
// El empate se resuelve con el orden de entrada de `materias` (y el orden de
// grupos dentro del prehorario), para que el resultado sea determinista.

import type { ReticulaMateria } from "@/lib/api/client";
import type {
  DiaHorario,
  PrehorarioGrupo,
  PrehorarioJson,
  PrehorarioMateria,
} from "./prehorarioTablas";
import { DIAS_HORARIO } from "./prehorarioTablas";

export type HorarioSemanal = Record<DiaHorario, string[]>;

export interface RangoMinutos {
  inicio: number;
  fin: number;
}

export interface MateriaSugerida {
  clave: string;
  nombre: string;
  grupo: PrehorarioGrupo;
}

export type RazonExclusion =
  | "sin-grupos-en-prehorario"
  | "no-cabe-sin-choque";

export interface SugerenciaExcluida {
  clave: string;
  nombre: string;
  razon: RazonExclusion;
}

export interface SugerenciaHorario {
  materias: MateriaSugerida[];
  excluidas: SugerenciaExcluida[];
  /** Huecos totales (minutos) entre clases, sumando todos los días. */
  huecosMinutos: number;
}

/** Convierte «07:00-08:00» en minutos desde medianoche. Inválido → null. */
export function parseBloque(bloque: string): RangoMinutos | null {
  const match = /^(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})$/.exec(bloque.trim());
  if (!match) return null;
  const [, hi, mi, hf, mf] = match;
  const inicio = Number(hi) * 60 + Number(mi);
  const fin = Number(hf) * 60 + Number(mf);
  return inicio < fin ? { inicio, fin } : null;
}

function rangosDelDia(horario: HorarioSemanal, dia: DiaHorario): RangoMinutos[] {
  const rangos: RangoMinutos[] = [];
  for (const texto of horario[dia]) {
    const rango = parseBloque(texto);
    if (rango) rangos.push(rango);
  }
  return rangos;
}

/** True si dos horarios semanales se empalman en algún día/hora. */
export function seChochan(a: HorarioSemanal, b: HorarioSemanal): boolean {
  for (const dia of DIAS_HORARIO) {
    const rangoA = rangosDelDia(a, dia);
    const rangoB = rangosDelDia(b, dia);
    for (const bloqueA of rangoA) {
      for (const bloqueB of rangoB) {
        if (bloqueA.inicio < bloqueB.fin && bloqueB.inicio < bloqueA.fin) {
          return true;
        }
      }
    }
  }
  return false;
}

/** Huecos totales (minutos) entre bloques del mismo día; 0 si solo hay un bloque. */
export function huecosMinutos(horario: HorarioSemanal): number {
  let total = 0;
  for (const dia of DIAS_HORARIO) {
    const rangos = rangosDelDia(horario, dia).sort(
      (a, b) => a.inicio - b.inicio,
    );
    for (let i = 1; i < rangos.length; i++) {
      total += rangos[i].inicio - rangos[i - 1].fin;
    }
  }
  return total;
}

function horarioCombinado(horarios: HorarioSemanal[]): HorarioSemanal {
  const combinado = {} as HorarioSemanal;
  for (const dia of DIAS_HORARIO) {
    combinado[dia] = horarios.flatMap(horario => horario[dia]);
  }
  return combinado;
}

function tieneBloques(grupo: PrehorarioGrupo): boolean {
  return DIAS_HORARIO.some(dia => grupo.horario[dia].length > 0);
}

export function distanciaLevenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  let curr = new Array<number>(b.length + 1);

  for (let i = 0; i < a.length; i++) {
    curr[0] = i + 1;
    for (let j = 0; j < b.length; j++) {
      const cost = a[i] === b[j] ? 0 : 1;
      curr[j + 1] = Math.min(
        curr[j] + 1,
        prev[j + 1] + 1,
        prev[j] + cost,
      );
    }
    prev = [...curr];
  }

  return curr[b.length];
}

export function normalizarClave(clave: string): string {
  return clave
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

export function similitudClave(claveA: string, claveB: string): number {
  const normA = normalizarClave(claveA);
  const normB = normalizarClave(claveB);
  if (!normA || !normB) return 0;
  if (normA === normB) return 1.0;

  const maxLen = Math.max(normA.length, normB.length);
  const dist = distanciaLevenshtein(normA, normB);
  const sim = (maxLen - dist) / maxLen;

  const numA = normA.replace(/\D+/g, "");
  const numB = normB.replace(/\D+/g, "");
  if (numA && numB && numA === numB && sim >= 0.5) {
    return Math.max(sim, 0.85);
  }

  return sim;
}

export function coincideAproximadoClave(
  claveA: string,
  claveB: string,
  umbral = 0.6,
): boolean {
  return similitudClave(claveA, claveB) >= umbral;
}

const ABREVIATURAS_MATERIAS: Record<string, string> = {
  SW: "SOFTWARE",
  SOFT: "SOFTWARE",
  ING: "INGENIERIA",
  PROG: "PROGRAMACION",
  PRG: "PROGRAMACION",
  ADMIN: "ADMINISTRACION",
  ADM: "ADMINISTRACION",
  COMP: "COMPUTACION",
  EST: "ESTADISTICA",
  ESTAD: "ESTADISTICA",
  FUND: "FUNDAMENTOS",
  FUNDAM: "FUNDAMENTOS",
  SIST: "SISTEMAS",
  SIS: "SISTEMAS",
  TEC: "TECNOLOGIA",
  TECNOL: "TECNOLOGIA",
  TALL: "TALLER",
  MAT: "MATEMATICAS",
  QUIM: "QUIMICA",
  FIS: "FISICA",
  ELEC: "ELECTRONICA",
  ELECT: "ELECTRONICA",
  MEC: "MECATRONICA",
  INV: "INVESTIGACION",
  DES: "DESARROLLO",
  DESARR: "DESARROLLO",
  DIST: "DISTRIBUIDO",
  DISTRIB: "DISTRIBUIDO",
  BD: "BASES DE DATOS",
  IA: "INTELIGENCIA ARTIFICIAL",
  SIM: "SIMULACION",
  ARQ: "ARQUITECTURA",
  ORG: "ORGANIZACION",
  APL: "APLICACIONES",
  APLIC: "APLICACIONES",
  CONFB: "CONFIABILIDAD",
  CONT: "CONTABILIDAD",
  FIN: "FINANCIERA",
  SOC: "SOCIOCULTURAL",
  ET: "ETICA",
};

const STOPWORDS_MATERIAS = new Set([
  "DE",
  "DEL",
  "LA",
  "EL",
  "LOS",
  "LAS",
  "Y",
  "E",
  "EN",
  "PARA",
  "CON",
  "POR",
  "A",
  "AL",
  "UN",
  "UNA",
]);

const ROMANOS_A_ARABIGOS: Record<string, string> = {
  I: "1",
  II: "2",
  III: "3",
  IV: "4",
  V: "5",
  VI: "6",
  VII: "7",
  VIII: "8",
  IX: "9",
  X: "10",
};

function stemToken(token: string): string {
  if (
    token.length > 3 &&
    token.endsWith("S") &&
    !token.endsWith("IS") &&
    !token.endsWith("SS")
  ) {
    return token.slice(0, -1);
  }
  return token;
}

export function normalizarTokensNombre(texto: string): string[] {
  const sinAnotaciones = texto
    .replace(/\(.*?\)/g, " ")
    .replace(/\[.*?\]/g, " ");

  const aplanado = sinAnotaciones
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();

  const limpio = aplanado.replace(/[^A-Z0-9]+/g, " ");
  const palabras = limpio.split(" ").filter(Boolean);
  const resultado: string[] = [];

  for (const palabra of palabras) {
    const expandida = ABREVIATURAS_MATERIAS[palabra] ?? palabra;
    for (const sub of expandida.split(" ")) {
      if (!sub) continue;
      const normalizada = ROMANOS_A_ARABIGOS[sub] ?? sub;
      if (!STOPWORDS_MATERIAS.has(normalizada)) {
        resultado.push(stemToken(normalizada));
      }
    }
  }

  return resultado;
}

export function normalizarNombreMateria(texto: string): string {
  return normalizarTokensNombre(texto).join(" ");
}

export function similitudNombre(nombreA: string, nombreB: string): number {
  const tokensA = normalizarTokensNombre(nombreA);
  const tokensB = normalizarTokensNombre(nombreB);

  if (tokensA.length === 0 || tokensB.length === 0) return 0;

  const textoA = tokensA.join(" ");
  const textoB = tokensB.join(" ");

  if (textoA === textoB) return 1.0;

  // Si ambas tienen números de secuencia (ej. 1 vs 2 / I vs II), deben coincidir
  const numsA = tokensA.filter(t => /^\d+$/.test(t));
  const numsB = tokensB.filter(t => /^\d+$/.test(t));
  if (numsA.length > 0 && numsB.length > 0) {
    const numsCoinciden =
      numsA.every(n => numsB.includes(n)) &&
      numsB.every(n => numsA.includes(n));
    if (!numsCoinciden) {
      return 0;
    }
  }

  let matchesA = 0;
  for (const tA of tokensA) {
    const encontro = tokensB.some(tB => {
      if (tA === tB) return true;
      if (
        tA.length >= 4 &&
        tB.length >= 4 &&
        (tA.includes(tB) || tB.includes(tA))
      ) {
        return true;
      }
      return (
        distanciaLevenshtein(tA, tB) <= 1 &&
        Math.min(tA.length, tB.length) >= 4
      );
    });
    if (encontro) matchesA++;
  }

  let matchesB = 0;
  for (const tB of tokensB) {
    const encontro = tokensA.some(tA => {
      if (tA === tB) return true;
      if (
        tA.length >= 4 &&
        tB.length >= 4 &&
        (tA.includes(tB) || tB.includes(tA))
      ) {
        return true;
      }
      return (
        distanciaLevenshtein(tA, tB) <= 1 &&
        Math.min(tA.length, tB.length) >= 4
      );
    });
    if (encontro) matchesB++;
  }

  const tokenScore = (matchesA + matchesB) / (tokensA.length + tokensB.length);

  // Si los tokens no alcanzan un mínimo de coincidencia (ej. < 60%),
  // no se considera match aunque compartan un prefijo largo.
  if (tokenScore < 0.6) {
    return tokenScore;
  }

  const maxLen = Math.max(textoA.length, textoB.length);
  const distGlobal = distanciaLevenshtein(textoA, textoB);
  const simGlobal = (maxLen - distGlobal) / maxLen;

  return tokenScore * 0.7 + simGlobal * 0.3;
}

export function coincideAproximadoNombre(
  nombreA: string,
  nombreB: string,
  umbral = 0.6,
): boolean {
  return similitudNombre(nombreA, nombreB) >= umbral;
}

export function gruposDeMateria(
  materiaOClave: string | { clave: string; nombre?: string },
  prehorario: PrehorarioJson,
  nombreParam?: string,
): PrehorarioGrupo[] {
  const clave =
    typeof materiaOClave === "string" ? materiaOClave : materiaOClave.clave;
  const nombre =
    typeof materiaOClave === "string" ? nombreParam : materiaOClave.nombre;

  // 1. Búsqueda exacta por código de materia (comportamiento base)
  const materiasExactas: PrehorarioMateria[] = [];
  for (const semestre of Object.values(prehorario)) {
    for (const m of semestre.materias) {
      if (m.clave === clave) {
        materiasExactas.push(m);
      }
    }
  }

  if (materiasExactas.length > 0) {
    return materiasExactas.flatMap(m => m.grupos);
  }

  // 2. Si no se encuentra por código exacto, buscar por match aproximado
  //    del nombre Y match aproximado de la clave (ambos deben coincidir).
  if (!nombre) {
    return [];
  }

  const todasLasMaterias: PrehorarioMateria[] = [];
  for (const semestre of Object.values(prehorario)) {
    todasLasMaterias.push(...semestre.materias);
  }

  let mejorCandidato: {
    materia: PrehorarioMateria;
    puntajeTotal: number;
  } | null = null;

  for (const cand of todasLasMaterias) {
    const matchClave = coincideAproximadoClave(clave, cand.clave);
    const matchNombre = coincideAproximadoNombre(nombre, cand.nombre);

    if (matchClave && matchNombre) {
      const pClave = similitudClave(clave, cand.clave);
      const pNombre = similitudNombre(nombre, cand.nombre);
      const puntajeTotal = pNombre * 0.6 + pClave * 0.4;

      if (!mejorCandidato || puntajeTotal > mejorCandidato.puntajeTotal) {
        mejorCandidato = { materia: cand, puntajeTotal };
      }
    }
  }

  if (!mejorCandidato) {
    return [];
  }

  const gruposAproximados: PrehorarioGrupo[] = [];
  const claveGanadora = mejorCandidato.materia.clave;
  for (const semestre of Object.values(prehorario)) {
    for (const m of semestre.materias) {
      if (m.clave === claveGanadora) {
        gruposAproximados.push(...m.grupos);
      }
    }
  }

  return gruposAproximados;
}

interface Candidata {
  clave: string;
  nombre: string;
  grupos: PrehorarioGrupo[];
}

function calcularExcluidas(
  materia: Candidata,
  elegidas: ReadonlySet<string>,
): SugerenciaExcluida | null {
  if (elegidas.has(materia.clave)) return null;
  return {
    clave: materia.clave,
    nombre: materia.nombre,
    razon:
      materia.grupos.length === 0
        ? "sin-grupos-en-prehorario"
        : "no-cabe-sin-choque",
  };
}

/**
 * Busca la mejor sugerencia para `materias` (ya filtradas por seriación).
 * Maximiza el número de materias cubiertas y, entre los empates, minimiza los
 * huecos totales de la semana.
 */
export function calcularSugerenciaHorario(
  materias: ReticulaMateria[],
  prehorario: PrehorarioJson,
): SugerenciaHorario {
  const candidatas: Candidata[] = materias.map(materia => ({
    clave: materia.clave,
    nombre: materia.nombre,
    grupos: gruposDeMateria(materia, prehorario).filter(tieneBloques),
  }));

  let mejores: MateriaSugerida[] = [];
  let mejorHuecos = 0;

  function evaluar(actual: MateriaSugerida[]): void {
    const huecos = huecosMinutos(
      horarioCombinado(actual.map(materia => materia.grupo.horario)),
    );
    if (
      actual.length > mejores.length ||
      (actual.length === mejores.length && huecos < mejorHuecos)
    ) {
      mejores = actual.map(materia => ({ ...materia }));
      mejorHuecos = huecos;
    }
  }

  function buscar(indice: number, actual: MateriaSugerida[]): void {
    const restantes = candidatas.length - indice;
    if (actual.length + restantes < mejores.length) return;

    if (indice === candidatas.length) {
      evaluar(actual);
      return;
    }

    buscar(indice + 1, actual);

    const candidata = candidatas[indice];
    for (const grupo of candidata.grupos) {
      if (
        actual.some(elegida => seChochan(elegida.grupo.horario, grupo.horario))
      ) {
        continue;
      }
      actual.push({ clave: candidata.clave, nombre: candidata.nombre, grupo });
      buscar(indice + 1, actual);
      actual.pop();
    }
  }

  buscar(0, []);

  const elegidas = new Set(mejores.map(materia => materia.clave));
  return {
    materias: mejores,
    excluidas: candidatas
      .map(candidata => calcularExcluidas(candidata, elegidas))
      .filter((excluida): excluida is SugerenciaExcluida => excluida !== null),
    huecosMinutos: mejorHuecos,
  };
}