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
import type { DiaHorario, PrehorarioGrupo, PrehorarioJson } from "./prehorarioTablas";
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

function gruposDeMateria(
  clave: string,
  prehorario: PrehorarioJson,
): PrehorarioGrupo[] {
  const grupos: PrehorarioGrupo[] = [];
  for (const semestre of Object.values(prehorario)) {
    const materia = semestre.materias.find(materia => materia.clave === clave);
    if (materia) grupos.push(...materia.grupos);
  }
  return grupos;
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
    grupos: gruposDeMateria(materia.clave, prehorario).filter(tieneBloques),
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