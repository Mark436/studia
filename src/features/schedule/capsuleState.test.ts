import { describe, expect, it } from "vitest";
import type { ResolvedMeeting } from "./types";
import {
  autoCapsuleEvent,
  buildCapsuleState,
  getNextClassInfo,
  toCapsuleTick,
} from "./capsuleState";

function meeting(overrides: Partial<ResolvedMeeting>): ResolvedMeeting {
  return {
    clave: "MAT101",
    subjectName: "Matemáticas",
    classroom: "LB-24",
    professor: "",
    weekday: 1,
    startMinutes: 10 * 60,
    endMinutes: 11 * 60,
    ...overrides,
  };
}

describe("buildCapsuleState", () => {
  const classes = [
    meeting({ clave: "A", subjectName: "Cálculo", startMinutes: 600, endMinutes: 680 }),
    meeting({ clave: "B", subjectName: "Redes", startMinutes: 780, endMinutes: 870 }),
  ];

  it("reports the class in progress with live progress", () => {
    const state = buildCapsuleState(classes, 640);
    expect(state.kind).toBe("in-class");
    if (state.kind !== "in-class") return;
    expect(state.subjectName).toBe("Cálculo");
    expect(state.classroom).toBe("LB-24");
    expect(state.remainingMinutes).toBe(40);
    expect(state.progressPercent).toBeCloseTo(50);
  });

  it("reports the next class between sessions", () => {
    const state = buildCapsuleState(classes, 700);
    expect(state.kind).toBe("upcoming");
    if (state.kind !== "upcoming") return;
    expect(state.clave).toBe("B");
    expect(state.classroom).toBe("LB-24");
    expect(state.minutesUntil).toBe(80);
  });

  it("reports done once every class ended", () => {
    expect(buildCapsuleState(classes, 900).kind).toBe("done");
  });

  it("reports empty without meetings", () => {
    expect(buildCapsuleState([], 600).kind).toBe("empty");
  });

  it("caps progress at 100 at the exact end minute", () => {
    const state = buildCapsuleState(classes, 680);
    expect(state.kind).toBe("upcoming");
  });
});

describe("autoCapsuleEvent", () => {
  it("is silent on first observation", () => {
    const tick = toCapsuleTick(buildCapsuleState([meeting({})], 590));
    expect(autoCapsuleEvent(null, tick)).toBeNull();
  });

  it("fires class-start when a class begins", () => {
    const before = toCapsuleTick(buildCapsuleState([meeting({})], 599));
    const after = toCapsuleTick(buildCapsuleState([meeting({})], 600));
    expect(autoCapsuleEvent(before, after)).toBe("class-start");
  });

  it("does not re-fire while the same class runs", () => {
    const running = toCapsuleTick(buildCapsuleState([meeting({})], 601));
    const later = toCapsuleTick(buildCapsuleState([meeting({})], 650));
    expect(autoCapsuleEvent(running, later)).toBeNull();
  });

  it("fires one-hour exactly when the countdown crosses 60 minutes", () => {
    const at61 = toCapsuleTick(buildCapsuleState(
      [meeting({ startMinutes: 721 })],
      660,
    ));
    const at60 = toCapsuleTick(buildCapsuleState(
      [meeting({ startMinutes: 720 })],
      660,
    ));
    expect(autoCapsuleEvent(at61, at60)).toBe("one-hour");

    const still60 = toCapsuleTick(buildCapsuleState(
      [meeting({ startMinutes: 719 })],
      659,
    ));
    expect(autoCapsuleEvent(at60, still60)).toBeNull();
  });

  it("fires one-minute when less than a minute remains", () => {
    const at2 = toCapsuleTick(buildCapsuleState(
      [meeting({ startMinutes: 662 })],
      660,
    ));
    const at1 = toCapsuleTick(buildCapsuleState(
      [meeting({ startMinutes: 661 })],
      660,
    ));
    expect(autoCapsuleEvent(at2, at1)).toBe("one-minute");
  });
});

describe("getNextClassInfo", () => {
  // Fixed dates: lunes 2026-08-24 and domingo 2026-08-30.
  const monday = new Date(2026, 7, 24, 20, 0);
  const sunday = new Date(2026, 7, 30, 20, 0);

  it("returns tomorrow's earliest class, ignoring other days", () => {
    const result = getNextClassInfo(
      [
        meeting({
          clave: "TARDE",
          subjectName: "Ética",
          weekday: 2,
          startMinutes: 15 * 60,
        }),
        meeting({
          clave: "TEMPRANO",
          subjectName: "Redes",
          weekday: 2,
          startMinutes: 9 * 60 + 30,
        }),
        meeting({
          clave: "HOY",
          subjectName: "Cálculo",
          weekday: 1,
          startMinutes: 8 * 60,
        }),
      ],
      monday,
    );

    expect(result).toEqual({
      weekday: 2,
      subjectName: "Redes",
      classroom: "LB-24",
      startsLabel: "09:30",
    });
  });

  it("looks further ahead when tomorrow has no classes", () => {
    const result = getNextClassInfo(
      [
        meeting({ subjectName: "Ética", weekday: 4, startMinutes: 600 }),
        meeting({ subjectName: "Redes", weekday: 3, startMinutes: 600 }),
      ],
      monday,
    );

    expect(result).toEqual({
      weekday: 3,
      subjectName: "Redes",
      classroom: "LB-24",
      startsLabel: "10:00",
    });
  });

  it("returns null when the week has no more classes", () => {
    expect(
      getNextClassInfo([meeting({ weekday: 1 })], monday),
    ).toBeNull();
  });

  it("wraps the week: Sunday evening points at Monday", () => {
    const result = getNextClassInfo(
      [meeting({ subjectName: "Cálculo", weekday: 1, startMinutes: 600 })],
      sunday,
    );

    expect(result).toEqual({
      weekday: 1,
      subjectName: "Cálculo",
      classroom: "LB-24",
      startsLabel: "10:00",
    });
  });
});
