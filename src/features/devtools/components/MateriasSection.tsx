import { useState } from "react";
import type { HorarioDia } from "sith-api-client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useClock, useDevTestEnvironment } from "@/lib/devtest/provider";
import type { DevMateria } from "../types";
import { toCalificacionMateria, toHorarioMateria } from "../materiasAdapter";

const WEEKDAYS: ReadonlyArray<readonly [value: number, label: string]> = [
  [1, "L"],
  [2, "M"],
  [3, "X"],
  [4, "J"],
  [5, "V"],
  [6, "S"],
];

interface DraftMateria {
  nombre: string;
  docente: string;
  salon: string;
  dias: number[];
  inicio: string;
  fin: string;
  calificacion: string;
}

const EMPTY_DRAFT: DraftMateria = {
  nombre: "",
  docente: "",
  salon: "",
  dias: [],
  inicio: "",
  fin: "",
  calificacion: "",
};

function summarize(dias: HorarioDia): string {
  return Object.values(dias)
    .filter((value) => value !== undefined)
    .join(" · ");
}

export function MateriasSection() {
  const env = useDevTestEnvironment();
  const clock = useClock();
  const [draft, setDraft] = useState<DraftMateria>(EMPTY_DRAFT);
  const [error, setError] = useState<string | null>(null);

  const mockAlumno = env.getMockAppData()?.alumno ?? null;
  const nameByClave = new Map(
    (mockAlumno?.boleta.materias ?? []).map((materia) => [
      materia.clave,
      materia.nombre,
    ]),
  );

  function toggleDay(day: number) {
    setDraft((previous) => ({
      ...previous,
      dias: previous.dias.includes(day)
        ? previous.dias.filter((value) => value !== day)
        : [...previous.dias, day],
    }));
  }

  function addMateria() {
    if (draft.nombre.trim() === "") {
      setError("La materia necesita un nombre.");
      return;
    }
    if (draft.dias.length === 0) {
      setError("Selecciona al menos un día.");
      return;
    }
    if (draft.inicio === "" || draft.fin === "" || draft.inicio >= draft.fin) {
      setError("El horario de inicio y fin no es válido.");
      return;
    }

    const materia: DevMateria = {
      ...draft,
      clave: `DEV-${clock.getNow().getTime().toString(36)}`,
      nombre: draft.nombre.trim(),
      docente: draft.docente.trim(),
      salon: draft.salon.trim(),
      calificacion: draft.calificacion.trim(),
    };

    env.addMateria({
      horario: toHorarioMateria(materia),
      calificacion: toCalificacionMateria(materia),
    });
    setDraft(EMPTY_DRAFT);
    setError(null);
  }

  const materias = mockAlumno?.horario ?? [];

  return (
    <section className="flex flex-col gap-3">
      <h4 className="text-sm font-semibold text-on-surface">Materias</h4>

      {materias.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {materias.map((materia) => (
            <li
              key={materia.clave}
              className="flex items-center justify-between gap-3 rounded-xl bg-surface px-3 py-2 ring-1 ring-outline-variant"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-on-surface">
                  {nameByClave.get(materia.clave) ?? materia.clave}
                </p>
                <p className="truncate text-xs text-on-surface-variant">
                  {summarize(materia.dias)}
                </p>
              </div>
              <Button
                variant="ghost"
                onClick={() => env.removeMateria(materia.clave)}
                className="h-8 shrink-0 px-2 text-xs"
                aria-label={`Quitar ${nameByClave.get(materia.clave) ?? materia.clave}`}
              >
                Quitar
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-on-surface-variant">
          No hay materias en el horario simulado.
        </p>
      )}

      <div className="flex flex-col gap-2 rounded-xl bg-background p-3">
        <Input
          label="Nombre"
          value={draft.nombre}
          onChange={(event) =>
            setDraft((previous) => ({ ...previous, nombre: event.target.value }))
          }
        />
        <div className="grid grid-cols-2 gap-2">
          <Input
            label="Docente"
            value={draft.docente}
            onChange={(event) =>
              setDraft((previous) => ({
                ...previous,
                docente: event.target.value,
              }))
            }
          />
          <Input
            label="Salón"
            value={draft.salon}
            onChange={(event) =>
              setDraft((previous) => ({ ...previous, salon: event.target.value }))
            }
          />
        </div>
        <fieldset className="flex items-center gap-2">
          <legend className="mb-1 text-sm font-medium text-on-surface">
            Días
          </legend>
          {WEEKDAYS.map(([value, label]) => (
            <label
              key={value}
              className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-sm font-semibold transition-colors has-[:checked]:bg-primary-container has-[:checked]:text-on-primary-container"
            >
              <input
                type="checkbox"
                checked={draft.dias.includes(value)}
                onChange={() => toggleDay(value)}
                className="sr-only"
              />
              {label}
            </label>
          ))}
        </fieldset>
        <div className="grid grid-cols-3 gap-2">
          <Input
            label="Inicio"
            type="time"
            value={draft.inicio}
            onChange={(event) =>
              setDraft((previous) => ({
                ...previous,
                inicio: event.target.value,
              }))
            }
          />
          <Input
            label="Fin"
            type="time"
            value={draft.fin}
            onChange={(event) =>
              setDraft((previous) => ({ ...previous, fin: event.target.value }))
            }
          />
          <Input
            label="Calif."
            value={draft.calificacion}
            inputMode="numeric"
            onChange={(event) =>
              setDraft((previous) => ({
                ...previous,
                calificacion: event.target.value,
              }))
            }
          />
        </div>

        {error ? (
          <p role="alert" className="text-sm text-error">
            {error}
          </p>
        ) : null}

        <Button variant="secondary" onClick={addMateria} className="mt-1 w-full">
          Agregar materia simulada
        </Button>
      </div>
    </section>
  );
}