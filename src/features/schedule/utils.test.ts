import { describe, expect, it } from "vitest";
import type { ClassMeeting } from "./types";
import {
  FREE_GAP_MIN_MINUTES,
  dateForWeekday,
  formatFreeDuration,
  formatMinutes,
  formatProfessorLabel,
  formatRelativeTime,
  freeMinutesBetween,
  getCurrentClass,
  getFreeGaps,
  getNextClass,
  getNextClassNote,
  getVisibleClasses,
  minutesOf,
  parseMinutes,
  shortenSubjectName,
} from "./utils";

function meeting(partial: Partial<ClassMeeting>): ClassMeeting {
  return {
    clave: "X",
    subjectName: "Materia",
    classroom: "",
    professor: "",
    weekday: 1,
    startMinutes: 600,
    endMinutes: 660,
    ...partial,
  };
}

// Monday 2026-08-24 at 10:00 local time.
function at(minutes: number): Date {
  const date = new Date(2026, 7, 24, Math.floor(minutes / 60), minutes % 60);
  return date;
}

describe("formatRelativeTime", () => {
  it("formats hours, minutes and combinations", () => {
    expect(formatRelativeTime(60)).toBe("1 hr");
    expect(formatRelativeTime(20)).toBe("20 min");
    expect(formatRelativeTime(80)).toBe("1 hr y 20 min");
    expect(formatRelativeTime(125)).toBe("2 hr y 5 min");
    expect(formatRelativeTime(90)).toBe("1 hr y 30 min");
    expect(formatRelativeTime(1)).toBe("1 min");
  });

  it("never emits zero units or plural hours", () => {
    expect(formatRelativeTime(120)).toBe("2 hr");
    expect(formatRelativeTime(61)).toBe("1 hr y 1 min");
  });

  it("returns empty for zero and negative values", () => {
    expect(formatRelativeTime(0)).toBe("");
    expect(formatRelativeTime(-15)).toBe("");
  });
});

describe("getNextClassNote", () => {
  const subject = meeting({ startMinutes: 600 });

  it("shows a relative countdown while positive", () => {
    expect(getNextClassNote(subject, 520)).toBe("1 hr y 20 min");
  });

  it('shows "Empieza pronto" at the exact start minute', () => {
    expect(getNextClassNote(subject, 600)).toBe("Empieza pronto");
  });

  it("falls back to the scheduled time after the start has passed", () => {
    expect(getNextClassNote(subject, 605)).toBe("Empieza a las 10:00");
  });
});

describe("class selection around the exact start minute", () => {
  const day = [
    meeting({ clave: "A", startMinutes: 600, endMinutes: 660 }),
    meeting({ clave: "B", startMinutes: 700, endMinutes: 730 }),
  ];

  it("announces the class as next at its exact start minute", () => {
    const now = at(600);
    expect(getCurrentClass(day, now)).toBeNull();
    expect(getNextClass(day, now)?.clave).toBe("A");
  });

  it("marks it as current from the following minute", () => {
    const now = at(601);
    expect(getCurrentClass(day, now)?.clave).toBe("A");
    expect(getNextClass(day, now)?.clave).toBe("B");
  });

  it("keeps later classes visible until they finish", () => {
    const visible = getVisibleClasses(day, at(705), true);
    expect(visible.map((m) => m.clave)).toEqual(["B"]);
  });
});

describe("freeMinutesBetween", () => {
  it("counts the free minutes between the previous end and the next start", () => {
    expect(freeMinutesBetween(660, 800)).toBe(140);
    expect(freeMinutesBetween(660, 675)).toBe(15);
  });

  it("never reports negative gaps for overlapping meetings", () => {
    expect(freeMinutesBetween(690, 660)).toBe(0);
    expect(freeMinutesBetween(700, 700)).toBe(0);
  });
});

describe("formatFreeDuration", () => {
  it("formats hours, minutes and short readings", () => {
    expect(formatFreeDuration(70)).toBe("1h 10m");
    expect(formatFreeDuration(120)).toBe("2h");
    expect(formatFreeDuration(45)).toBe("45m");
    expect(formatFreeDuration(0)).toBe("");
  });
});

describe("getFreeGaps", () => {
  const day = [
    meeting({ clave: "A", startMinutes: 480, endMinutes: 600 }),
    meeting({ clave: "B", startMinutes: 615, endMinutes: 675 }),
    meeting({ clave: "C", startMinutes: 675, endMinutes: 735 }),
    meeting({ clave: "D", startMinutes: 840, endMinutes: 900 }),
  ];

  it("surfaces only gaps meeting the default 15-minute floor, in order", () => {
    expect(getFreeGaps(day)).toEqual([
      { fromMinutes: 600, toMinutes: 615, freeMinutes: 15 },
      { fromMinutes: 735, toMinutes: 840, freeMinutes: 105 },
    ]);
  });

  it("skips overlapping meetings entirely", () => {
    const overlapping = [
      meeting({ clave: "A", startMinutes: 480, endMinutes: 600 }),
      meeting({ clave: "B", startMinutes: 540, endMinutes: 620 }),
    ];
    expect(getFreeGaps(overlapping)).toEqual([]);
  });

  it("honors a custom minimum threshold", () => {
    expect(getFreeGaps(day, 120)).toEqual([]);
    expect(getFreeGaps(day, 100)).toEqual([
      { fromMinutes: 735, toMinutes: 840, freeMinutes: 105 },
    ]);
  });

  it("uses 15 minutes as the default threshold", () => {
    expect(FREE_GAP_MIN_MINUTES).toBe(15);
  });
});

describe("minutes helpers", () => {
  it("formats padded times", () => {
    expect(formatMinutes(605)).toBe("10:05");
    expect(formatMinutes(0)).toBe("00:00");
  });

  it("parses HH:MM inputs", () => {
    expect(parseMinutes("10:05")).toBe(605);
    expect(parseMinutes(" 9:59 ")).toBe(599);
    expect(parseMinutes("24:00")).toBeNull();
    expect(parseMinutes("10:60")).toBeNull();
    expect(parseMinutes("10")).toBeNull();
  });

  it("computes minutes-of-day", () => {
    expect(minutesOf(at(605))).toBe(605);
  });
});

describe("dateForWeekday", () => {
  // Monday 2026-08-24.
  const monday = at(600);

  it("stays on the same day when it already matches", () => {
    const result = dateForWeekday(monday, 1);
    expect(result.getDay()).toBe(1);
    expect(result.getDate()).toBe(24);
  });

  it("moves forward inside the same week", () => {
    expect(dateForWeekday(monday, 6).getDate()).toBe(29); // Saturday
  });
});

describe("shortenSubjectName", () => {
  it("returns short names unchanged", () => {
    expect(shortenSubjectName("Inglés")).toBe("Inglés");
    expect(shortenSubjectName("Contabilidad")).toBe("Contabilidad");
    expect(shortenSubjectName("Filosofía")).toBe("Filosofía");
  });

  it("reduces long multi-word names to leading words under the char cap", () => {
    expect(shortenSubjectName("Fundamentos de Programación")).toBe("Fundamentos");
    expect(shortenSubjectName("Programación Orientada a Objetos")).toBe("Programación");
    expect(shortenSubjectName("Ingeniería en Sistemas Computacionales")).toBe("Ingeniería");
  });

  it("trims whitespace", () => {
    expect(shortenSubjectName("  Inglés  ")).toBe("Inglés");
  });
});

describe("formatProfessorLabel", () => {
  it("returns the full name when no comma is present", () => {
    expect(formatProfessorLabel("García López")).toBe("García López");
  });

  it("extracts surnames before the comma", () => {
    expect(formatProfessorLabel("García López, Juan")).toBe("García López");
  });

  it("returns null for empty, blank or masked values", () => {
    expect(formatProfessorLabel("")).toBeNull();
    expect(formatProfessorLabel("   ")).toBeNull();
    expect(formatProfessorLabel("*")).toBeNull();
  });

  it("trims whitespace around the returned value", () => {
    expect(formatProfessorLabel("  García,  Juan  ")).toBe("García");
  });
});
