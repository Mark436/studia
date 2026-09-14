import type {
  Coordenadas,
  ReticulaMateria,
  ReticulaMap,
  SemestresReticula,
} from "@/lib/api/client";
import { ESTADO_MATERIA_RETICULA } from "@/lib/api/client";

const ESTADOS = Object.values(ESTADO_MATERIA_RETICULA) as ESTADO_MATERIA_RETICULA[];

function coord(x: number, y: number): Coordenadas {
  return { x, y };
}

function estadoDeCodigo(codigo: number): ESTADO_MATERIA_RETICULA {
  return ESTADOS[codigo] ?? ESTADO_MATERIA_RETICULA.FALTA_CURSAR;
}

function materia(params: {
  clave: string;
  nombre: string;
  x: number;
  y: number;
  codigoEstado: number;
  seriacion?: Coordenadas[][];
  calificacion?: string;
  oportunidad?: string;
}): ReticulaMateria {
  const {
    clave,
    nombre,
    x,
    y,
    codigoEstado,
    seriacion = [],
    calificacion,
    oportunidad,
  } = params;

  return {
    clave,
    nombre,
    coordenadas: coord(x, y),
    codigoEstado,
    estado: estadoDeCodigo(codigoEstado),
    seriacion,
    anteriores: [],
    siguientes: [],
    calificacion: calificacion
      ? { calificacion, oportunidad: oportunidad ?? "OO" }
      : undefined,
  };
}

export const MOCK_RETICULA: ReticulaMateria[] = [
  // SEMESTRE 1 (x=1) - TODAS ACREDITADAS
  materia({ clave: "ACF0901", nombre: "CÁLCULO DIFERENCIAL", x: 1, y: 1, codigoEstado: 2, calificacion: "92" }),
  materia({ clave: "ACF0902", nombre: "CÁLCULO INTEGRAL", x: 1, y: 2, codigoEstado: 2, calificacion: "88" }),
  materia({ clave: "ACF0903", nombre: "CÁLCULO VECTORIAL", x: 1, y: 3, codigoEstado: 2, calificacion: "85" }),
  materia({ clave: "ACF0904", nombre: "ÁLGEBRA LINEAL", x: 1, y: 4, codigoEstado: 2, calificacion: "90" }),
  materia({ clave: "AED1285", nombre: "FUNDAMENTOS DE PROGRAMACIÓN", x: 1, y: 5, codigoEstado: 2, calificacion: "95" }),
  materia({ clave: "AEF1041", nombre: "MATEMÁTICAS DISCRETAS I", x: 1, y: 6, codigoEstado: 2, calificacion: "87" }),
  materia({ clave: "AQF1001", nombre: "QUÍMICA GENERAL", x: 1, y: 7, codigoEstado: 2, calificacion: "83" }),
  materia({ clave: "AIF1001", nombre: "INTRODUCCIÓN A LA INGENIERÍA", x: 1, y: 8, codigoEstado: 2, calificacion: "98" }),

  // SEMESTRE 2 (x=2) - TODAS ACREDITADAS
  materia({ clave: "ACF0905", nombre: "ECUACIONES DIFERENCIALES", x: 2, y: 1, codigoEstado: 2, calificacion: "89", seriacion: [[coord(1, 1), coord(1, 2), coord(1, 3)]] }),
  materia({ clave: "ACF0906", nombre: "MATEMÁTICAS DISCRETAS II", x: 2, y: 2, codigoEstado: 2, calificacion: "91", seriacion: [[coord(1, 6)]] }),
  materia({ clave: "AED1286", nombre: "PROGRAMACIÓN ORIENTADA A OBJETOS", x: 2, y: 3, codigoEstado: 2, calificacion: "93", seriacion: [[coord(1, 5)]] }),
  materia({ clave: "AED1287", nombre: "ESTRUCTURA DE DATOS", x: 2, y: 4, codigoEstado: 2, calificacion: "86", seriacion: [[coord(2, 3)]] }),
  materia({ clave: "AQF1002", nombre: "FÍSICA GENERAL", x: 2, y: 5, codigoEstado: 2, calificacion: "84", seriacion: [[coord(1, 7)]] }),
  materia({ clave: "AHF1001", nombre: "EXPRESIÓN ORAL Y ESCRITA", x: 2, y: 6, codigoEstado: 2, calificacion: "94" }),

  // SEMESTRE 3 (x=3) - CURSANDO (INSCRIPCIÓN_NORMAL = 1)
  materia({ clave: "AED1288", nombre: "BASES DE DATOS", x: 3, y: 1, codigoEstado: 1, seriacion: [[coord(2, 3), coord(2, 4)]] }),
  materia({ clave: "AED1289", nombre: "ARQUITECTURA DE COMPUTADORAS", x: 3, y: 2, codigoEstado: 1, seriacion: [[coord(2, 3)]] }),
  materia({ clave: "AED1290", nombre: "SISTEMAS OPERATIVOS", x: 3, y: 3, codigoEstado: 1, seriacion: [[coord(2, 4)]] }),
  materia({ clave: "AED1291", nombre: "REDES DE COMPUTADORAS", x: 3, y: 4, codigoEstado: 1, seriacion: [[coord(2, 3)]] }),
  materia({ clave: "ACF0907", nombre: "PROBABILIDAD Y ESTADÍSTICA", x: 3, y: 5, codigoEstado: 1, seriacion: [[coord(2, 2)]] }),
  materia({ clave: "AHF1002", nombre: "ÉTICA PROFESIONAL", x: 3, y: 6, codigoEstado: 1 }),

  // SEMESTRE 4 (x=4) - MEZCLA: INSCRITO_EN_CURSO_NORMAL (11) y FALTA_CURSAR (0)
  materia({ clave: "AED1292", nombre: "INGENIERÍA DE SOFTWARE I", x: 4, y: 1, codigoEstado: 11, seriacion: [[coord(3, 1), coord(3, 2)]] }),
  materia({ clave: "AED1293", nombre: "COMPILADORES", x: 4, y: 2, codigoEstado: 11, seriacion: [[coord(3, 2), coord(3, 3)]] }),
  materia({ clave: "AED1294", nombre: "INTELIGENCIA ARTIFICIAL", x: 4, y: 3, codigoEstado: 0, seriacion: [[coord(3, 1), coord(3, 3), coord(3, 4)]] }),
  materia({ clave: "AED1295", nombre: "SEGURIDAD INFORMÁTICA", x: 4, y: 4, codigoEstado: 0, seriacion: [[coord(3, 4)]] }),
  materia({ clave: "AED1296", nombre: "COMPUTACIÓN GRÁFICA", x: 4, y: 5, codigoEstado: 0, seriacion: [[coord(3, 3)]] }),
  materia({ clave: "AEF1042", nombre: "INVESTIGACIÓN DE OPERACIONES", x: 4, y: 6, codigoEstado: 0, seriacion: [[coord(3, 5)]] }),

  // SEMESTRE 5 (x=5) - PENDIENTES (FALTA_CURSAR = 0) con algunas REPETICIÓN_POR_CURSAR (5)
  materia({ clave: "AED1297", nombre: "INGENIERÍA DE SOFTWARE II", x: 5, y: 1, codigoEstado: 0, seriacion: [[coord(4, 1)]] }),
  materia({ clave: "AED1298", nombre: "DESARROLLO WEB", x: 5, y: 2, codigoEstado: 0, seriacion: [[coord(4, 1)]] }),
  materia({ clave: "AED1299", nombre: "DESARROLLO MÓVIL", x: 5, y: 3, codigoEstado: 0, seriacion: [[coord(4, 1)]] }),
  materia({ clave: "AED1300", nombre: "COMPUTACIÓN EN LA NUBE", x: 5, y: 4, codigoEstado: 5, seriacion: [[coord(4, 2)]] }),
  materia({ clave: "AED1301", nombre: "INTERNET DE LAS COSAS", x: 5, y: 5, codigoEstado: 0, seriacion: [[coord(4, 3)]] }),
  materia({ clave: "AHF1003", nombre: "ECONOMÍA PARA INGENIEROS", x: 5, y: 6, codigoEstado: 0 }),

  // SEMESTRE 6 (x=6) - PENDIENTES (FALTA_CURSAR = 0)
  materia({ clave: "AED1302", nombre: "PROYECTO DE TITULACIÓN I", x: 6, y: 1, codigoEstado: 0, seriacion: [[coord(5, 1), coord(5, 2), coord(5, 3)]] }),
  materia({ clave: "AED1303", nombre: "ADMINISTRACIÓN DE PROYECTOS", x: 6, y: 2, codigoEstado: 0, seriacion: [[coord(5, 1)]] }),
  materia({ clave: "AED1304", nombre: "OPTATIVA I", x: 6, y: 3, codigoEstado: 0 }),
  materia({ clave: "AED1305", nombre: "OPTATIVA II", x: 6, y: 4, codigoEstado: 0 }),
  materia({ clave: "AHF1004", nombre: "LEGISLACIÓN LABORAL", x: 6, y: 5, codigoEstado: 0 }),

  // SEMESTRE 7 (x=7) - SIN MATERIAS (para mostrar semestre vacío en dev)
  // No añadimos materias aquí a propósito para demostrar semestre vacío

  // SEMESTRE 8 (x=8) - PENDIENTES
  materia({ clave: "AED1306", nombre: "PROYECTO DE TITULACIÓN II", x: 8, y: 1, codigoEstado: 0, seriacion: [[coord(6, 1)]] }),
  materia({ clave: "AED1307", nombre: "SEMINARIO DE TITULACIÓN", x: 8, y: 2, codigoEstado: 0, seriacion: [[coord(6, 1)]] }),
];

const porCoordenada = new Map(
  MOCK_RETICULA.map((m) => [`${m.coordenadas.x}:${m.coordenadas.y}`, m]),
);

for (const m of MOCK_RETICULA) {
  const anteriores = new Set<string>();
  for (const grupo of m.seriacion) {
    for (const c of grupo) {
      const prec = porCoordenada.get(`${c.x}:${c.y}`);
      if (prec) anteriores.add(prec.clave);
    }
  }
  m.anteriores = Array.from(anteriores);
}

for (const m of MOCK_RETICULA) {
  const siguientes = new Set<string>();
  for (const m2 of MOCK_RETICULA) {
    if (m2.anteriores.includes(m.clave)) siguientes.add(m2.clave);
  }
  m.siguientes = Array.from(siguientes);
}

export const MOCK_SEMESTRES: SemestresReticula = (() => {
  const maxX = Math.max(...MOCK_RETICULA.map((m) => m.coordenadas.x));
  const semestres = Array.from({ length: maxX }, () => [] as ReticulaMateria[]);
  for (const m of MOCK_RETICULA) {
    semestres[m.coordenadas.x - 1].push(m);
  }
  return semestres;
})();

export const MOCK_RETICULA_MAP: ReticulaMap = new Map(
  MOCK_RETICULA.map((m) => [m.clave, m]),
);

export const MOCK_ALUMNO_CON_RETICULA = {
  nombre: "JUAN PÉREZ GARCÍA",
  carrera: "INGENIERÍA EN SISTEMAS COMPUTACIONALES",
  semestre: 3,
  boleta: {
    materias: [],
    promedio: "0.00",
  },
  horario: [],
  adeudos: [],
  progreso: 35.5,
  semestres: MOCK_SEMESTRES,
  reticulaMap: MOCK_RETICULA_MAP,
  fechaReinscripcion: null,
};