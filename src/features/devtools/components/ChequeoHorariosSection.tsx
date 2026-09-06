import { useState } from "react";
import { Button } from "@/components/ui/Button";
import type { Alumno } from "@/lib/api/client";
import {
  CONFIG_CHEQUEO_HORARIOS,
  decidirFase,
  elegirProximaFechaLabores,
  estadoChequeoVacio,
  HORAS_ENTRE_CHEQUEOS,
  parseEstadoChequeo,
  serializarEstadoChequeo,
  tocaChequear,
} from "@/lib/busquedaHorarios";
import type { EstadoChequeoHorarios } from "@/lib/busquedaHorarios";
import { getNow } from "@/lib/devtools/clock";
import {
  leerFechasInicioLabores,
  urlCalendarioPdf,
} from "@/lib/calendarioLabores";
import {
  elegirPrehorarioCarrera,
  obtenerCalendarioOficial,
  obtenerPrehorarios,
  urlPrehorario,
} from "@/lib/prehorario";
import {
  getSetting,
  setSetting,
  SETTING_HORARIOS_CHECKS_STATE,
} from "@/lib/storage/settingsStore";

interface ChequeoHorariosSectionProps {
  alumno: Alumno | null;
}

function fechaLegible(fecha: Date | null): string {
  return fecha ? fecha.toLocaleString() : "—";
}

export function ChequeoHorariosSection({
  alumno,
}: ChequeoHorariosSectionProps) {
  const [corriendo, setCorriendo] = useState(false);
  const [laboresInput, setLaboresInput] = useState("");
  const [lineas, setLineas] = useState<string[]>([]);

  function emit(texto: string) {
    console.log(texto);
    setLineas(prev => [...prev, texto]);
  }

  async function cargarEstado(): Promise<EstadoChequeoHorarios> {
    return parseEstadoChequeo(await getSetting(SETTING_HORARIOS_CHECKS_STATE));
  }

  async function persistir(estado: EstadoChequeoHorarios): Promise<void> {
    await setSetting(
      SETTING_HORARIOS_CHECKS_STATE,
      serializarEstadoChequeo(estado),
    );
  }

  async function validarFecha() {
    setCorriendo(true);
    setLineas([]);
    try {
      const estado = await cargarEstado();
      const ahora = getNow();
      const toca = tocaChequear(estado.ultimoChequeo, ahora);
      const resultado = decidirFase(estado, ahora, CONFIG_CHEQUEO_HORARIOS);

      emit(`[chequeo] reloj (getNow): ${ahora.toLocaleString()}`);
      emit(`[chequeo] último chequeo: ${fechaLegible(estado.ultimoChequeo)}`);
      if (estado.ultimoChequeo) {
        const horas = Math.floor(
          (ahora.getTime() - estado.ultimoChequeo.getTime()) / 3_600_000,
        );
        emit(`[chequeo] horas desde el último chequeo: ${horas}h`);
      }
      emit(
        `[chequeo] toca chequear (${HORAS_ENTRE_CHEQUEOS}h): ${toca ? "sí" : "no"}`,
      );
      emit(`[chequeo] fase: ${resultado.fase}`);
      emit(`[chequeo] motivo: ${resultado.descripcion}`);
      emit(
        `[chequeo] estado: calendarioVisto "${estado.calendarioVisto ?? "—"}" | labores ${fechaLegible(estado.fechaInicioLabores)} | prehorarioVisto "${estado.prehorarioVisto ?? "—"}"`,
      );

      if (!toca) {
        emit("[chequeo] hay que esperar; no se ejecuta ninguna búsqueda.");
        return;
      }

      await persistir({ ...estado, ultimoChequeo: ahora });

      if (!resultado.tocaAccion) return;

      switch (resultado.fase) {
        case "buscar-calendario": {
          const oficial = await obtenerCalendarioOficial();
          if (oficial && oficial.archivo !== estado.calendarioVisto) {
            emit(`[chequeo] ¡nuevo calendario oficial! ${oficial.archivo}`);
            emit(`[chequeo] url: ${oficial.url}`);
            await persistir({
              ...estado,
              ultimoChequeo: ahora,
              calendarioVisto: oficial.archivo,
            });
          } else {
            emit(
              `[chequeo] calendario oficial sin cambios: ${oficial?.archivo ?? "(no se encontró)"}`,
            );
          }
          break;
        }
        case "buscar-prehorario": {
          if (!alumno) {
            emit(
              "[chequeo] sin alumno: no se puede buscar el prehorario. Inicia sesión y vuelve a intentar.",
            );
            break;
          }
          const prehorarios = await obtenerPrehorarios();
          const elegido = elegirPrehorarioCarrera(prehorarios, alumno.carrera);
          if (elegido.archivo && elegido.archivo !== estado.prehorarioVisto) {
            emit(`[chequeo] ¡prehorario encontrado! ${elegido.archivo}`);
            emit(`[chequeo] url: ${urlPrehorario(elegido.archivo)}`);
            await persistir({
              ...estado,
              ultimoChequeo: ahora,
              prehorarioVisto: elegido.archivo,
            });
          } else {
            emit(
              `[chequeo] prehorario: aún no aparece (${elegido.archivo ?? "ninguno"})`,
            );
          }
          break;
        }
        case "procesar-calendario": {
          if (!estado.calendarioVisto) break;
          const lectura = await leerFechasInicioLabores(
            urlCalendarioPdf(estado.calendarioVisto),
          );
          if (lectura.fechas.length === 0) {
            emit(
              "[chequeo] no se encontró «inicio de labores» en el PDF oficial.",
            );
            break;
          }
          const proxima = elegirProximaFechaLabores(lectura.fechas, ahora);
          if (!proxima) {
            emit(
              "[chequeo] sin fecha futura de inicio de labores (todas pasadas).",
            );
            break;
          }
          emit(
            `[chequeo] próxima inicio de labores: ${proxima.toLocaleDateString()}`,
          );
          emit(
            `[chequeo] fase siguiente: esperar-labores (buscar prehorario desde el día siguiente).`,
          );
          await persistir({
            ...estado,
            ultimoChequeo: ahora,
            fechaInicioLabores: proxima,
          });
          break;
        }
      }
    } catch (error) {
      console.error("[chequeo] error:", error);
      emit(
        `[chequeo] error: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      setCorriendo(false);
    }
  }

  async function fijarInicioLabores() {
    if (!laboresInput) return;
    setCorriendo(true);
    setLineas([]);
    try {
      const estado = await cargarEstado();
      const fecha = new Date(`${laboresInput}T00:00:00`);
      await persistir({ ...estado, fechaInicioLabores: fecha, prehorarioVisto: null });
      const ahora = getNow();
      const fase = decidirFase(
        { ...estado, fechaInicioLabores: fecha },
        ahora,
        CONFIG_CHEQUEO_HORARIOS,
      ).fase;
      emit(`[chequeo] inicio de labores fijado: ${fecha.toLocaleString()}`);
      emit(`[chequeo] fase actual: ${fase}`);
      emit(
        `[chequeo] reintenta «Validar fecha (+24h)» para ver la fase ${fase} con el reloj de hoy.`,
      );
    } catch (error) {
      console.error("[chequeo] error:", error);
      emit(
        `[chequeo] error: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      setCorriendo(false);
    }
  }

  async function reiniciarChequeo() {
    setCorriendo(true);
    setLineas([]);
    try {
      await setSetting(
        SETTING_HORARIOS_CHECKS_STATE,
        serializarEstadoChequeo(estadoChequeoVacio()),
      );
      emit("[chequeo] estado reiniciado. Pruébalo de nuevo con «Validar fecha (+24h)».");
    } catch (error) {
      console.error("[chequeo] error:", error);
      emit(
        `[chequeo] error: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      setCorriendo(false);
    }
  }

  return (
    <section className="flex flex-col gap-3">
      <h4 className="text-sm font-semibold text-on-surface">
        Chequeo diario (búsqueda de calendario/prehorario)
      </h4>
      <p className="text-xs text-on-surface-variant">
        Simula el evento de haber pasado 24 horas y valida si ya toca buscar el
        calendario o el prehorario, según el reloj del modo dev. El chequeo
        avanza aunque la sesión esté desactualizada. El resultado se muestra
        aquí abajo.
      </p>
      <Button
        variant="secondary"
        onClick={validarFecha}
        disabled={corriendo}
        className="w-full"
      >
        {corriendo ? "Validando…" : "Validar fecha (+24h)"}
      </Button>

      <div className="flex flex-col gap-2">
        <label className="text-xs text-on-surface-variant" htmlFor="labores-dev">
          Inicio de labores (simulación, para probar la fase):
        </label>
        <div className="flex gap-2">
          <input
            id="labores-dev"
            type="date"
            value={laboresInput}
            onChange={event => setLaboresInput(event.target.value)}
            className="min-w-0 flex-1 rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface"
          />
          <Button
            variant="secondary"
            onClick={fijarInicioLabores}
            disabled={corriendo || !laboresInput}
          >
            Fijar
          </Button>
        </div>
      </div>

      <Button variant="ghost" onClick={reiniciarChequeo} disabled={corriendo}>
        Reiniciar estado de chequeo
      </Button>

      {lineas.length > 0 ? (
        <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-surface p-3 font-mono text-[11px] leading-relaxed text-on-surface ring-1 ring-outline-variant">
          {lineas.join("\n")}
        </pre>
      ) : null}
    </section>
  );
}