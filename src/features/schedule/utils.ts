import type { ClassMeeting } from "./types";

export interface ClassProgress {
  percent: number;
  elapsedMinutes: number;
  remainingMinutes: number;
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** Date within `from`'s week (Sun-based) matching the given weekday 1-6. */
export function dateForWeekday(from: Date, weekday: number): Date {
  const delta = (weekday - from.getDay() + 7) % 7;
  const date = new Date(from);
  date.setDate(date.getDate() + delta);
  return date;
}

export function addDays(date: Date, amount: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

export function minutesOf(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

/** Classroom for the capsule pill ("LB-24"); null when masked/absent. */
export function formatClassroomLabel(classroom: string): string | null {
  const code = classroom.trim();
  if (code === "" || code === "*") return null;
  return code;
}

/**
 * Subject name sized for the collapsed capsule's short line. Names that fit
 * fully are kept as-is; longer multi-word names shrink to the leading words
 * until the cap holds (single lines never wrap, so the pill stays compact).
 * `text-xs` General Sans 500 runs roughly 6.5–7 px/char against the ~105 px
 * line's reserved width, which makes 12 chars the verified comfort zone.
 */
export const CAPSULE_SUBJECT_FULL_CHARS = 12;

export function shortenSubjectName(name: string): string {
  const cleaned = name.trim().replace(/\s+/g, " ");
  if (cleaned.length <= CAPSULE_SUBJECT_FULL_CHARS) return cleaned;

  const words = cleaned.split(" ");
  let result = cleaned;
  while (result.length > CAPSULE_SUBJECT_FULL_CHARS && words.length > 1) {
    words.pop();
    result = words.join(" ");
  }
  return result;
}

/**
 * Professor label for the expanded capsule. When the API stores "Apellidos,
 * Nombre" the comma rule returns just the surnames; otherwise the full name
 * keeps the single-line capsule compact. Null when absent/masked.
 */
export function formatProfessorLabel(professor: string): string | null {
  const name = professor.trim();
  if (name === "" || name === "*") return null;
  const comma = name.indexOf(",");
  return comma === -1 ? name : name.slice(0, comma).trim();
}

export function getScheduleForDay<T extends ClassMeeting>(
  meetings: T[],
  date: Date,
): T[] {
  return meetings
    .filter((meeting) => meeting.weekday === date.getDay())
    .sort((a, b) => a.startMinutes - b.startMinutes);
}

export function getCurrentClass<T extends ClassMeeting>(
  dayMeetings: T[],
  now: Date,
): T | null {
  const minutes = minutesOf(now);

  return (
    dayMeetings.find(
      (meeting) => minutes > meeting.startMinutes && minutes < meeting.endMinutes,
    ) ?? null
  );
}

export function getNextClass<T extends ClassMeeting>(
  dayMeetings: T[],
  now: Date,
): T | null {
  const minutes = minutesOf(now);

  return dayMeetings.find((meeting) => meeting.startMinutes >= minutes) ?? null;
}

export function getVisibleClasses<T extends ClassMeeting>(
  dayMeetings: T[],
  now: Date,
  isToday: boolean,
): T[] {
  if (!isToday) {
    return dayMeetings;
  }
  const minutes = minutesOf(now);

  return dayMeetings.filter((meeting) => meeting.endMinutes > minutes);
}

export function getClassProgress(
  meeting: ClassMeeting,
  now: Date,
): ClassProgress {
  const total = meeting.endMinutes - meeting.startMinutes;
  const elapsed = clamp(minutesOf(now) - meeting.startMinutes, 0, total);

  return {
    percent: Math.round((elapsed / total) * 100),
    elapsedMinutes: elapsed,
    remainingMinutes: total - elapsed,
  };
}

export function formatMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;

  return `${String(hours).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

// Inverse of formatMinutes for "HH:MM" inputs; null when out of range.
export function parseMinutes(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (match === null) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;

  return hours * 60 + minutes;
}

// Compact countdown for positive minute deltas only: zero units are omitted
// and units join with " y " ("1 hr", "20 min", "1 hr y 20 min"). Values <= 0
// are the caller's responsibility ("Empieza pronto" at zero).
export function formatRelativeTime(startsInMinutes: number): string {
  if (startsInMinutes <= 0) return "";

  const hours = Math.floor(startsInMinutes / 60);
  const minutes = startsInMinutes % 60;
  const parts: string[] = [];

  if (hours > 0) parts.push(`${hours} hr`);
  if (minutes > 0) parts.push(`${minutes} min`);

  return parts.join(" y ");
}

// Note shown on the next-class card. Zero means the class reaches its start
// minute right now; negative never happens with getNextClass but falls back
// to the scheduled time instead of showing a wrong countdown.
export function getNextClassNote(
  meeting: ClassMeeting,
  minutesNow: number,
): string {
  const startsIn = meeting.startMinutes - minutesNow;

  if (startsIn === 0) return "Empieza pronto";
  if (startsIn > 0) return formatRelativeTime(startsIn);

  return `Empieza a las ${formatMinutes(meeting.startMinutes)}`;
}

export interface FreeGap {
  /** Minute the gap starts (end of the preceding class). */
  fromMinutes: number;
  /** Minute the gap ends (start of the following class). */
  toMinutes: number;
  freeMinutes: number;
}

/** Minimum gap (minutes) before the day view surfaces a "libres" card. */
export const FREE_GAP_MIN_MINUTES = 15;

/** Free time between the previous class ending and the next one starting. */
export function freeMinutesBetween(
  previousEndMinutes: number,
  nextStartMinutes: number,
): number {
  return Math.max(0, nextStartMinutes - previousEndMinutes);
}

/** Compact duration reading: "1h 10m", "2h", "45m"; "" at zero. */
export function formatFreeDuration(minutes: number): string {
  if (minutes <= 0) return "";

  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;

  if (hours > 0 && rest > 0) return `${hours}h ${rest}m`;
  if (hours > 0) return `${hours}h`;
  return `${rest}m`;
}

/** Consecutive-meeting gaps long enough to matter, in reading order. */
export function getFreeGaps(
  meetings: readonly ClassMeeting[],
  minGapMinutes: number = FREE_GAP_MIN_MINUTES,
): FreeGap[] {
  const gaps: FreeGap[] = [];

  for (let i = 1; i < meetings.length; i++) {
    const previous = meetings[i - 1];
    const current = meetings[i];
    const free = freeMinutesBetween(previous.endMinutes, current.startMinutes);
    if (free >= minGapMinutes) {
      gaps.push({
        fromMinutes: previous.endMinutes,
        toMinutes: current.startMinutes,
        freeMinutes: free,
      });
    }
  }

  return gaps;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
