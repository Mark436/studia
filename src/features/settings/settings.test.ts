import { describe, expect, it } from "vitest";
import {
  DEFAULT_USER_SETTINGS,
  parseUserSettings,
} from "./types";

describe("parseUserSettings", () => {
  it("returns defaults for empty or invalid input", () => {
    expect(parseUserSettings(null)).toEqual(DEFAULT_USER_SETTINGS);
    expect(parseUserSettings("")).toEqual(DEFAULT_USER_SETTINGS);
    expect(parseUserSettings("not json")).toEqual(DEFAULT_USER_SETTINGS);
  });

  it("parses a full valid settings blob", () => {
    const result = parseUserSettings(
      JSON.stringify({
        notificationChannel: "toast",
        capsuleCollapseMs: 2400,
        longPressDurationMs: 800,
      }),
    );
    expect(result).toEqual({
      notificationChannel: "toast",
      capsuleCollapseMs: 2400,
      longPressDurationMs: 800,
    });
  });

  it("falls back per-field for invalid values", () => {
    const result = parseUserSettings(
      JSON.stringify({
        notificationChannel: "bogus",
        capsuleCollapseMs: -5,
        longPressDurationMs: 0,
      }),
    );
    expect(result.notificationChannel).toBe(
      DEFAULT_USER_SETTINGS.notificationChannel,
    );
    expect(result.capsuleCollapseMs).toBe(
      DEFAULT_USER_SETTINGS.capsuleCollapseMs,
    );
    expect(result.longPressDurationMs).toBe(
      DEFAULT_USER_SETTINGS.longPressDurationMs,
    );
  });

  it("keeps known fields and defaults the rest when partially provided", () => {
    const result = parseUserSettings(JSON.stringify({ longPressDurationMs: 800 }));
    expect(result.longPressDurationMs).toBe(800);
    expect(result.notificationChannel).toBe(
      DEFAULT_USER_SETTINGS.notificationChannel,
    );
    expect(result.capsuleCollapseMs).toBe(
      DEFAULT_USER_SETTINGS.capsuleCollapseMs,
    );
  });
});