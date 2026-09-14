import { useEffect, useRef } from "react";
import { addDays, isSameDay } from "../utils";

interface DayDotsProps {
  selectedDate: Date;
  now: Date;
  onSelectDate: (date: Date) => void;
}

const WEEKDAY_FORMATTER = new Intl.DateTimeFormat("es-MX", {
  weekday: "short",
});
const DATE_FORMATTER = new Intl.DateTimeFormat("es-MX", {
  weekday: "long",
  day: "numeric",
  month: "long",
});

/** Days rendered to either side of the selected one (scrollable strip). */
const SIDE_DAYS = 14;

/**
 * Day navigation as a horizontally scrollable strip of circles. Only ~3 are
 * visible at once, and the selected day is always centered; changing the day
 * slides the strip smoothly so the new center appears. Works by touch swipe
 * (native horizontal scroll) and by tapping a visible circle. The strip is
 * long (a month-ish window) so it feels like a real carousel.
 */
export function DayDots({
  selectedDate,
  now,
  onSelectDate,
}: DayDotsProps) {
  const stripRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<HTMLButtonElement>(null);

  const days = Array.from({ length: SIDE_DAYS * 2 + 1 }, (_, index) =>
    addDays(selectedDate, index - SIDE_DAYS),
  );

  const centerSelected = () => {
    const strip = stripRef.current;
    const selected = selectedRef.current;
    if (!strip || !selected) return;

    const left =
      selected.offsetLeft - (strip.clientWidth - selected.offsetWidth) / 2;
    strip.scrollTo({ left, behavior: "smooth" });
  };

  // Double rAF so the centering runs after layout settles, both on mount
  // (center on the initial/today date) and whenever the selected day changes.
  useEffect(() => {
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(centerSelected);
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
  }, [selectedDate]);

  return (
    <div
      ref={stripRef}
      role="group"
      aria-label="Cambiar día del horario"
      className="relative flex max-w-dropdown-sm snap-x snap-proximity items-center gap-3 overflow-x-auto rounded-full bg-surface/70 px-2 py-1 shadow-sm ring-1 ring-outline-variant/70 scroll-smooth [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
    >
      {days.map((date, index) => {
        const isSelected = index === SIDE_DAYS;
        const isToday = isSameDay(date, now);
        const ariaLabel = formatAria(date, isSelected, isToday);
        return (
          <button
            key={date.toDateString()}
            ref={isSelected ? selectedRef : undefined}
            type="button"
            aria-label={ariaLabel}
            aria-pressed={isSelected}
            onClick={() => onSelectDate(date)}
            className={`flex h-10 w-10 shrink-0 snap-center flex-col items-center justify-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
              isSelected
                ? "bg-primary text-on-primary"
                : "bg-primary-container/60 text-on-surface-variant hover:bg-primary-container"
            }`}
          >
            <span className="text-[9px] font-semibold uppercase leading-none">
              {weekdayShort(date)}
            </span>
            <span className="text-sm font-bold leading-tight tabular-nums">
              {date.getDate()}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function weekdayShort(date: Date): string {
  return capitalize(WEEKDAY_FORMATTER.format(date).replace(".", ""));
}

function formatAria(date: Date, isSelected: boolean, isToday: boolean): string {
  const label = capitalize(DATE_FORMATTER.format(date));
  const todayNote = isToday ? " hoy" : "";
  return isSelected
    ? `${label}, día seleccionado${todayNote}.`
    : `${label}${todayNote}. Toque para ver este día.`;
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
