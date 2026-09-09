import { describe, expect, test } from "vitest";
import {
  elegirCalendario,
  elegirPrehorarioCarrera,
  esCalendario,
  esFechaDentroVentana,
  esPrehorario,
  esProgramacion,
  extraerAnio,
  extraerNombreArchivo,
  parseFechaModificacion,
  urlDocumento,
  urlPrehorario,
} from "./prehorario";
import type { ArchivoListado, ResultadoPrehorarios } from "./prehorario";

const CARRERA = "ING. SIS. COMP.";

function resultado(carrera: string, otros: string[] = []): ResultadoPrehorarios {
  const prehorarios = [carrera];
  return {
    anioActual: 2026,
    cantidad: prehorarios.length + otros.length,
    archivos: [...prehorarios, ...otros],
    prehorarios,
    programaciones: otros,
  };
}

describe("extraerAnio", () => {
  test("extrae el año del nombre", () => {
    expect(extraerAnio("PREHORARIO_X_2026-2.pdf")).toBe(2026);
  });

  test("devuelve null sin año", () => {
    expect(extraerAnio("PREHORARIO_X.pdf")).toBeNull();
  });
});

describe("esPrehorario / esProgramacion", () => {
  test("distingue por tipo", () => {
    expect(esPrehorario("PREHORARIO_X_2026-2.pdf")).toBe(true);
    expect(esProgramacion("PREHORARIO_X_2026-2.pdf")).toBe(false);
    expect(esPrehorario("PROGRAMACION_X_2026-2_alum.pdf")).toBe(false);
    expect(esProgramacion("PROGRAMACION_X_2026-2_alum.pdf")).toBe(true);
  });
});

describe("extraerNombreArchivo", () => {
  const BASE_RELATIVA = "/documentos/?C=M;O=D";
  const BASE_ABSOLUTA = "https://ith.mx/documentos/?C=M;O=D";

  test("href relativo (DOMParser en dev) no lanza y extrae el nombre", () => {
    // Regresión: `new URL(href, base)` con base relativa lanzaba y se
    // descartaban todos los archivos (candidatos vacíos / elegido null).
    expect(
      extraerNombreArchivo(
        "PREHORARIO_INGENIERIA_EN_SISTEMAS_COMPUTACIONALES_2026-2.pdf",
        BASE_RELATIVA,
      ),
    ).toBe("PREHORARIO_INGENIERIA_EN_SISTEMAS_COMPUTACIONALES_2026-2.pdf");
  });

  test("href absoluto resuelto contra la base", () => {
    expect(
      extraerNombreArchivo(
        "https://ith.mx/documentos/PREHORARIO_INDUSTRIAL_2026-2.pdf",
        BASE_ABSOLUTA,
      ),
    ).toBe("PREHORARIO_INDUSTRIAL_2026-2.pdf");
  });

  test("href absoluto por ruta (proxi localhost)", () => {
    expect(
      extraerNombreArchivo(
        "/documentos/PREHORARIO_ELECTRICA_2026-2.pdf",
        BASE_RELATIVA,
      ),
    ).toBe("PREHORARIO_ELECTRICA_2026-2.pdf");
  });

  test("decodifica %20", () => {
    expect(
      extraerNombreArchivo(
        "PREHORARIO%20INGENIERIA_EN_INFORMATICA_2026-2.pdf",
        BASE_RELATIVA,
      ),
    ).toBe("PREHORARIO INGENIERIA_EN_INFORMATICA_2026-2.pdf");
  });

  test("ignora enlaces de ordenación (?C=) y vacíos", () => {
    expect(extraerNombreArchivo("?C=N;O=A", BASE_RELATIVA)).toBeNull();
    expect(extraerNombreArchivo("?C=M;O=A", BASE_RELATIVA)).toBeNull();
    expect(extraerNombreArchivo("", BASE_RELATIVA)).toBeNull();
  });
});

describe("urlPrehorario", () => {
  test("construye el URL canónico y codifica espacios", () => {
    expect(
      urlPrehorario("PREHORARIO_INGENIERIA_EN_SISTEMAS_COMPUTACIONALES_2026-2.pdf"),
    ).toBe(
      "/api/ith/documentos/PREHORARIO_INGENIERIA_EN_SISTEMAS_COMPUTACIONALES_2026-2.pdf",
    );
    expect(urlPrehorario("PREHORARIO X 2026-1.pdf")).toBe(
      "/api/ith/documentos/PREHORARIO%20X%202026-1.pdf",
    );
  });
});

describe("elegirPrehorarioCarrera", () => {
  test("en empate de puntaje gana el más reciente (orden del servidor)", () => {
    const resultado = {
      anioActual: 2026,
      cantidad: 2,
      archivos: [
        "PROGRAMACION_INGENIERIA_EN_SISTEMAS_COMPUTACIONALES_2026-2_alum.pdf",
        "PREHORARIO_INGENIERIA_EN_SISTEMAS_COMPUTACIONALES_2026-2.pdf",
      ],
      prehorarios: [
        "PREHORARIO_INGENIERIA_EN_SISTEMAS_COMPUTACIONALES_2026-2.pdf",
      ],
      programaciones: [
        "PROGRAMACION_INGENIERIA_EN_SISTEMAS_COMPUTACIONALES_2026-2_alum.pdf",
      ],
    };
    // Iguales en tokens y dentro del umbral: gana el primero del orden del
    // servidor, que es el más reciente (`?C=M;O=D`).
    const elegido = elegirPrehorarioCarrera(resultado, CARRERA);
    expect(elegido.archivo).toBe(
      "PROGRAMACION_INGENIERIA_EN_SISTEMAS_COMPUTACIONALES_2026-2_alum.pdf",
    );
  });

  test("en empate total conserva el orden del servidor (más reciente primero)", () => {
    const resultado = {
      anioActual: 2026,
      cantidad: 2,
      archivos: [
        "PREHORARIO_INGENIERIA_EN_SISTEMAS_COMPUTACIONALES_2026-2.pdf",
        "PREHORARIO_INGENIERIA_EN_SISTEMAS_COMPUTACIONALES_2026-1.pdf",
      ],
      prehorarios: [
        "PREHORARIO_INGENIERIA_EN_SISTEMAS_COMPUTACIONALES_2026-2.pdf",
        "PREHORARIO_INGENIERIA_EN_SISTEMAS_COMPUTACIONALES_2026-1.pdf",
      ],
      programaciones: [],
    };
    // Ambos puntúan igual (3/3); el orden estable debe quedarse con el primero,
    // que es el más reciente según `?C=M;O=D`.
    const elegido = elegirPrehorarioCarrera(resultado, CARRERA);
    expect(elegido.archivo).toBe(
      "PREHORARIO_INGENIERIA_EN_SISTEMAS_COMPUTACIONALES_2026-2.pdf",
    );
  });

  test("normaliza abreviaturas, tildes y descarta tokens genéricos", () => {
    const elegido = elegirPrehorarioCarrera(
      resultado("PREHORARIO_INGENIERIA_EN_SISTEMAS_COMPUTACIONALES_2026-2.pdf"),
      "ING. SIS. COMP.",
    );
    // INGENIERIA se descarta como token genérico; quedan los distintivos.
    expect(elegido.carreraNormalizada).toBe("SISTEMAS COMPUTACIONALES");
    expect(elegido.archivo).toBe(
      "PREHORARIO_INGENIERIA_EN_SISTEMAS_COMPUTACIONALES_2026-2.pdf",
    );
  });

  test("sin coincidencia devuelve null", () => {
    const elegido = elegirPrehorarioCarrera(
      resultado("PREHORARIO_INDUSTRIAL_2026-2.pdf"),
      CARRERA,
    );
    expect(elegido.archivo).toBeNull();
    expect(elegido.puntaje).toBe(0);
  });

  test("gana quien tiene más tokens distintivos, sin que lo salve la recencia", () => {
    const resultado = {
      anioActual: 2026,
      cantidad: 2,
      archivos: [
        "PREHORARIO_INGENIERIA_EN_SISTEMA_COMPUTACIONALES_2026-2.pdf",
        "PREHORARIO_INGENIERIA_EN_SISTEMAS_COMPUTACIONALES_2026-2.pdf",
      ],
      prehorarios: [
        "PREHORARIO_INGENIERIA_EN_SISTEMA_COMPUTACIONALES_2026-2.pdf",
        "PREHORARIO_INGENIERIA_EN_SISTEMAS_COMPUTACIONALES_2026-2.pdf",
      ],
      programaciones: [],
    };
    // SISTEMA (singular) solo aporta el distintivo COMPUTACIONALES (1); el
    // plural aporta SISTEMAS y COMPUTACIONALES (2). El singular es el más
    // reciente del orden del servidor, pero queda bajo el umbral y no gana.
    const elegido = elegirPrehorarioCarrera(resultado, CARRERA);
    expect(elegido.archivo).toBe(
      "PREHORARIO_INGENIERIA_EN_SISTEMAS_COMPUTACIONALES_2026-2.pdf",
    );
  });

  test("nunca elige un prehorario de otra carrera aunque sea el más reciente", () => {
    const resultado = {
      anioActual: 2026,
      cantidad: 3,
      archivos: [
        "PREHORARIO_INDUSTRIAL_2026-2.pdf",
        "PREHORARIO_INGENIERIA_ELECTRICA_2026-2.pdf",
        "PREHORARIO_INGENIERIA_EN_SISTEMAS_COMPUTACIONALES_2026-1.pdf",
      ],
      prehorarios: [
        "PREHORARIO_INDUSTRIAL_2026-2.pdf",
        "PREHORARIO_INGENIERIA_ELECTRICA_2026-2.pdf",
        "PREHORARIO_INGENIERIA_EN_SISTEMAS_COMPUTACIONALES_2026-1.pdf",
      ],
      programaciones: [],
    };
    // Industrial puntúa 0 y Eléctrica 1 (solo comparte INGENIERIA): ambos
    // quedan bajo el umbral aunque estén más recientes. Gana el de ISC.
    const elegido = elegirPrehorarioCarrera(resultado, CARRERA);
    expect(elegido.archivo).toBe(
      "PREHORARIO_INGENIERIA_EN_SISTEMAS_COMPUTACIONALES_2026-1.pdf",
    );
  });

  test("carrera corta: un reciente de 1 token no supera al de la misma carrera", () => {
    const resultado = {
      anioActual: 2026,
      cantidad: 2,
      archivos: [
        "PREHORARIO_INGENIERIA_ELECTRICA_2026-2.pdf",
        "PREHORARIO_INGENIERIA_EN_INDUSTRIAL_2026-2.pdf",
      ],
      prehorarios: [
        "PREHORARIO_INGENIERIA_ELECTRICA_2026-2.pdf",
        "PREHORARIO_INGENIERIA_EN_INDUSTRIAL_2026-2.pdf",
      ],
      programaciones: [],
    };
    // "ING. IND." normaliza al distintivo INDUSTRIAL. Eléctrica no aporta ese
    // token (0) y queda bajo el umbral aunque sea el más reciente.
    const elegido = elegirPrehorarioCarrera(resultado, "ING. IND.");
    expect(elegido.archivo).toBe(
      "PREHORARIO_INGENIERIA_EN_INDUSTRIAL_2026-2.pdf",
    );
  });

  test("ING. EN AERONÁUTICA no es vencido por el prehorario de ISC (inflación de EN/INGENIERIA)", () => {
    const resultado = {
      anioActual: 2026,
      cantidad: 2,
      archivos: [
        "PREHORARIO_INGENIERIA_EN_SISTEMAS_COMPUTACIONALES_2026-2.pdf",
        "PREHORARIO_AERONAUTICA_2026-2.pdf",
      ],
      prehorarios: [
        "PREHORARIO_AERONAUTICA_2026-2.pdf",
        "PREHORARIO_INGENIERIA_EN_SISTEMAS_COMPUTACIONALES_2026-2.pdf",
      ],
      programaciones: [],
    };
    // ISC comparte INGENIERIA y EN (genéricos, ya descartados) pero no
    // AERONAUTICA. Su puntaje debe quedarse en 0 y ganar el propio archivo.
    const elegido = elegirPrehorarioCarrera(resultado, "ING. EN AERONÁUTICA");
    expect(elegido.carreraNormalizada).toBe("AERONAUTICA");
    expect(elegido.archivo).toBe("PREHORARIO_AERONAUTICA_2026-2.pdf");
    expect(elegido.puntaje).toBe(1);
  });

  test("ING.INFORMATICA (sin espacio) parte el punto y encuentra su prehorario", () => {
    const resultado = {
      anioActual: 2026,
      cantidad: 2,
      archivos: [
        "PREHORARIO_INGENIERIA_EN_SISTEMAS_COMPUTACIONALES_2026-2.pdf",
        "PREHORARIO INGENIERIA_EN_INFORMATICA_2026-2.pdf",
      ],
      prehorarios: ["PREHORARIO INGENIERIA_EN_INFORMATICA_2026-2.pdf"],
      programaciones: [],
    };
    const elegido = elegirPrehorarioCarrera(resultado, "ING.INFORMATICA");
    expect(elegido.carreraNormalizada).toBe("INFORMATICA");
    expect(elegido.archivo).toBe("PREHORARIO INGENIERIA_EN_INFORMATICA_2026-2.pdf");
  });

  test("LIC. ADMINISTRACIÓN normaliza la abreviatura a LICENCIATURA (genérica)", () => {
    const resultado = {
      anioActual: 2026,
      cantidad: 1,
      archivos: ["PREHORARIO LICENCIATURA EN ADMINISTRACION.pdf"],
      prehorarios: ["PREHORARIO LICENCIATURA EN ADMINISTRACION.pdf"],
      programaciones: [],
    };
    const elegido = elegirPrehorarioCarrera(resultado, "LIC. ADMINISTRACIÓN");
    expect(elegido.carreraNormalizada).toBe("ADMINISTRACION");
    expect(elegido.archivo).toBe("PREHORARIO LICENCIATURA EN ADMINISTRACION.pdf");
  });
});

describe("compilación de tipos", () => {
  test("acepta strings no-tilde como tokens", () => {
    const elegido = elegirPrehorarioCarrera(
      {
        anioActual: 2026,
        cantidad: 1,
        archivos: ["PREHORARIO_INGENIERIA_EN_INFORMATICA_2026-2.pdf"],
        prehorarios: ["PREHORARIO_INGENIERIA_EN_INFORMATICA_2026-2.pdf"],
        programaciones: [],
      },
      "ING. EN INFORMÁTICA",
    );
    expect(elegido.archivo).toBe(
      "PREHORARIO_INGENIERIA_EN_INFORMATICA_2026-2.pdf",
    );
  });
});

const AHORA = new Date(2026, 8, 5, 12, 0); // 2026-09-05 12:00
const haceDias = (dias: number): Date => new Date(AHORA.getTime() - dias * 86_400_000);

describe("parseFechaModificacion", () => {
  test("interpreta la celda del listado de Apache como fecha local", () => {
    const fecha = parseFechaModificacion("2026-08-12 15:03  ");
    expect(fecha).toEqual(new Date(2026, 7, 12, 15, 3));
  });

  test("devuelve null si la celda no trae fecha", () => {
    expect(parseFechaModificacion("CAMBIOS   ")).toBeNull();
    expect(parseFechaModificacion("")).toBeNull();
  });
});

describe("urlDocumento", () => {
  test("construye el URL canónico", () => {
    expect(urlDocumento("CALENDARIO_ESCOLAR_2026-2 v2.pdf")).toBe(
      "/api/ith/documentos/CALENDARIO_ESCOLAR_2026-2%20v2.pdf",
    );
  });
});

describe("esCalendario / elegirCalendario", () => {
  const entrada = (archivo: string): ArchivoListado => ({
    archivo,
    modificado: new Date(2026, 8, 5, 15, 3),
  });

  test("esCalendario distingue el calendario de otros documentos", () => {
    expect(esCalendario("CALENDARIO_ESCOLAR_2026-2 V2.pdf")).toBe(true);
    expect(esCalendario("CALENDARIO_ESCOLAR_2026-2.pdf")).toBe(true);
    expect(esCalendario("PREHORARIO_INGENIERIA_EN_SISTEMAS_2026-2.pdf")).toBe(false);
    expect(esCalendario("PROGRAMACION_X_2026-2_alum.pdf")).toBe(false);
  });

  test("elegirCalendario toma el primero del orden del listado (más reciente primero)", () => {
    const elegido = elegirCalendario([
      entrada("PREHORARIO_INGENIERIA_EN_SISTEMAS_2026-2.pdf"),
      entrada("CALENDARIO_ESCOLAR_2026-2 V2.pdf"),
      entrada("OTRO_DOCUMENTO.pdf"),
    ]);
    expect(elegido?.archivo).toBe("CALENDARIO_ESCOLAR_2026-2 V2.pdf");
  });

  test("sin calendario en el listado devuelve null", () => {
    expect(
      elegirCalendario([
        entrada("PREHORARIO_INGENIERIA_EN_SISTEMAS_2026-2.pdf"),
        entrada("PROGRAMACION_X_2026-2_alum.pdf"),
      ]),
    ).toBeNull();
    expect(elegirCalendario([])).toBeNull();
  });

  test("elige el calendario aunque no sea el primer archivo del listado", () => {
    const elegido = elegirCalendario([
      { archivo: "PROGRAMACION_ISC_2026-2_alum.pdf", modificado: null },
      { archivo: "CALENDARIO_ESCOLAR_2027-1.pdf", modificado: null },
    ]);
    expect(elegido?.archivo).toBe("CALENDARIO_ESCOLAR_2027-1.pdf");
  });
});

describe("esFechaDentroVentana", () => {
  test("dentro de la ventana es true (límite inclusive)", () => {
    expect(esFechaDentroVentana(haceDias(7), AHORA, 7)).toBe(true);
    expect(esFechaDentroVentana(haceDias(1), AHORA, 7)).toBe(true);
  });

  test("antes de la ventana es false", () => {
    expect(esFechaDentroVentana(haceDias(8), AHORA, 7)).toBe(false);
  });

  test("fecha futura o ausente es false", () => {
    expect(esFechaDentroVentana(new Date(2026, 8, 6), AHORA, 7)).toBe(false);
    expect(esFechaDentroVentana(null, AHORA, 7)).toBe(false);
  });
});