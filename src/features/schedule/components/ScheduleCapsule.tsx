import { useEffect, useRef, useState } from "react";
import { Capsule } from "@/components/ui/Capsule";
import type { CapsuleNotification } from "@/lib/notifications/capsuleEvents";
import type { ResolvedMeeting } from "../types";
import {
  autoCapsuleEvent,
  buildCapsuleState,
  toCapsuleTick,
} from "../capsuleState";
import type { NextClassInfo } from "../capsuleState";
import {
  formatClassroomLabel,
  formatProfessorLabel,
  minutesOf,
  shortenSubjectName,
} from "../utils";

interface ScheduleCapsuleProps {
  meetings: readonly ResolvedMeeting[];
  /** Real clock instant driving every state (dev simulation included). */
  now: Date;
  /** Next class of a future weekday, shown once today has no class ahead. */
  nextClassInfo?: NextClassInfo | null;
  /** Transient event (new grade, debt…) flashed before returning to classes. */
  notification?: CapsuleNotification | null;
  autoCollapseMs: number;
}

const DETAIL_STAGE_MS = 2200;
const FLASH_TOTAL_MS = 4200;

type FlashStage = "detail" | "followup" | null;

const WEEKDAY_NAMES = [
  "domingo",
  "lunes",
  "martes",
  "miércoles",
  "jueves",
  "viernes",
  "sábado",
];

// Rows inside the flash reveal line by line (title → detail → consequence).
const FLASH_ROW_IN =
  "motion-safe:animate-[studia-capsule-in_0.35s_var(--ease-out-soft)]";

const DURATION_SIZES = {
  md: {
    hours: "text-capsule-num-h",
    hourUnit: "text-capsule-num-u",
    mins: "text-capsule-num-m",
    minUnit: "text-capsule-num-u",
  },
  lg: {
    hours: "text-capsule-num-h-lg",
    hourUnit: "text-capsule-num-u-lg",
    mins: "text-capsule-num-m-lg",
    minUnit: "text-capsule-num-u-lg",
  },
} as const;

function DurationCounter({
  minutes,
  size = "md",
}: {
  minutes: number;
  size?: keyof typeof DURATION_SIZES;
}) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  const hasMinutes = rest > 0 || hours === 0;
  const t = DURATION_SIZES[size];

  return (
    <span className="inline-flex shrink-0 items-baseline tabular-nums">
      {hours > 0 ? (
        <span className="inline-flex items-baseline gap-px">
          <span
            className={`${t.hours} font-semibold leading-none text-primary-strong`}
          >
            {hours}
          </span>
          <span
            className={`${t.hourUnit} font-normal leading-none text-primary-strong/75`}
          >
            h
          </span>
        </span>
      ) : null}
      {hasMinutes ? (
        <span
          className={`inline-flex items-baseline gap-px ${hours > 0 ? "ml-1" : ""}`}
        >
          <span
            className={`${t.mins} font-normal leading-none text-primary-strong`}
          >
            {rest}
          </span>
          <span
            className={`${t.minUnit} font-normal leading-none text-primary-strong/75`}
          >
            m
          </span>
        </span>
      ) : null}
    </span>
  );
}

export function ScheduleCapsule({
  meetings,
  now,
  nextClassInfo = null,
  notification = null,
  autoCollapseMs,
}: ScheduleCapsuleProps) {
  const state = buildCapsuleState(meetings, minutesOf(now));

  // Important-event detection across minute ticks. Each event id fires once;
  // the first observation is silent by design (see capsuleState.ts).
  const previousTickRef = useRef<ReturnType<typeof toCapsuleTick> | null>(null);
  const firedEventsRef = useRef<Set<string>>(new Set());
  const [pulseKey, setPulseKey] = useState<string>("");

  const currentTick = toCapsuleTick(state);
  useEffect(() => {
    const event = autoCapsuleEvent(previousTickRef.current, currentTick);
    previousTickRef.current = currentTick;

    if (event === null) return;

    const eventKey = `${event}:${currentTick.clave ?? ""}`;
    if (firedEventsRef.current.has(eventKey)) return;

    firedEventsRef.current.add(eventKey);
    setPulseKey(`${eventKey}:${Date.now()}`);
  }, [currentTick]);

  // Notification sequence: detail first ("Matemáticas 10"), then the follow-up
  // ("Promedio · 8.75"), then back to classes.
  const [flashStage, setFlashStage] = useState<FlashStage>(null);
  const flashTimersRef = useRef<number[]>([]);

  useEffect(() => {
    for (const timer of flashTimersRef.current) window.clearTimeout(timer);
    flashTimersRef.current = [];

    if (notification === null) {
      setFlashStage(null);
      return;
    }

    setFlashStage("detail");
    flashTimersRef.current.push(
      window.setTimeout(() => setFlashStage("followup"), DETAIL_STAGE_MS),
      window.setTimeout(() => setFlashStage(null), FLASH_TOTAL_MS),
    );

    return () => {
      for (const timer of flashTimersRef.current) window.clearTimeout(timer);
      flashTimersRef.current = [];
    };
  }, [notification]);

  const flashing = flashStage !== null && notification !== null;
  const effectivePulse =
    notification !== null
      ? `flash:${notification.id}`
      : pulseKey === ""
        ? undefined
        : pulseKey;
  const effectiveCollapseMs = flashing ? FLASH_TOTAL_MS : autoCollapseMs;

  if (flashing && notification) {
    const row = {
      detailLabel: flashStage === "detail" ? notification.detail : undefined,
      consequence:
        flashStage === "followup" ? notification.followUpDetail : undefined,
    };
    return (
      <Capsule
        stacked
        autoCollapseMs={effectiveCollapseMs}
        pulseKey={effectivePulse}
        ariaLabel={`${notification.title}${notification.detail ? `: ${notification.detail}` : ""}`}
        minimized={
          <span className="flex min-w-0 flex-col leading-tight">
            <span className="text-capsule-body font-semibold text-on-surface">
              {notification.title}
            </span>
            {row.detailLabel ? (
              <span
                className={`${FLASH_ROW_IN} truncate text-capsule-body font-medium text-on-surface-variant`}
              >
                {row.detailLabel}
              </span>
            ) : null}
            {row.consequence ? (
              <span
                className={`${FLASH_ROW_IN} truncate text-capsule-body font-medium tabular-nums text-primary-strong`}
              >
                {row.consequence}
              </span>
            ) : null}
          </span>
        }
        minimizedExpanded={
          <span className="flex min-w-0 flex-col gap-capsule-gap leading-tight">
            <span className="text-capsule-headline font-semibold text-on-surface">
              {notification.title}
            </span>
            {row.detailLabel ? (
              <span
                className={`${FLASH_ROW_IN} truncate text-capsule-body font-medium text-on-surface-variant`}
              >
                {row.detailLabel}
              </span>
            ) : null}
            {row.consequence ? (
              <span
                className={`${FLASH_ROW_IN} truncate text-capsule-body font-medium tabular-nums text-primary-strong`}
              >
                {row.consequence}
              </span>
            ) : null}
          </span>
        }
        expanded={
          flashStage === "followup" && notification.followUpTitle ? (
            <>
              <span className="text-capsule-caption font-semibold uppercase tracking-[0.14em] text-on-surface-variant">
                {notification.followUpTitle}
              </span>
              <span className="font-display text-capsule-display-lg font-bold tabular-nums text-primary-strong">
                {notification.followUpDetail ?? ""}
              </span>
            </>
          ) : (
            <>
              <span className="text-capsule-caption font-semibold uppercase tracking-[0.14em] text-on-surface-variant">
                {notification.title}
              </span>
              {notification.detail ? (
                <span className="font-display text-capsule-display font-bold leading-tight text-on-surface">
                  {notification.detail}
                </span>
              ) : null}
            </>
          )
        }
      />
    );
  }

  // "Por hoy terminaste" y "Sin clases hoy" ahora se cuentan igual: no hay
  // clase por delante hoy, así que la cápsula mira la próxima clase futura
  // ("mañana HH:MM" o "nos vemos el {día}"). Sin clases restantes en la
  // semana, queda el mensaje calmado y la app sigue funcionando.
  if (state.kind === "empty" || state.kind === "done") {
    const info = nextClassInfo;
    const tomorrowWeekday = (now.getDay() + 1) % 7;
    const isTomorrow = info !== null && info.weekday === tomorrowWeekday;
    const dayName = info !== null ? WEEKDAY_NAMES[info.weekday] : null;
    const subjectLabel = info ? shortenSubjectName(info.subjectName) : undefined;
    const headline =
      info === null
        ? "Consulta otro día desde tu horario."
        : isTomorrow
          ? `Mañana ${info.startsLabel}`
          : `Nos vemos el ${dayName}`;
    return (
      <Capsule
        autoCollapseMs={autoCollapseMs}
        pulseKey={effectivePulse}
        ariaLabel={
          info === null
            ? headline
            : `${headline}: ${info.subjectName} a las ${info.startsLabel}`
        }
        minimized={
          info === null ? (
            <span className="text-capsule-body font-medium text-on-surface-variant">
              {headline}
            </span>
          ) : (
            <span className="text-capsule-body font-semibold tabular-nums text-primary-strong">
              {isTomorrow ? `mañana ${info.startsLabel}` : `nos vemos el ${dayName}`}
            </span>
          )
        }
        expanded={
          info === null ? (
            <span className="text-capsule-body text-on-surface-variant">
              {headline}
            </span>
          ) : (
            <>
              <span className="font-display text-capsule-title font-bold leading-tight text-on-surface">
                {headline}
              </span>
              <span className="text-capsule-caption font-medium uppercase tracking-[0.14em] text-on-surface-variant">
                {isTomorrow ? "mañana" : dayName}
              </span>
              <span className="truncate text-capsule-body text-on-surface-variant">
                <span className="font-semibold text-on-surface">{subjectLabel}</span>
                {" · "}
                <span className="tabular-nums">{info.startsLabel}</span>
              </span>
            </>
          )
        }
      />
    );
  }

  if (state.kind === "in-class") {
    const classroomLabel = formatClassroomLabel(state.classroom);
    const professorLabel = formatProfessorLabel(state.professor);
    return (
      <Capsule
        tone="accent"
        stacked
        autoCollapseMs={autoCollapseMs}
        pulseKey={effectivePulse}
        progressPercent={state.progressPercent}
        ariaLabel={`En clase: ${state.subjectName}, termina a las ${state.endsLabel}`}
        minimized={
          <span className="flex min-w-0 flex-col leading-tight">
            <span className="flex items-baseline gap-capsule-gap">
              <DurationCounter minutes={state.remainingMinutes} />
              {classroomLabel !== null ? (
                <span className="min-w-0 truncate text-capsule-body font-medium text-on-surface">
                  {classroomLabel}
                </span>
              ) : null}
            </span>
            <span className="max-w-capsule-line-sm truncate text-capsule-caption font-medium text-on-surface-variant">
              {shortenSubjectName(state.subjectName)}
            </span>
          </span>
        }
        minimizedExpanded={
          <span className="flex min-w-0 flex-col gap-capsule-gap leading-tight">
            <span className="flex items-baseline gap-capsule-gap-lg">
              <DurationCounter minutes={state.remainingMinutes} size="lg" />
              {classroomLabel !== null ? (
                <span className="min-w-0 truncate text-capsule-headline font-medium text-on-surface">
                  {classroomLabel}
                </span>
              ) : null}
            </span>
            <span className="motion-safe:animate-[studia-capsule-in_0.35s_var(--ease-out-soft)] truncate text-capsule-body font-medium text-on-surface">
              {state.subjectName}
            </span>
          </span>
        }
        expanded={
          professorLabel !== null ? (
            <span className="truncate text-capsule-caption font-medium text-on-surface-variant">
              {professorLabel}
            </span>
          ) : null
        }
      />
    );
  }

  const classroomLabel = formatClassroomLabel(state.classroom);
  const professorLabel = formatProfessorLabel(state.professor);
  return (
    <Capsule
      stacked
      autoCollapseMs={autoCollapseMs}
      pulseKey={effectivePulse}
      ariaLabel={`Siguiente clase: ${state.subjectName} a las ${state.startsLabel}`}
      minimized={
        <span className="flex min-w-0 flex-col leading-tight">
          <span className="flex items-baseline gap-capsule-gap">
            <DurationCounter minutes={state.minutesUntil} />
            {classroomLabel !== null ? (
              <span className="min-w-0 truncate text-capsule-body font-medium text-on-surface">
                {classroomLabel}
              </span>
            ) : null}
          </span>
          <span className="max-w-capsule-line-sm truncate text-capsule-caption font-medium text-on-surface-variant">
            {shortenSubjectName(state.subjectName)}
          </span>
        </span>
      }
      minimizedExpanded={
        <span className="flex min-w-0 flex-col gap-capsule-gap leading-tight">
          <span className="flex items-baseline gap-capsule-gap-lg">
            <DurationCounter minutes={state.minutesUntil} size="lg" />
            {classroomLabel !== null ? (
              <span className="min-w-0 truncate text-capsule-headline font-medium text-on-surface">
                {classroomLabel}
              </span>
            ) : null}
          </span>
          <span className="motion-safe:animate-[studia-capsule-in_0.35s_var(--ease-out-soft)] truncate text-capsule-body font-medium text-on-surface">
            {state.subjectName}
          </span>
        </span>
      }
      expanded={
        professorLabel !== null ? (
          <span className="truncate text-capsule-caption font-medium text-on-surface-variant">
            {professorLabel}
          </span>
        ) : null
      }
    />
  );
}