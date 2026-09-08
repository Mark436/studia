export interface ArchivoListado {
  archivo: string;
  modificado: Date | null;
}

export interface ResultadoPrehorarios {
  anioActual: number | null;
  cantidad: number;
  archivos: string[];
  prehorarios: string[];
  programaciones: string[];
  /** Fecha de modificación por archivo (minuto, hora local del servidor). */
  modificados?: Readonly<Record<string, Date | null>>;
  /** Listado completo con fechas, tal como aparece en `?C=M;O=D`. */
  todos?: ArchivoListado[];
}

const FETCH_URL = import.meta.env.DEV
  ? "/documentos/?C=M;O=D"
  : "https://ith.mx/documentos/?C=M;O=D";

const SITIO_ITH = "https://ith.mx/";

// El webmaster del ITH publica el calendario oficial vigente incrustado en
// esta página (`<embed src>` y/o `<ul class="doc"><a href>`).
const CALENDARIO_OFICIAL_URL = import.meta.env.DEV
  ? "/calendario-escolar.html"
  : "https://ith.mx/calendario-escolar.html";

export function extraerAnio(archivo: string): number | null {
  const match = archivo.match(/20\d{2}/);

  return match ? Number(match[0]) : null;
}

export function esPrehorario(archivo: string): boolean {
  return /prehorario/i.test(archivo);
}

export interface CalendarioOficial {
  archivo: string;
  url: string;
}

/**
 * Convierte la ruta que apunta la página `calendario-escolar.html` (relativa
 * tipo "documentos/CALENDARIO…pdf" o absoluta) en el archivo + URL canónica.
 * Fuera de `https://ith.mx` o sin extensión `.pdf` no se acepta.
 */
export function interpretarFuenteCalendario(
  fuente: string,
): CalendarioOficial | null {
  const archivo = extraerNombreArchivo(fuente, SITIO_ITH);
  if (!archivo || !/\.pdf$/i.test(archivo)) return null;

  const url = new URL(fuente, SITIO_ITH);
  if (url.origin !== new URL(SITIO_ITH).origin) return null;

  return { archivo, url: url.href };
}

/**
 * La página embebe a veces varios calendarios (uno por periodo). Se escoge el
 * vigente: el que tiene el año más alto en el nombre (desempate: primero en la
 * página).
 */
export function parseCalendarioOficial(html: string): CalendarioOficial | null {
  const dom = new DOMParser().parseFromString(html, "text/html");
  const fuentes = [
    ...dom.querySelectorAll<HTMLEmbedElement>("embed[src$='.pdf']"),
    ...dom.querySelectorAll<HTMLAnchorElement>("ul.doc a[href$='.pdf']"),
  ]
    .map(element =>
      element instanceof HTMLAnchorElement
        ? element.getAttribute("href")
        : element.getAttribute("src"),
    )
    .filter((fuente): fuente is string => Boolean(fuente));

  let mejor: { oficial: CalendarioOficial; anio: number } | null = null;
  for (const fuente of fuentes) {
    const oficial = interpretarFuenteCalendario(fuente);
    if (!oficial) continue;
    const anio = extraerAnio(oficial.archivo) ?? -1;
    if (!mejor || anio > mejor.anio) {
      mejor = { oficial, anio };
    }
  }

  return mejor?.oficial ?? null;
}

export async function obtenerCalendarioOficial(): Promise<CalendarioOficial | null> {
  const response = await fetch(CALENDARIO_OFICIAL_URL);

  return response.ok ? parseCalendarioOficial(await response.text()) : null;
}

export function urlDocumento(archivo: string): string {
  return `https://ith.mx/documentos/${encodeURIComponent(archivo)}`;
}

export function urlPrehorario(archivo: string): string {
  return urlDocumento(archivo);
}

export function esProgramacion(archivo: string): boolean {
  return /programacion/i.test(archivo);
}

/**
 * Extrae el nombre del archivo de un href del listado. Los navegadores dejan
 * `href` relativo en documentos de `DOMParser` (base `about:blank`), por lo
 * que `new URL(href, baseUrl)` con base relativa lanzaría y descartaría todos
 * los archivos; aquí los hrefs relativos se procesan en crudo y solo los
 * absolutos se resuelven contra `baseUrl`.
 */
export function extraerNombreArchivo(
  href: string,
  baseUrl: string,
): string | null {
  try {
    const url =
      href.startsWith("http://") ||
      href.startsWith("https://") ||
      href.startsWith("//")
        ? new URL(href, baseUrl)
        : null;
    const camino = url ? url.pathname : href;
    const nombre = decodeURIComponent(
      camino.split("?")[0].split("#")[0].split("/").pop() ?? "",
    );

    return nombre && nombre !== "." && nombre !== ".." ? nombre : null;
  } catch {
    return null;
  }
}

/**
 * Interpreta una celda de fecha del listado de Apache ("2026-08-12 15:03  ")
 * como fecha local. No depende de DOMParser para poder probarse en Node.
 */
export function parseFechaModificacion(texto: string): Date | null {
  const match = /\b(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})\b/.exec(texto);

  return match
    ? new Date(
        Number(match[1]),
        Number(match[2]) - 1,
        Number(match[3]),
        Number(match[4]),
        Number(match[5]),
      )
    : null;
}

/**
 * Lee todo el listado (`?C=M;O=D`) conservando por archivo su fecha de
 * modificación. Fila tipo:
 * `<tr><td><img…></td><td><a href="X">X</a></td><td>2026-08-12 15:03  </td>…`
 */
export function parseArchivosConFecha(
  html: string,
  baseUrl: string,
): ArchivoListado[] {
  const dom = new DOMParser().parseFromString(html, "text/html");

  return [...dom.querySelectorAll<HTMLTableRowElement>("tr")].flatMap(tr => {
    const anchor = tr.querySelector<HTMLAnchorElement>("td:nth-child(2) > a");
    if (!anchor) return [];
    const archivo = extraerNombreArchivo(
      anchor.getAttribute("href") ?? anchor.href,
      baseUrl,
    );
    if (!archivo) return [];

    const celdaFecha = tr.querySelector("td:nth-child(3)");

    return [
      {
        archivo,
        modificado: parseFechaModificacion(celdaFecha?.textContent ?? ""),
      },
    ];
  });
}

/**
 * Interpreta el listado de `?C=M;O=D` (orden de modificación, más reciente
 * primero). `archivos` conserva ese orden: es la clave para desempatar entre
 * candidatos de la misma carrera.
 */
export function parsePrehorarioListing(
  html: string,
  baseUrl: string,
): ResultadoPrehorarios {
  const todos = parseArchivosConFecha(html, baseUrl);
  const archivos = todos.map(entrada => entrada.archivo);
  const modificados: Record<string, Date | null> = {};
  for (const entrada of todos) {
    modificados[entrada.archivo] = entrada.modificado;
  }

  const candidatos = archivos.filter(
    archivo => esPrehorario(archivo) || esProgramacion(archivo),
  );

  const anios = candidatos
    .map(extraerAnio)
    .filter((anio): anio is number => anio !== null);

  const anioActual = anios.length ? Math.max(...anios) : null;

  const actuales = candidatos.filter(
    archivo => extraerAnio(archivo) === anioActual,
  );

  return {
    anioActual,
    cantidad: actuales.length,
    archivos: actuales,
    prehorarios: actuales.filter(esPrehorario),
    programaciones: actuales.filter(esProgramacion),
    modificados,
    todos,
  };
}

export async function obtenerPrehorarios(): Promise<ResultadoPrehorarios> {
  const response = await fetch(FETCH_URL);

  if (!response.ok) {
    throw new Error(`Error HTTP: ${response.status}`);
  }

  return parsePrehorarioListing(await response.text(), FETCH_URL);
}

export interface CandidatoPrehorario {
  archivo: string;
  puntaje: number;
  esPrehorario: boolean;
}

export interface ResultadoPrehorarioCarrera {
  archivo: string | null;
  puntaje: number;
  carreraNormalizada: string;
  candidatos: CandidatoPrehorario[];
}

const ABREVIATURAS_CARRERAS: Record<string, string> = {
  ING: "INGENIERIA",
  LIC: "LICENCIATURA",
  SIS: "SISTEMAS",
  COMP: "COMPUTACIONALES",
  INFO: "INFORMATICA",
  IND: "INDUSTRIAL",
  GEST: "GESTION",
};

/**
 * Tokens genéricos de los nombres de carrera que no sirven para distinguir un
 * prehorario de otro (prefijos comunes y preposiciones). «ING. EN AERONÁUTICA»
 * no debe emparejar con un archivo ..._INGENIERIA_EN_SISTEMAS_... solo por
 * compartir INGENIERIA y EN: eso inflaría su puntaje.
 */
const STOPWORDS_CARRERA = new Set([
  "INGENIERIA",
  "LICENCIATURA",
  "EN",
  "E",
  "DE",
  "DEL",
  "LA",
  "EL",
  "UN",
  "UNA",
  "AL",
]);

function aplanarTexto(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
}

function normalizarCarrera(texto: string): string {
  const tokens = aplanarTexto(texto)
    .replace(/[^A-Z0-9]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map(token => ABREVIATURAS_CARRERAS[token] ?? token);

  return tokens
    .filter(token => !STOPWORDS_CARRERA.has(token))
    .join(" ");
}

function puntuarArchivo(
  archivo: string,
  carreraNormalizada: string,
): number {
  const nombre = aplanarTexto(archivo.replace(/\.[a-z0-9]+$/i, ""));

  return carreraNormalizada
    .split(" ")
    .filter(Boolean)
    .filter(token => nombre.includes(token)).length;
}

export function elegirPrehorarioCarrera(
  resultado: ResultadoPrehorarios,
  carrera: string,
): ResultadoPrehorarioCarrera {
  const carreraNormalizada = normalizarCarrera(carrera);
  // `archivos` respeta el orden del servidor (`?C=M;O=D`: más reciente
  // primero). Se conserva ese orden: la recencia desempata cuando el puntaje
  // del más reciente está dentro del umbral.
  const candidatos: CandidatoPrehorario[] = resultado.archivos.map(archivo => ({
    archivo,
    esPrehorario: esPrehorario(archivo),
    puntaje: puntuarArchivo(archivo, carreraNormalizada),
  }));

  const coincidentes = candidatos.filter(candidato => candidato.puntaje > 0);
  const puntajeMaximo = coincidentes.reduce(
    (maximo, candidato) => Math.max(maximo, candidato.puntaje),
    0,
  );
  // Recencia solo cuando el más reciente está suficientemente cerca: a lo
  // más un token por debajo del mejor, y nunca por debajo de 2 tokens.
  // Así, el ganador siempre comparte los tokens distintivos de la carrera.
  // Los tokens genéricos (INGENIERIA, EN, ...) se eliminaron en
  // `normalizarCarrera`, así que un prehorario de otra carrera no puntúa solo
  // por llevar el prefijo común.
  const umbral = Math.max(puntajeMaximo - 1, Math.min(2, puntajeMaximo));

  const elegido =
    coincidentes.find(candidato => candidato.puntaje >= umbral) ?? null;

  return {
    archivo: elegido?.archivo ?? null,
    puntaje: elegido?.puntaje ?? 0,
    carreraNormalizada,
    candidatos,
  };
}

export function esFechaDentroVentana(
  fecha: Date | null,
  ahora: Date,
  ventanaDias: number,
): boolean {
  if (fecha === null) return false;
  const tiempo = fecha.getTime();

  return (
    tiempo <= ahora.getTime() &&
    tiempo >= ahora.getTime() - ventanaDias * 86_400_000
  );
}