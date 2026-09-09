import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import type { Alumno } from "@/lib/api/client";
import { getMateriasDisponibles } from "@/features/student/reticulaPendiente";
import { calcularSugerenciaHorario } from "@/lib/sugerirHorario";
import {
  obtenerCalendarioOficial,
  obtenerPrehorarios,
  elegirPrehorarioCarrera,
} from "@/lib/prehorario";
import { leerFechasInicioLabores } from "@/lib/calendarioLabores";
import { leerRenglonesPDF, urlDocumentoPdf } from "@/lib/pdfTexto";
import { procesarPrehorarioTexto } from "@/lib/prehorarioTablas";

type PasoEstado = "idle" | "running" | "success" | "error";

interface PasoResultado<T = unknown> {
  estado: PasoEstado;
  datos: T | null;
  error: string | null;
  duracionMs: number;
}

interface PruebaCompletaState {
  calendarioOficial: PasoResultado<{ archivo: string; url: string }>;
  fechasCalendario: PasoResultado<{ inicioLabores: Date[]; publicacionPrehorarios: Date[]; texto: string }>;
  prehorariosListing: PasoResultado<{ anioActual: number | null; prehorarios: string[]; programaciones: string[] }>;
  prehorarioCarrera: PasoResultado<{ archivo: string | null; puntaje: number; candidatos: Array<{ archivo: string; puntaje: number; esPrehorario: boolean }> }>;
  prehorarioPDF: PasoResultado<{ semestres: number; materias: number; grupos: number }>;
  sugerenciaHorario: PasoResultado<{
    materias: Array<{ clave: string; nombre: string; grupo: string; maestro: string | null; horario: Record<string, string[]> }>;
    excluidas: Array<{ clave: string; nombre: string; razon: string }>;
    huecosMinutos: number;
  }>;
}

const PASOS_INICIALES: PruebaCompletaState = {
  calendarioOficial: { estado: "idle", datos: null, error: null, duracionMs: 0 },
  fechasCalendario: { estado: "idle", datos: null, error: null, duracionMs: 0 },
  prehorariosListing: { estado: "idle", datos: null, error: null, duracionMs: 0 },
  prehorarioCarrera: { estado: "idle", datos: null, error: null, duracionMs: 0 },
  prehorarioPDF: { estado: "idle", datos: null, error: null, duracionMs: 0 },
  sugerenciaHorario: { estado: "idle", datos: null, error: null, duracionMs: 0 },
};

export function PruebaCompletaSection({
  alumno,
}: {
  alumno: Alumno | null;
}) {
  const [state, setState] = useState<PruebaCompletaState>(PASOS_INICIALES);
  const [corriendo, setCorriendo] = useState(false);

  function actualizarPaso<K extends keyof PruebaCompletaState>(
    paso: K,
    actualizacion: Partial<PruebaCompletaState[K]>,
  ) {
    setState((prev) => ({
      ...prev,
      [paso]: { ...prev[paso], ...actualizacion },
    }));
  }

  async function ejecutarPruebaCompleta() {
    if (!alumno) {
      alert("No hay datos de alumno. Inicia sesión primero.");
      return;
    }

    setCorriendo(true);
    setState(PASOS_INICIALES);

    // PASO 1: Calendario oficial
    actualizarPaso("calendarioOficial", { estado: "running" });
    const t1 = performance.now();
    try {
      const oficial = await obtenerCalendarioOficial();
      actualizarPaso("calendarioOficial", {
        estado: oficial ? "success" : "error",
        datos: oficial ?? null,
        error: oficial ? null : "No se pudo obtener el calendario oficial",
        duracionMs: performance.now() - t1,
      });

      if (!oficial) throw new Error("Sin calendario oficial");

      // PASO 2: Fechas del calendario (PDF)
      actualizarPaso("fechasCalendario", { estado: "running" });
      const t2 = performance.now();
      const lectura = await leerFechasInicioLabores(urlDocumentoPdf(oficial.archivo));
      actualizarPaso("fechasCalendario", {
        estado: "success",
        datos: {
          inicioLabores: lectura.fechas,
          publicacionPrehorarios: lectura.publicacionPrehorarios,
          texto: lectura.texto.substring(0, 500) + (lectura.texto.length > 500 ? "…" : ""),
        },
        duracionMs: performance.now() - t2,
      });

      // PASO 3: Listado de prehorarios
      actualizarPaso("prehorariosListing", { estado: "running" });
      const t3 = performance.now();
      const listing = await obtenerPrehorarios();
      actualizarPaso("prehorariosListing", {
        estado: "success",
        datos: {
          anioActual: listing.anioActual,
          prehorarios: listing.prehorarios,
          programaciones: listing.programaciones,
        },
        duracionMs: performance.now() - t3,
      });

      // PASO 4: Elegir prehorario de la carrera
      actualizarPaso("prehorarioCarrera", { estado: "running" });
      const t4 = performance.now();
      const elegido = elegirPrehorarioCarrera(listing, alumno.carrera);
      actualizarPaso("prehorarioCarrera", {
        estado: elegido.archivo ? "success" : "error",
        datos: {
          archivo: elegido.archivo,
          puntaje: elegido.puntaje,
          candidatos: elegido.candidatos.filter((c) => c.puntaje > 0).slice(0, 10),
        },
        error: elegido.archivo ? null : "No se encontró prehorario para esta carrera",
        duracionMs: performance.now() - t4,
      });

      if (!elegido.archivo) throw new Error("Sin prehorario de la carrera");

      // PASO 5: Leer y parsear PDF del prehorario
      actualizarPaso("prehorarioPDF", { estado: "running" });
      const t5 = performance.now();
      const paginas = await leerRenglonesPDF(urlDocumentoPdf(elegido.archivo));
      const prehorarioJson = procesarPrehorarioTexto(paginas);
      const semestres = Object.keys(prehorarioJson).length;
      const materias = Object.values(prehorarioJson).reduce((acc, s) => acc + s.materias.length, 0);
      const grupos = Object.values(prehorarioJson).reduce((acc, s) =>
        acc + s.materias.reduce((a, m) => a + m.grupos.length, 0), 0);
      actualizarPaso("prehorarioPDF", {
        estado: "success",
        datos: { semestres, materias, grupos },
        duracionMs: performance.now() - t5,
      });

      // PASO 6: Sugerencia de horario
      actualizarPaso("sugerenciaHorario", { estado: "running" });
      const t6 = performance.now();
      const disponibles = getMateriasDisponibles(alumno.reticula);
      const sugerencia = calcularSugerenciaHorario(disponibles, prehorarioJson);
      actualizarPaso("sugerenciaHorario", {
        estado: "success",
        datos: {
          materias: sugerencia.materias.map((m) => ({
            clave: m.clave,
            nombre: m.nombre,
            grupo: m.grupo.grupo,
            maestro: m.grupo.maestro,
            horario: m.grupo.horario,
          })),
          excluidas: sugerencia.excluidas.map((e) => ({
            clave: e.clave,
            nombre: e.nombre,
            razon: e.razon,
          })),
          huecosMinutos: sugerencia.huecosMinutos,
        },
        duracionMs: performance.now() - t6,
      });

    } catch (error) {
      console.error("[PruebaCompleta] Error:", error);
      // Marcar el paso actual como error si no lo está ya
      const pasoActual = Object.entries(state).find(([_, v]) => v.estado === "running");
      if (pasoActual) {
        actualizarPaso(pasoActual[0] as keyof PruebaCompletaState, {
          estado: "error",
          error: error instanceof Error ? error.message : "Error desconocido",
        });
      }
    } finally {
      setCorriendo(false);
    }
  }

  async function reintentarCalendarioSinProxy() {
    setCorriendo(true);
    actualizarPaso("calendarioOficial", { estado: "running", error: null });
    const t1 = performance.now();
    try {
      const oficial = await obtenerCalendarioOficial(true);
      actualizarPaso("calendarioOficial", {
        estado: oficial ? "success" : "error",
        datos: oficial ?? null,
        error: oficial ? null : "No se pudo obtener el calendario oficial",
        duracionMs: performance.now() - t1,
      });
    } catch (error) {
      actualizarPaso("calendarioOficial", {
        estado: "error",
        error: error instanceof Error ? error.message : "Error desconocido",
        duracionMs: performance.now() - t1,
      });
    } finally {
      setCorriendo(false);
    }
  }

  function formatearHorario(horario: Record<string, string[]>): string {
    const dias = ["lunes", "martes", "miercoles", "jueves", "viernes"] as const;
    return dias
      .map((dia) => {
        const bloques = horario[dia];
        return bloques.length > 0 ? `${dia[0].toUpperCase()}: ${bloques.join(", ")}` : null;
      })
      .filter(Boolean)
      .join(" | ");
  }

  function renderPaso<T>(
    titulo: string,
    paso: PasoResultado<T>,
    renderDetalle?: (datos: T) => React.ReactNode,
    acciones?: React.ReactNode,
  ) {
    const iconos = {
      idle: "⏳",
      running: "⏳",
      success: "✅",
      error: "❌",
    };
    const colores = {
      idle: "text-on-surface-variant",
      running: "text-primary-strong",
      success: "text-green-700",
      error: "text-error",
    };

    return (
      <div className="flex flex-col gap-2 border-l-2 pl-3 border-outline-variant">
        <div className="flex items-center gap-2">
          <span className={colores[paso.estado]}>{iconos[paso.estado]}</span>
          <strong className="text-sm text-on-surface">{titulo}</strong>
          <span className="text-xs text-on-surface-variant">
            ({paso.duracionMs.toFixed(0)} ms)
          </span>
        </div>
        {paso.error && (
          <p className="text-sm text-error ml-5">{paso.error}</p>
        )}
        {paso.estado === "error" && acciones}
        {paso.datos && renderDetalle && (
          <div className="ml-5 text-xs text-on-surface-variant font-mono whitespace-pre-wrap">
            {renderDetalle(paso.datos)}
          </div>
        )}
      </div>
    );
  }

  return (
    <section className="flex flex-col gap-3">
      <h4 className="text-sm font-semibold text-on-surface">Prueba completa del pipeline</h4>
      <p className="text-xs text-on-surface-variant">
        Ejecuta: calendario oficial → fechas PDF → listado prehorarios → carrera → PDF prehorario → sugerencia horario
      </p>
      <Button
        variant={corriendo ? "secondary" : "primary"}
        onClick={ejecutarPruebaCompleta}
        disabled={corriendo}
        className="w-full"
      >
        {corriendo ? "Ejecutando…" : "Ejecutar prueba completa"}
      </Button>

      <Card className="flex flex-col gap-4 text-xs">
        {renderPaso(
          "1. Calendario oficial",
          state.calendarioOficial,
          (d) => `Archivo: ${d.archivo}\nURL: ${d.url}`,
          state.calendarioOficial.estado === "error" ? (
            <Button
              variant="secondary"
              onClick={reintentarCalendarioSinProxy}
              disabled={corriendo}
              className="ml-5 w-fit"
            >
              Reintentar sin proxy
            </Button>
          ) : undefined,
        )}
        {renderPaso(
          "2. Fechas del calendario (PDF)",
          state.fechasCalendario,
          (d) =>
            `Inicio labores: ${d.inicioLabores.map((f) => f.toISOString().split("T")[0]).join(", ") || "—"}\n` +
            `Publicación prehorarios (act. 5): ${d.publicacionPrehorarios.map((f) => f.toISOString().split("T")[0]).join(", ") || "—"}`,
        )}
        {renderPaso(
          "3. Listado prehorarios",
          state.prehorariosListing,
          (d) =>
            `Año: ${d.anioActual ?? "—"}\n` +
            `Prehorarios: ${d.prehorarios.length} (${d.prehorarios.join(", ") || "—"})\n` +
            `Programaciones: ${d.programaciones.length}`,
        )}
        {renderPaso(
          "4. Prehorario de la carrera",
          state.prehorarioCarrera,
          (d) =>
            d.archivo
              ? `✅ Ganador: ${d.archivo} (puntaje ${d.puntaje})\n` +
                `Candidatos:\n${d.candidatos.map((c) => `  ${c.esPrehorario ? "📅" : "📋"} ${c.archivo} (${c.puntaje})`).join("\n")}`
              : "No encontrado",
        )}
        {renderPaso(
          "5. PDF prehorario parseado",
          state.prehorarioPDF,
          (d) => `${d.semestres} semestres, ${d.materias} materias, ${d.grupos} grupos`,
        )}
        {renderPaso(
          "6. Sugerencia de horario (menos huecos)",
          state.sugerenciaHorario,
          (d) =>
            d.materias.length > 0
              ? `✅ ${d.materias.length} materias cubiertas (${d.huecosMinutos} min huecos)\n\n` +
                d.materias
                  .map(
                    (m) =>
                      `${m.clave} ${m.nombre}\n` +
                      `  Grupo: ${m.grupo} | Prof: ${m.maestro ?? "—"}\n` +
                      `  Horario: ${formatearHorario(m.horario)}`,
                  )
                  .join("\n\n") +
                (d.excluidas.length > 0
                  ? `\n\n❌ Excluidas (${d.excluidas.length}):\n` +
                    d.excluidas.map((e) => `  ${e.clave} ${e.nombre} — ${e.razon}`).join("\n")
                  : "")
              : "Sin materias disponibles",
        )}
      </Card>
    </section>
  );
}