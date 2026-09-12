import { useEffect, useMemo, useState } from "react";
import { Page } from "@/components/layout/Page";
import { Card } from "@/components/ui/Card";
import { PlusIcon } from "@/components/ui/icons";
import { Spinner } from "@/components/ui/Spinner";
import type { ToastVariant } from "@/components/ui/toastVariants";
import { useCurrentTime } from "@/lib/devtools/useCurrentTime";
import { useClock } from "@/lib/devtest/provider";
import type { Alumno } from "@/lib/api/client";
import { CUSTOM_CLAVE_PREFIX } from "@/lib/storage/scheduleEditsStore";
import type { EditedField } from "@/lib/storage/scheduleEditsStore";
import { SUBJECT_ADDED_TOAST } from "@/lib/toastMessages";
import type { ResolvedMeeting } from "./types";
import { isCustomClave } from "./edits";
import {
  collectSubjectFields,
  detectManualEditConflicts,
  sameStringMap,
} from "./drift";
import { mapHorario } from "./mapHorario";
import { useScheduleState } from "./scheduleStateContext";
import { DayDots } from "./components/DayDots";
import { ScheduleDayView } from "./components/ScheduleDayView";
import { SubjectEditorSheet } from "./components/SubjectEditorSheet";
import type { SubjectEditorSubmit } from "./components/SubjectEditorSheet";
import { EditConflictsSheet } from "./components/EditConflictsSheet";
import { useHorizontalSwipe } from "./hooks/useHorizontalSwipe";
import {
  addDays,
  dateForWeekday,
  getScheduleForDay,
  isSameDay,
} from "./utils";

interface SchedulePageProps {
  alumno: Alumno | null;
  /** Hold time before long-press opens the editor (dev-configurable). */
  longPressDurationMs?: number;
  /** True while dev simulation feeds the screens: drift detection pauses. */
  simulated?: boolean;
  onShowToast?: (message: string, variant: ToastVariant) => void;
}

type EditorState =
  | { mode: "closed" }
  | { mode: "edit"; meeting: ResolvedMeeting }
  | { mode: "create" };

export function SchedulePage({
  alumno,
  longPressDurationMs,
  simulated = false,
  onShowToast,
}: SchedulePageProps) {
  const now = useCurrentTime();
  const clock = useClock();
  const { edits: scheduleEdits, resolvedWeek } = useScheduleState();
  const [selectedDate, setSelectedDate] = useState<Date>(() => clock.getNow());
  const [editor, setEditor] = useState<EditorState>({ mode: "closed" });

  const swipe = useHorizontalSwipe((direction) => {
    setSelectedDate((previous) => addDays(previous, direction));
  });

  const dayMeetings = useMemo(
    () => getScheduleForDay(resolvedWeek, selectedDate),
    [resolvedWeek, selectedDate],
  );

  const isToday = isSameDay(selectedDate, now);

  const { loaded: editsLoaded, edits } = scheduleEdits;

  // Manual-edit drift: after each real fetch, compare the fresh raw values
  // against the stored baseline. School changes colliding with a live manual
  // override become pending conflicts the user must settle. Paused while dev
  // simulation feeds the screens so virtual data never pollutes baselines.
  const { registerDrift } = scheduleEdits;
  useEffect(() => {
    if (simulated || !alumno || !editsLoaded) return;

    const rawFields = collectSubjectFields(
      mapHorario(alumno.horario, alumno.boleta),
    );
    const conflicts = detectManualEditConflicts(
      rawFields,
      edits.fieldSnapshots,
      edits.fieldEdits,
    );
    const snapshotsChanged = !sameStringMap(rawFields, edits.fieldSnapshots);

    if (conflicts.length > 0 || snapshotsChanged) {
      registerDrift(conflicts, rawFields);
    }
  }, [
    alumno,
    simulated,
    editsLoaded,
    edits.fieldSnapshots,
    edits.fieldEdits,
    registerDrift,
  ]);

  function handleResolveConflict(
    clave: string,
    field: EditedField,
    useNewValue: boolean,
  ) {
    scheduleEdits.resolvePendingConflict(clave, field, useNewValue);
  }

  const subjectNames = useMemo(() => {
    const names: Record<string, string> = {};
    for (const meeting of resolvedWeek) {
      if (names[meeting.clave] === undefined) {
        names[meeting.clave] = meeting.subjectName;
      }
    }
    return names;
  }, [resolvedWeek]);

  function handleEditorSubmit(submit: SubjectEditorSubmit) {
    if (editor.mode === "edit") {
      const meeting = editor.meeting;
      scheduleEdits.setFieldEdit(meeting.clave, {
        subjectName: submit.subjectName,
        professor: submit.professor,
        classroom: submit.classroom,
      });
      const timesChanged =
        submit.startMinutes !== meeting.startMinutes ||
        submit.endMinutes !== meeting.endMinutes;
      scheduleEdits.setTimeEdit(
        meeting.clave,
        meeting.weekday,
        timesChanged
          ? { startMinutes: submit.startMinutes, endMinutes: submit.endMinutes }
          : null,
      );
    } else {
      scheduleEdits.addCustomSubject({
        clave: `${CUSTOM_CLAVE_PREFIX}${clock.getNow().getTime().toString(36)}`,
        subjectName: submit.subjectName,
        classroom: submit.classroom,
        professor: submit.professor,
        slots: submit.days.map((weekday) => ({
          weekday,
          startMinutes: submit.startMinutes,
          endMinutes: submit.endMinutes,
        })),
      });
      // Jump to the first scheduled day so the new subject is visible
      // immediately, even when it does not meet today.
      const firstDay = Math.min(...submit.days);
      setSelectedDate(dateForWeekday(now, firstDay));
      onShowToast?.(SUBJECT_ADDED_TOAST, "success");
    }
    setEditor({ mode: "closed" });
  }

  function handleRemoveSubject() {
    if (editor.mode !== "edit") return;
    if (!isCustomClave(editor.meeting.clave)) return;
    scheduleEdits.removeCustomSubject(editor.meeting.clave);
    setEditor({ mode: "closed" });
  }

  return (
    <>
      <Page>
        {!alumno ? (
          <Card className="py-8 text-center text-sm text-on-surface-variant">
            No hay datos de horario disponibles.
          </Card>
        ) : !scheduleEdits.loaded ? (
          <div className="flex justify-center py-10">
            <Spinner size={28} className="text-primary" />
          </div>
        ) : (
          <>
            <div className="mb-4 flex items-center justify-center gap-5">
              <DayDots
                selectedDate={selectedDate}
                now={now}
                onSelectDate={setSelectedDate}
              />
              <button
                type="button"
                onClick={
                  isToday
                    ? () => setEditor({ mode: "create" })
                    : () => setSelectedDate(clock.getNow())
                }
                aria-label={isToday ? "Agregar materia" : "Volver a hoy"}
                title={isToday ? "Agregar materia" : "Volver a hoy"}
                className={`flex h-10 w-10 items-center justify-center rounded-full transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary ${
                  isToday
                    ? "bg-primary-container text-on-primary-container hover:bg-primary-container/70"
                    : "bg-transparent font-semibold text-primary hover:bg-primary-container/50"
                }`}
              >
                {isToday ? (
                  <PlusIcon size={20} />
                ) : (
                  <span className="text-xs">Hoy</span>
                )}
              </button>
            </div>
            <div {...swipe.bind} className="touch-pan-y flex flex-1 flex-col">
              <ScheduleDayView
                dayMeetings={dayMeetings}
                now={now}
                isToday={isToday}
                longPressDurationMs={longPressDurationMs}
                onEditRequest={(meeting) =>
                  setEditor({ mode: "edit", meeting })
                }
              />
            </div>
          </>
        )}
      </Page>

      {editor.mode !== "closed" ? (
        <SubjectEditorSheet
          meeting={editor.mode === "edit" ? editor.meeting : null}
          onSubmit={handleEditorSubmit}
          onRemove={
            editor.mode === "edit" && isCustomClave(editor.meeting.clave)
              ? handleRemoveSubject
              : undefined
          }
          onClose={() => setEditor({ mode: "closed" })}
        />
      ) : null}

      {edits.pendingConflicts.length > 0 ? (
        <EditConflictsSheet
          conflicts={edits.pendingConflicts}
          subjectNames={subjectNames}
          onResolve={handleResolveConflict}
          onClose={() => undefined}
        />
      ) : null}
    </>
  );
}
