// Where one-shot academic events (new grades, new debt, progress gain)
// surface: through the persistent context capsule or as classic toasts.
export type NotificationChannel = "capsule" | "toast";
export const DEFAULT_NOTIFICATION_CHANNEL: NotificationChannel = "capsule";

// Built-in hold time before a long-press activates subject-card editing.
// The web platform exposes no OS-specific long-press threshold, so one value
// rules every device; 550 ms sits close to common native defaults.
export const DEFAULT_LONG_PRESS_MS = 550;

// How long the context capsule stays expanded after an automatic pulse.
export const DEFAULT_CAPSULE_COLLAPSE_MS = 1500;

// Real, always-on user preferences. These used to live inside DevConfig and
// only applied while the dev panel was enabled; they are now first-class
// settings that apply regardless of dev mode. Simulated/developer overrides
// (clock, materias, grades, debts) stay in DevConfig.
export interface UserSettings {
  notificationChannel: NotificationChannel;
  capsuleCollapseMs: number;
  longPressDurationMs: number;
}

export const DEFAULT_USER_SETTINGS: UserSettings = {
  notificationChannel: DEFAULT_NOTIFICATION_CHANNEL,
  capsuleCollapseMs: DEFAULT_CAPSULE_COLLAPSE_MS,
  longPressDurationMs: DEFAULT_LONG_PRESS_MS,
};

const NOTIFICATION_CHANNELS: readonly NotificationChannel[] = [
  "capsule",
  "toast",
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toPositiveNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : fallback;
}

function toEnum<T extends string>(
  value: unknown,
  values: readonly T[],
  fallback: T,
): T {
  return typeof value === "string" && values.includes(value as T)
    ? (value as T)
    : fallback;
}

export function parseUserSettings(raw: string | null): UserSettings {
  if (!raw) return DEFAULT_USER_SETTINGS;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return DEFAULT_USER_SETTINGS;

    return {
      notificationChannel: toEnum(
        parsed.notificationChannel,
        NOTIFICATION_CHANNELS,
        DEFAULT_USER_SETTINGS.notificationChannel,
      ),
      capsuleCollapseMs: toPositiveNumber(
        parsed.capsuleCollapseMs,
        DEFAULT_USER_SETTINGS.capsuleCollapseMs,
      ),
      longPressDurationMs: toPositiveNumber(
        parsed.longPressDurationMs,
        DEFAULT_USER_SETTINGS.longPressDurationMs,
      ),
    };
  } catch {
    return DEFAULT_USER_SETTINGS;
  }
}
