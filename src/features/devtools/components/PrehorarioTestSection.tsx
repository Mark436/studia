import { useState } from "react";
import { Button } from "@/components/ui/Button";
import type { Alumno } from "@/lib/api/client";
import { getNow } from "@/lib/devtools/clock";
import {
  elegirPrehorarioCarrera,
  esFechaDentroVentana,
  obtenerCalendarioOficial,
  obtenerPrehorarios,
  urlPrehorario,
} from "@/lib/prehorario";
import { getMateriasPendientes } from "@/features/student/reticulaPendiente";
import { elegirProximaFechaLabores } from "@/lib/busquedaHorarios";
import {
  leerFechasInicioLabores,
  urlCalendarioPdf,
} from "@/lib/calendarioLabores";

const VENTANA_DIAS = 7;

interface PrehorarioTestSectionProps {
  alumno: Alumno | null;
}

function fechaLegible(fecha: Date | null): string {
  return fecha ? fecha.toLocaleString() : "sin fecha";
}

export function PrehorarioTestSection({ alumno }: PrehorarioTestSectionProps) {
  const [corriendo, setCorriendo] = useState<"prehorario" | "calendario" | null>(
    null,
  );
  const [lineas, setLineas] = useState<string[]>([]);

  function emit(texto: string) {
    console.log(texto);
    setLineas(prev => [...prev, texto]);
  }

  async function ejecutarPrehorario() {
    if (!alumno) return;

    setCorriendo("prehorario");
    setLineas([]);
    try {
      const reticula = alumno.reticula ?? [];
      if (reticula.length === 0) {
        emit(
          "[reticula] El alumno no trae retícula: actualiza los datos (pull-to-refresh o el botón Actualizar) o vuelve a iniciar sesión.",
        );
      }
      const pendientes = getMateriasPendientes(reticula);
      emit(
        `[reticula] ${pendientes.length} materias por cursar de ${reticula.length}:`,
      );
      for (const materia of pendientes) {
        emit(
          `  ${materia.codigoEstado}/${materia.estado} ${materia.clave} — ${materia.nombre} (sem ${materia.coordenadas.y})`,
        );
      }

      const prehorarios = await obtenerPrehorarios();
      const ahora = getNow();
      const elegido = elegirPrehorarioCarrera(prehorarios, alumno.carrera);
      const modificados = prehorarios.modificados ?? {};
      emit(`[prehorario] reloj (getNow): ${ahora.toLocaleString()}`);
      emit(`[prehorario] carrera: ${alumno.carrera}`);
      emit(`[prehorario] normalizada: ${elegido.carreraNormalizada}`);
      emit(`[prehorario] candidatos (${elegido.candidatos.length}):`);
      for (const candidato of elegido.candidatos) {
        const modificado = modificados[candidato.archivo] ?? null;
        const reciente = esFechaDentroVentana(modificado, ahora, VENTANA_DIAS);
        emit(
          `  puntaje ${candidato.puntaje} | prehorario ${candidato.esPrehorario ? "sí" : "no"} | reciente ${reciente ? "sí" : "no"}`,
        );
        emit(`    ${candidato.archivo}`);
        if (candidato.esPrehorario) {
          emit(`    modificado: ${fechaLegible(modificado)}`);
          emit(`    url: ${urlPrehorario(candidato.archivo)}`);
        }
      }
      emit(`[prehorario] elegido: ${elegido.archivo ?? "(ninguno)"}`);
      if (elegido.archivo) {
        emit(
          `[prehorario] modificado: ${fechaLegible(modificados[elegido.archivo] ?? null)}`,
        );
        emit(`[prehorario] url: ${urlPrehorario(elegido.archivo)}`);
      }
    } catch (error) {
      console.error("[prehorario] error:", error);
      emit(
        `[prehorario] error: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      setCorriendo(null);
    }
  }

  async function ejecutarCalendario() {
    setCorriendo("calendario");
    setLineas([]);
    try {
      const ahora = getNow();
      const oficial = await obtenerCalendarioOficial();
      emit(`[calendario] reloj (getNow): ${ahora.toLocaleString()}`);
      if (oficial) {
        emit(`[calendario] oficial: ${oficial.archivo}`);
        emit(`[calendario] oficial url: ${oficial.url}`);
        try {
          const lectura = await leerFechasInicioLabores(
            urlCalendarioPdf(oficial.archivo),
          );
          if (lectura.fechas.length > 0) {
            emit(`[calendario] inicio de labores (${lectura.fechas.length}):`);
            for (const fecha of lectura.fechas) {
              emit(`  ${fecha.toLocaleDateString()}`);
            }
            const proxima = elegirProximaFechaLabores(lectura.fechas, ahora);
            emit(
              proxima
                ? `[calendario] próxima (futura): ${proxima.toLocaleDateString()}`
                : "[calendario] próxima (futura): ninguna (todas pasadas)",
            );
          } else {
            emit(
              "[calendario] no se encontró «inicio de labores» en el PDF oficial.",
            );
          }
        } catch (error) {
          console.error("[calendario] error al leer el PDF:", error);
          emit(
            `[calendario] error al leer el PDF: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      } else {
        emit(
          "[calendario] oficial: no se encontró el PDF en calendario-escolar.html",
        );
      }
    } catch (error) {
      console.error("[calendario] error:", error);
      emit(
        `[calendario] error: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      setCorriendo(null);
    }
  }

  return (
    <section className="flex flex-col gap-3">
      <h4 className="text-sm font-semibold text-on-surface">
        Prueba retícula + prehorario
      </h4>
      <p className="text-xs text-on-surface-variant">
        Calcula las materias por cursar y busca el prehorario de la carrera. La
        etiqueta «reciente» evalúa la fecha contra el reloj del modo dev
        (ventana de {VENTANA_DIAS} días). El resultado se muestra aquí abajo.
      </p>
      <Button
        variant="secondary"
        onClick={ejecutarPrehorario}
        disabled={!alumno || corriendo !== null}
        className="w-full"
      >
        {corriendo === "prehorario" ? "Buscando…" : "Probar retícula + prehorario"}
      </Button>

      <h4 className="mt-2 text-sm font-semibold text-on-surface">
        Prueba calendario
      </h4>
      <p className="text-xs text-on-surface-variant">
        Extrae el PDF vigente de la página oficial
        ith.mx/calendario-escolar.html y lee sus fechas de inicio de labores. El
        resultado se muestra aquí abajo.
      </p>
      <Button
        variant="secondary"
        onClick={ejecutarCalendario}
        disabled={corriendo !== null}
        className="w-full"
      >
        {corriendo === "calendario" ? "Buscando…" : "Probar calendario"}
      </Button>

      {lineas.length > 0 ? (
        <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-surface p-3 font-mono text-[11px] leading-relaxed text-on-surface ring-1 ring-outline-variant">
          {lineas.join("\n")}
        </pre>
      ) : null}
    </section>
  );
}