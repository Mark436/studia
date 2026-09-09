import { useCallback, useEffect, useRef } from "react";
import type { Alumno } from "@/lib/api/client";
import {
  CONFIG_CHEQUEO_HORARIOS,
  decidirFase,
  esHoraChequeo,
  estadoTrasAplicarCalendario,
  parseEstadoChequeo,
  pasoTiempoBusquedaCalendario,
  proximoMomentoChequeo,
  serializarEstadoChequeo,
  tocaAvisarTurnosReinscripcion,
} from "@/lib/busquedaHorarios";
import type { EstadoChequeoHorarios } from "@/lib/busquedaHorarios";
import { getNow } from "@/lib/devtools/clock";
import { obtenerDatosCalendario } from "@/lib/datosCalendario";
import { leerFechasInicioLabores } from "@/lib/calendarioLabores";
import { urlDocumentoPdf } from "@/lib/pdfTexto";
import {
  elegirCalendario,
  elegirPrehorarioCarrera,
  obtenerPrehorarios,
} from "@/lib/prehorario";
import {
  getSetting,
  setSetting,
  SETTING_HORARIOS_CHECKS_STATE,
} from "@/lib/storage/settingsStore";
import {
  PREHORARIO_DISPONIBLE_TOAST,
  TURNOS_REINSCRIPCION_TOAST,
} from "@/lib/toastMessages";

export interface HorariosCheckResult {
  fase:
    | "idle"
    | "buscar-calendario"
    | "procesar-calendario"
    | "buscar-prehorario"
    | "turnos-reinscripcion";
  mensaje: string | null;
}

async function cargarEstado(): Promise<EstadoChequeoHorarios> {
  return parseEstadoChequeo(await getSetting(SETTING_HORARIOS_CHECKS_STATE));
}

async function persistir(estado: EstadoChequeoHorarios): Promise<void> {
  await setSetting(SETTING_HORARIOS_CHECKS_STATE, serializarEstadoChequeo(estado));
}

/**
 * Ejecuta el chequeo diario de búsqueda de calendario/prehorario.
 *
 * Anclado a las 18:00 (hora en la que el instituto ya sube los documentos), NO
 * contabiliza si «ya se chequeó»: cada vez que corre (app activa siendo 18:00
 * o después) vuelve a evaluar y solo actúa cuando toca. Dentro de las
 * vacaciones de fin de clases se busca el calendario del siguiente ciclo en el
 * listado, a lo sumo cada 7 días (cadencia `pasoTiempoBusquedaCalendario`).
 * Sin conexión no busca ni persiste nada; reactiva al recuperar la red. Usa
 * getNow() (el reloj del modo dev) para que las fechas se prueben con la hora
 * simulada.
 */
export async function ejecutarChequeoHorarios(
  alumno: Alumno | null,
  onResult?: (result: HorariosCheckResult) => void,
): Promise<void> {
  // Guard offline: sin conexión no se busca ni se persiste nada; el listener
  // "online" vuelve a disparar el chequeo al recuperar la red.
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    onResult?.({ fase: "idle", mensaje: null });
    return;
  }

  try {
    const estado = await cargarEstado();
    const ahora = getNow();

    if (!esHoraChequeo(ahora)) {
      onResult?.({ fase: "idle", mensaje: null });
      return;
    }

    // Si faltan las fechas del calendario (instalación nueva o estado viejo sin
    // fin de clases), se obtienen on-demand: sin ellas el chequeo no puede saber
    // cuándo hay vacaciones. Si falla, se reintenta en la próxima corrida.
    if (estado.fechaFinDeClases === null || estado.fechaInicioLabores === null) {
      try {
        await obtenerDatosCalendario();
      } catch (error) {
        console.error(
          "[horarios] error al obtener los datos del calendario:",
          error,
        );
      }
    }

    const resultado = decidirFase(estado, ahora, CONFIG_CHEQUEO_HORARIOS);

    // Turno de reinscripción: la fecha de orden de reinscripción + prehorarios
    // (actividad 5) ya es hoy o pasó → avisar una sola vez.
    if (tocaAvisarTurnosReinscripcion(estado, ahora)) {
      await persistir({ ...estado, avisoTurnosEnviado: true });
      onResult?.({
        fase: "turnos-reinscripcion",
        mensaje: TURNOS_REINSCRIPCION_TOAST,
      });
    }

    if (!resultado.tocaAccion) {
      onResult?.({ fase: "idle", mensaje: null });
      return;
    }

    switch (resultado.fase) {
      case "buscar-calendario": {
        // Cadencia: durante las vacaciones el listado se consulta a lo sumo
        // cada 7 días.
        if (!pasoTiempoBusquedaCalendario(estado, ahora, CONFIG_CHEQUEO_HORARIOS)) {
          onResult?.({ fase: "idle", mensaje: null });
          break;
        }

        const ultimaBusqueda = ahora.toISOString();
        let detectado: string | null = null;

        try {
          const listado = await obtenerPrehorarios();
          const elegido = elegirCalendario(listado.todos ?? []);
          if (elegido !== null && elegido.archivo !== estado.calendarioProcesado) {
            detectado = elegido.archivo;
          }
        } catch (error) {
          console.error(
            "[horarios] error al buscar el calendario en el listado:",
            error,
          );
        }

        // Detección silenciosa (decisión del dueño, 2026-09-08): no se anuncia
        // toast; las fechas se aplican en la corrida siguiente con
        // «procesar-calendario».
        await persistir({
          ...estado,
          calendarioVisto: detectado ?? estado.calendarioVisto,
          ultimaBusquedaCalendario: ultimaBusqueda,
        });
        onResult?.({ fase: "buscar-calendario", mensaje: null });
        break;
      }
      case "procesar-calendario": {
        if (!estado.calendarioVisto) break;
        const lectura = await leerFechasInicioLabores(
          urlDocumentoPdf(estado.calendarioVisto),
        );
        if (
          lectura.fechas.length === 0 &&
          lectura.publicacionPrehorarios.length === 0
        ) {
          break;
        }
        await persistir(
          estadoTrasAplicarCalendario(
            estado,
            lectura,
            estado.calendarioVisto,
            ahora,
          ),
        );
        onResult?.({ fase: "procesar-calendario", mensaje: null });
        break;
      }
      case "buscar-prehorario": {
        if (!alumno) {
          onResult?.({
            fase: "buscar-prehorario",
            mensaje:
              "No se pudo buscar el prehorario porque faltan tus datos académicos: actualiza la información.",
          });
          break;
        }
        const prehorarios = await obtenerPrehorarios();
        const elegido = elegirPrehorarioCarrera(prehorarios, alumno.carrera);
        if (elegido.archivo && elegido.archivo !== estado.prehorarioVisto) {
          await persistir({
            ...estado,
            prehorarioVisto: elegido.archivo,
          });
          onResult?.({
            fase: "buscar-prehorario",
            mensaje: PREHORARIO_DISPONIBLE_TOAST,
          });
        }
        break;
      }
    }
  } catch (error) {
    console.error("[horarios] error en el chequeo diario:", error);
  }
}

/**
 * Hook de integración: dispara el chequeo diario al montar, al volver al
 * primer plano (visibilitychange / pageshow / focus) y al recuperar la
 * conexión (online). Además mantiene un timer que re-agenda el próximo
 * chequeo a las 18:00, de modo que el bucle sigue vivo mientras la app está
 * abierta sin depender de que haya eventos de foreground.
 */
export function useHorariosCheck(
  alumno: Alumno | null,
  onResult?: (result: HorariosCheckResult) => void,
): void {
  const callbackRef = useRef(onResult);
  callbackRef.current = onResult;

  const runOnceRef = useRef(false);

  const disparar = useCallback(() => {
    void ejecutarChequeoHorarios(alumno, result =>
      callbackRef.current?.(result),
    );
  }, [alumno]);

  useEffect(() => {
    if (runOnceRef.current) return;
    runOnceRef.current = true;
    disparar();
  }, [disparar]);

  useEffect(() => {
    let timer: number | undefined;

    function scheduleNext(): void {
      if (timer !== undefined) window.clearTimeout(timer);
      const ahora = getNow();
      const delay = Math.max(
        1000,
        proximoMomentoChequeo(ahora).getTime() - ahora.getTime(),
      );
      timer = window.setTimeout(() => {
        timer = undefined;
        disparar();
        scheduleNext();
      }, delay);
    }

    let lastResyncAt = 0;
    const COOLDOWN_MS = 500;

    function handleForeground(): void {
      if (document.hidden) return;
      const nowMs = performance.now();
      if (nowMs - lastResyncAt < COOLDOWN_MS) return;
      lastResyncAt = nowMs;
      scheduleNext();
      disparar();
    }

    function handleVisibilityChange(): void {
      if (!document.hidden) handleForeground();
    }

    scheduleNext();

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pageshow", handleForeground);
    window.addEventListener("focus", handleForeground);
    window.addEventListener("online", handleForeground);

    return () => {
      if (timer !== undefined) window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pageshow", handleForeground);
      window.removeEventListener("focus", handleForeground);
      window.removeEventListener("online", handleForeground);
    };
  }, [disparar]);
}