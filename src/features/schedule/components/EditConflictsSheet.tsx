import { Button } from "@/components/ui/Button";
import type { EditedField, PendingEditConflict } from "@/lib/storage/scheduleEditsStore";

const FIELD_LABELS: Record<EditedField, string> = {
  subjectName: "Nombre",
  professor: "Docente",
  classroom: "Salón",
};

interface EditConflictsSheetProps {
  conflicts: PendingEditConflict[];
  /** clave -> display name of the subject (edited view). */
  subjectNames: Record<string, string>;
  onResolve: (
    clave: string,
    field: EditedField,
    useNewValue: boolean,
  ) => void;
  onClose: () => void;
}

/**
 * Shown when the school changed text values the user had manually edited.
 * Each row offers the two possible outcomes; unresolved rows persist across
 * restarts until decided.
 */
export function EditConflictsSheet({
  conflicts,
  subjectNames,
  onResolve,
  onClose,
}: EditConflictsSheetProps) {
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
        aria-label="Cambios en tus materias"
        className="relative max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-surface p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-lg ring-1 ring-outline-variant motion-safe:animate-[studia-sheet-in_0.35s_var(--ease-glide)]"
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-outline-variant" />
        <h2 className="text-lg font-semibold text-on-surface">
          Cambios en tus materias
        </h2>
        <p className="mb-4 mt-1 text-sm text-on-surface-variant">
          La escuela actualizó información que habías editado. Elige qué valor
          conservar.
        </p>

        <ul className="mb-4 flex flex-col gap-4">
          {conflicts.map((conflict) => {
            const subject =
              subjectNames[conflict.clave] ?? conflict.clave;

            return (
              <li
                key={`${conflict.clave}|${conflict.field}`}
                className="rounded-xl bg-surface-variant/60 p-3"
              >
                <p className="text-sm font-semibold text-on-surface">
                  {subject}
                </p>
                <p className="text-sm text-on-surface-variant">
                  {FIELD_LABELS[conflict.field]}
                </p>
                <p className="mt-1 text-xs text-on-surface-variant">
                  Guardaste{" "}
                  <span className="font-medium text-on-surface">
                    {conflict.savedValue}
                  </span>{" "}
                  · la escuela reporta{" "}
                  <span className="font-medium text-on-surface">
                    {conflict.newValue}
                  </span>
                </p>
                <div className="mt-2 flex gap-2">
                  <Button
                    variant="secondary"
                    className="h-9 flex-1 text-xs"
                    onClick={() =>
                      onResolve(conflict.clave, conflict.field, false)
                    }
                  >
                    Conservar el mío
                  </Button>
                  <Button
                    className="h-9 flex-1 text-xs"
                    onClick={() =>
                      onResolve(conflict.clave, conflict.field, true)
                    }
                  >
                    Usar el nuevo
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>

        <Button variant="ghost" className="w-full" onClick={onClose}>
          Decidir después
        </Button>
      </section>
    </div>
  );
}
