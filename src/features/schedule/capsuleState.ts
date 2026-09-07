import type { ClassMeeting, ResolvedMeeting } from "./types";
import { addDays, formatMinutes } from "./utils";

/**
 * Context-capsule view model: what the student should know right now,
 * independent of which schedule day is being browsed. Pure so it stays
 * unit-testable (see capsuleState.test.ts).
 */
export type CapsuleViewModel =
  | { kind: "empty" }
  | {
      kind: "in-class";
      clave: string;
      subjectName: string;
      classroom: string;
      professor: string;
      endsLabel: string;
      progressPercent: number;
      remainingMinutes: number;
    }
  | {
      kind: "upcoming";
      clave: string;
      subjectName: string;
      classroom: string;
      professor: string;
      startsLabel: string;
      minutesUntil: number;
    }
  | { kind: "done" };

export type CapsuleEvent = "class-start" | "one-hour" | "one-minute";

/** Minimal observation used to detect important transitions between ticks. */
export interface CapsuleTick {
  kind: CapsuleViewModel["kind"];
  clave?: string;
  minutesUntil?: number;
}

export function buildCapsuleState(
  meetings: readonly ResolvedMeeting[],
  nowMinutes: number,
): CapsuleViewModel {
  const sorted = [...meetings].sort((a, b) => a.startMinutes - b.startMinutes);

  for (const meeting of sorted) {
    if (nowMinutes >= meeting.startMinutes && nowMinutes < meeting.endMinutes) {
      const span = meeting.endMinutes - meeting.startMinutes;
      const elapsed = nowMinutes - meeting.startMinutes;
      return {
        kind: "in-class",
        clave: meeting.clave,
        subjectName: meeting.subjectName,
        classroom: meeting.classroom,
        professor: meeting.professor,
        endsLabel: formatMinutes(meeting.endMinutes),
        progressPercent: span > 0 ? Math.min((elapsed / span) * 100, 100) : 0,
        remainingMinutes: Math.ceil(meeting.endMinutes - nowMinutes),
      };
    }
  }

  const next = sorted.find((meeting) => meeting.startMinutes > nowMinutes);
  if (next) {
    return {
      kind: "upcoming",
      clave: next.clave,
      subjectName: next.subjectName,
      classroom: next.classroom,
      professor: next.professor,
      startsLabel: formatMinutes(next.startMinutes),
      minutesUntil: Math.ceil(next.startMinutes - nowMinutes),
    };
  }

  return sorted.length === 0 ? { kind: "empty" } : { kind: "done" };
}

export function toCapsuleTick(state: CapsuleViewModel): CapsuleTick {
  if (state.kind === "in-class") {
    return { kind: state.kind, clave: state.clave };
  }
  if (state.kind === "upcoming") {
    return {
      kind: state.kind,
      clave: state.clave,
      minutesUntil: state.minutesUntil,
    };
  }
  return { kind: state.kind };
}

export interface UpcomingClassInfo {
  subjectName: string;
  startsLabel: string;
  /** Absolute Date of that class on tomorrow (derived from `today`). */
  startsAt: Date;
}

/** Earliest class of tomorrow, so a finished day still points forward. */
export function getTomorrowFirstMeeting(
  weekMeetings: readonly ClassMeeting[],
  today: Date,
): UpcomingClassInfo | null {
  const tomorrowWeekday = addDays(today, 1).getDay();
  const candidates = weekMeetings
    .filter((meeting) => meeting.weekday === tomorrowWeekday)
    .sort((a, b) => a.startMinutes - b.startMinutes);
  const first = candidates[0];

  if (!first) return null;

  const startsAt = addDays(today, 1);
  startsAt.setHours(
    Math.floor(first.startMinutes / 60),
    first.startMinutes % 60,
    0,
    0,
  );

  return {
    subjectName: first.subjectName,
    startsLabel: formatMinutes(first.startMinutes),
    startsAt,
  };
}

/**
 * Important-only event detection. The very first observation is always
 * silent (launching the app mid-window must not shout), and minute-by-minute
 * countdown decay never re-triggers: each threshold fires once per class as
 * the value crosses it.
 */
export function autoCapsuleEvent(
  previous: CapsuleTick | null,
  current: CapsuleTick,
): CapsuleEvent | null {
  if (previous === null) return null;

  if (current.kind === "in-class") {
    return previous.kind !== "in-class" || previous.clave !== current.clave
      ? "class-start"
      : null;
  }

  if (current.kind === "upcoming") {
    const minutes = current.minutesUntil ?? Number.POSITIVE_INFINITY;
    const wasInWindow = (
      candidate: CapsuleTick | null,
      limit: number,
    ): boolean =>
      candidate?.kind === "upcoming" &&
      (candidate.minutesUntil ?? Number.POSITIVE_INFINITY) <= limit;

    if (minutes <= 1 && !wasInWindow(previous, 1)) return "one-minute";
    if (minutes <= 60 && !wasInWindow(previous, 60)) return "one-hour";
  }

  return null;
}
