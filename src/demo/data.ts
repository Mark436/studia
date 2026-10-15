// Fictional, fully in-memory showcase data for `?demo`. Nothing here is
// persisted: the demo swaps storage for an in-memory backend (see startDemo.ts)
// and the data lives only for the current page session. All names, subjects and
// numbers are invented; classrooms are TecNM-style to feel realistic but data
// is fictional.

import type {
  Adeudos,
  Alumno,
  Aviso,
  CalificacionMateria,
  HorarioDia,
  HorarioMateria,
  ReticulaMap,
  ReticulaMateria,
  SemestresReticula,
} from "sith-api-client";
import { ESTADO_MATERIA_RETICULA } from "sith-api-client";

const SALON = "Demo";

// ---------------------------------------------------------------------------
// Retícula (small, invented Ing. Industrial plan)
// ---------------------------------------------------------------------------

const ESTADOS = Object.values(
  ESTADO_MATERIA_RETICULA,
) as ESTADO_MATERIA_RETICULA[];

function estadoDeCodigo(codigo: number): ESTADO_MATERIA_RETICULA {
  return ESTADOS[codigo] ?? ESTADO_MATERIA_RETICULA.FALTA_CURSAR;
}

function retMateria(params: {
  clave: string;
  nombre: string;
  x: number;
  y: number;
  codigoEstado: number;
  calificacion?: string;
}): ReticulaMateria {
  const { clave, nombre, x, y, codigoEstado, calificacion } = params;
  return {
    clave,
    nombre,
    coordenadas: { x, y },
    codigoEstado,
    estado: estadoDeCodigo(codigoEstado),
    anteriores: [],
    siguientes: [],
    seriacion: [],
    calificacion: calificacion
      ? { calificacion, oportunidad: "OO" }
      : undefined,
  };
}

// 0 = Falta cursar · 1 = Inscripción normal · 2 = Acreditada
const RETICULA: ReticulaMateria[] = [
  // Semestre 1 — acreditadas
  retMateria({ clave: "ACF0901", nombre: "Cálculo Diferencial", x: 1, y: 1, codigoEstado: 2, calificacion: "92" }),
  retMateria({ clave: "AEC1076", nombre: "Química", x: 1, y: 2, codigoEstado: 2, calificacion: "88" }),
  retMateria({ clave: "ACA0908", nombre: "Taller de Ética", x: 1, y: 3, codigoEstado: 2, calificacion: "94" }),
  retMateria({ clave: "ACC0906", nombre: "Fundamentos de Investigación", x: 1, y: 4, codigoEstado: 2, calificacion: "90" }),

  // Semestre 2 — acreditadas
  retMateria({ clave: "ACF0902", nombre: "Cálculo Integral", x: 2, y: 1, codigoEstado: 2, calificacion: "85" }),
  retMateria({ clave: "ACF0904", nombre: "Álgebra Lineal", x: 2, y: 2, codigoEstado: 2, calificacion: "89" }),
  retMateria({ clave: "AEF1052", nombre: "Probabilidad y Estadística", x: 2, y: 3, codigoEstado: 2, calificacion: "87" }),
  retMateria({ clave: "AEF1005", nombre: "Programación de Sistemas", x: 2, y: 4, codigoEstado: 2, calificacion: "91" }),

  // Semestre 3 — acreditadas
  retMateria({ clave: "ACF0903", nombre: "Cálculo Vectorial", x: 3, y: 1, codigoEstado: 2, calificacion: "86" }),
  retMateria({ clave: "ACF0905", nombre: "Ecuaciones Diferenciales", x: 3, y: 2, codigoEstado: 2, calificacion: "84" }),
  retMateria({ clave: "AEF1019", nombre: "Estadística Inferencial", x: 3, y: 3, codigoEstado: 2, calificacion: "88" }),
  retMateria({ clave: "IND1005", nombre: "Estudio del Trabajo I", x: 3, y: 4, codigoEstado: 2, calificacion: "92" }),

  // Semestre 4 — acreditadas
  retMateria({ clave: "INC1010", nombre: "Investigación de Operaciones I", x: 4, y: 1, codigoEstado: 2, calificacion: "87" }),
  retMateria({ clave: "IND1011", nombre: "Procesos de Fabricación", x: 4, y: 2, codigoEstado: 2, calificacion: "90" }),
  retMateria({ clave: "ACF1007", nombre: "Física", x: 4, y: 3, codigoEstado: 2, calificacion: "85" }),
  retMateria({ clave: "AEF1023", nombre: "Contabilidad y Costos", x: 4, y: 4, codigoEstado: 2, calificacion: "89" }),

  // Semestre 5 — cursando
  retMateria({ clave: "INC1018", nombre: "Investigación de Operaciones II", x: 5, y: 1, codigoEstado: 1 }),
  retMateria({ clave: "IND1024", nombre: "Planeación y Control de la Producción", x: 5, y: 2, codigoEstado: 1 }),
  retMateria({ clave: "IND1015", nombre: "Higiene y Seguridad Industrial", x: 5, y: 3, codigoEstado: 1 }),
  retMateria({ clave: "IND1025", nombre: "Metrología y Normalización", x: 5, y: 4, codigoEstado: 1 }),
  retMateria({ clave: "INC1025", nombre: "Ingeniería Económica", x: 5, y: 5, codigoEstado: 1 }),
  retMateria({ clave: "INC1023", nombre: "Logística y Cadena de Suministro", x: 5, y: 6, codigoEstado: 1 }),
];

const DEMO_SEMESTRES: SemestresReticula = (() => {
  const maxX = Math.max(...RETICULA.map((m) => m.coordenadas.x));
  const semestres = Array.from({ length: maxX }, () => [] as ReticulaMateria[]);
  for (const materia of RETICULA) {
    semestres[materia.coordenadas.x - 1].push(materia);
  }
  return semestres;
})();

const DEMO_RETICULA_MAP: ReticulaMap = new Map(
  RETICULA.map((materia) => [materia.clave, materia]),
);

// ---------------------------------------------------------------------------
// Horario + boleta (6 materias; 4 calificadas, 2 pendientes)
// ---------------------------------------------------------------------------

type Dia = "lunes" | "martes" | "miercoles" | "jueves" | "viernes";

interface DemoMateriaSpec {
  clave: string;
  nombre: string;
  docente: string;
  grupo: string;
  creditos: number;
  dias: Partial<Record<Dia, string>>;
  /** "" = sin calificar todavía. */
  calificacion: string;
}

const MATERIAS: DemoMateriaSpec[] = [
  {
    clave: "INC1018",
    nombre: "Investigación de Operaciones II",
    docente: "Robles Jiménez Adriana",
    grupo: "IND6A",
    creditos: 5,
    dias: { lunes: "09:00-11:00", miercoles: "09:00-11:00" },
    calificacion: "9.0",
  },
  {
    clave: "IND1024",
    nombre: "Planeación y Control de la Producción",
    docente: "Camacho Ruiz Fernando",
    grupo: "IND6A",
    creditos: 5,
    dias: { martes: "11:00-13:00", jueves: "11:00-13:00" },
    calificacion: "8.5",
  },
  {
    clave: "IND1015",
    nombre: "Higiene y Seguridad Industrial",
    docente: "Espinoza Leyva Norma",
    grupo: "IND6A",
    creditos: 5,
    dias: { lunes: "11:00-13:00", miercoles: "11:00-13:00" },
    calificacion: "9.4",
  },
  {
    clave: "IND1025",
    nombre: "Metrología y Normalización",
    docente: "Valenzuela Soto Ramiro",
    grupo: "IND6A",
    creditos: 5,
    dias: { martes: "09:00-11:00", jueves: "09:00-11:00" },
    calificacion: "8.2",
  },
  {
    clave: "INC1025",
    nombre: "Ingeniería Económica",
    docente: "Bustamante Acuña Sergio",
    grupo: "IND6A",
    creditos: 5,
    dias: { viernes: "08:00-10:00" },
    calificacion: "",
  },
  {
    clave: "INC1023",
    nombre: "Logística y Cadena de Suministro",
    docente: "Tapia Vargas Mariana",
    grupo: "IND6A",
    creditos: 5,
    dias: { viernes: "10:00-12:00" },
    calificacion: "",
  },
];

function toDias(spec: DemoMateriaSpec): HorarioDia {
  const dias: HorarioDia = {};
  for (const [dia, rango] of Object.entries(spec.dias) as [Dia, string][]) {
    dias[dia] = `${rango} ${SALON}`;
  }
  return dias;
}

const DEMO_HORARIO: HorarioMateria[] = MATERIAS.map((spec) => ({
  clave: spec.clave,
  creditos: spec.creditos,
  grupo: spec.grupo,
  docente: spec.docente,
  dias: toDias(spec),
}));

const DEMO_CALIFICACIONES: CalificacionMateria[] = MATERIAS.map((spec) => ({
  clave: spec.clave,
  nombre: spec.nombre,
  calificacion: spec.calificacion,
  claveOportunidad: spec.calificacion === "" ? "" : "OO",
  oportunidad: spec.calificacion === "" ? "—" : "Ev Ordinaria",
  creditos: spec.creditos,
}));

const PROMEDIO_SEMESTRAL = "8.78";

const DEMO_ADEUDOS: Adeudos = {
  biblioteca: "",
  academico: "",
  escolar: "",
  financiero: "",
  administrativo: "",
  tieneAdeudos: false,
};

export const DEMO_ALUMNO: Alumno = {
  numeroControl: "00000000",
  nombre: "Diego Alejandro Terán Salcido",
  carrera: "Ingeniería Industrial",
  correo: "demo@ejemplo.mx",
  telefono: "000 000 0000",
  semestre: 5,
  fechaReinscripcion: "",
  periodoInscripcion: { inicio: "", fin: "" },
  promedioGeneral: 8.7,
  promedioSemestral: Number.parseFloat(PROMEDIO_SEMESTRAL),
  boleta: {
    periodo: "2026-2",
    promedio: PROMEDIO_SEMESTRAL,
    materias: DEMO_CALIFICACIONES,
  },
  adeudos: DEMO_ADEUDOS,
  progreso: 63.5,
  creditos: { totales: 260, faltantes: 95 },
  horario: DEMO_HORARIO,
  semestres: DEMO_SEMESTRES,
  reticulaMap: DEMO_RETICULA_MAP,
};

export const DEMO_AVISOS: Aviso[] = [
  {
    titulo: "Bienvenido a la demostración",
    mensaje:
      "Estás viendo datos ficticios de Ingeniería Industrial. Nada de lo que hagas aquí se guarda: al recargar, la demostración vuelve a empezar.",
    tipo: "info",
  },
  {
    titulo: "Periodo de reinscripción",
    mensaje:
      "Consulta las fechas de tu periodo de reinscripción en la sección de Alumno.",
    tipo: "info",
  },
  {
    titulo: "Servicio de biblioteca",
    mensaje:
      "Recuerda devolver los libros prestados antes del cierre del semestre.",
    tipo: "warn",
  },
];
