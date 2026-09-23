import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { TimeInput } from "@/components/ui/TimeInput";
import type { ClassMeeting } from "../types";
import { formatMinutes, parseMinutes } from "../utils";

const WEEKDAYS: ReadonlyArray<readonly [value: number, label: string]> = [
  [1, "L"],
  [2, "M"],
  [3, "X"],
  [4, "J"],
  [5, "V"],
  [6, "S"],
];

const WEEKDAY_NAMES = ["", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

export interface SubjectEditorSubmit {
  subjectName: string;
  professor: string;
  classroom: string;
  startMinutes: number;
  endMinutes: number;
  days: number[];
}

interface FieldErrors {
  name?: string;
  start?: string;
  end?: string;
  days?: string;
}

interface SubjectEditorSheetProps {
  /** Meeting being edited, or null to create a new subject. */
  meeting: ClassMeeting | null;
  onSubmit: (submit: SubjectEditorSubmit) => void;
  /** Only offered for manually added subjects. */
  onRemove?: () => void;
  onClose: () => void;
}

/**
 * Long-press / pencil entry point for editing a class card, and the creation
 * flow for manual subjects (e.g. Inglés). Name, professor and classroom
 * apply to every occurrence of the subject; the time range applies to the
 * edited occurrence only.
 */
export function SubjectEditorSheet({
  meeting,
  onSubmit,
  onRemove,
  onClose,
}: SubjectEditorSheetProps) {
  const isCreating = meeting === null;

  const [subjectName, setSubjectName] = useState(meeting?.subjectName ?? "");
  const [professor, setProfessor] = useState(meeting?.professor ?? "");
  const [classroom, setClassroom] = useState(meeting?.classroom ?? "");
  const [inicio, setInicio] = useState(
    meeting ? formatMinutes(meeting.startMinutes) : "",
  );
  const [fin, setFin] = useState(
    meeting ? formatMinutes(meeting.endMinutes) : "",
  );
  const [days, setDays] = useState<number[]>([]);
  const [errors, setErrors] = useState<FieldErrors>({});

  function toggleDay(day: number) {
    setDays((previous) =>
      previous.includes(day)
        ? previous.filter((value) => value !== day)
        : [...previous, day],
    );
    setErrors((previous) => ({ ...previous, days: undefined }));
  }

  function handleSubmit() {
    const nextErrors: FieldErrors = {};
    const name = subjectName.trim();
    if (name === "") {
      nextErrors.name = "Ingresa el nombre de la materia.";
    }

    const startMinutes = parseMinutes(inicio);
    if (startMinutes === null) {
      nextErrors.start = "Ingresa la hora de inicio.";
    }

    const endMinutes = parseMinutes(fin);
    if (endMinutes === null) {
      nextErrors.end = "Ingresa la hora de fin.";
    } else if (startMinutes !== null && startMinutes >= endMinutes) {
      nextErrors.end = "La hora de fin debe ser posterior al inicio.";
    }

    if (isCreating && days.length === 0) {
      nextErrors.days = "Selecciona al menos un día.";
    }

    if (
      nextErrors.name !== undefined ||
      nextErrors.start !== undefined ||
      nextErrors.end !== undefined ||
      nextErrors.days !== undefined
    ) {
      setErrors(nextErrors);
      return;
    }

    setErrors({});
    onSubmit({
      subjectName: name,
      professor: professor.trim(),
      classroom: classroom.trim(),
      startMinutes: startMinutes as number,
      endMinutes: endMinutes as number,
      days,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <button
        type="button"
        aria-label="Cerrar"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-on-background/40 backdrop-blur-[2px] motion-safe:animate-[studia-fade-in_0.25s_ease-out]"
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-label={isCreating ? "Agregar materia" : "Editar materia"}
        className="relative max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-surface p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-lg ring-1 ring-outline-variant motion-safe:animate-[studia-sheet-in_0.35s_var(--ease-glide)]"
      >
        <div className="mx-auto mb-3 h-1 w-10 shrink-0 rounded-full bg-outline-variant" />
        <h2 className="text-lg font-semibold text-on-surface">
          {isCreating ? "Agregar materia" : "Editar materia"}
        </h2>
        <p className="mb-4 mt-1 text-sm text-on-surface-variant">
          {isCreating
            ? "Se agrega como una materia más del horario."
            : `${WEEKDAY_NAMES[meeting.weekday] ?? ""} · el nombre y el docente se aplican a todos los días; la hora solo a este día.`}
        </p>

        <div className="flex flex-col gap-3">
          <Input
            label="Nombre"
            value={subjectName}
            onChange={(event) => {
              setSubjectName(event.target.value);
              setErrors((previous) => ({ ...previous, name: undefined }));
            }}
            error={errors.name}
          />
          <div className="grid grid-cols-2 gap-2">
            <Input
              label="Docente"
              value={professor}
              onChange={(event) => setProfessor(event.target.value)}
            />
            <Input
              label="Salón"
              value={classroom}
              onChange={(event) => setClassroom(event.target.value)}
            />
          </div>

          {isCreating ? (
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
                    checked={days.includes(value)}
                    onChange={() => toggleDay(value)}
                    className="sr-only"
                  />
                  {label}
                </label>
              ))}
              {errors.days ? (
                <p role="alert" className="text-sm text-error">
                  {errors.days}
                </p>
              ) : null}
            </fieldset>
          ) : null}

          <div className="grid grid-cols-2 gap-2">
            <TimeInput
              label="Inicio"
              value={inicio}
              onChange={(event) => {
                setInicio(event.target.value);
                setErrors((previous) => ({ ...previous, start: undefined }));
              }}
              error={errors.start}
            />
            <TimeInput
              label="Fin"
              value={fin}
              onChange={(event) => {
                setFin(event.target.value);
                setErrors((previous) => ({ ...previous, end: undefined }));
              }}
              error={errors.end}
            />
          </div>

          <div className="mt-1 flex gap-2">
            {onRemove ? (
              <Button variant="ghost" onClick={onRemove} className="flex-1">
                Quitar materia
              </Button>
            ) : null}
            <Button
              variant="secondary"
              onClick={onClose}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button onClick={handleSubmit} className="flex-1">
              Guardar
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
