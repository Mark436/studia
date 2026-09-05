import { getValue, putValue, removeValue, STORE_SETTINGS } from "./db";

export const SETTING_REMEMBERED_USERNAME = "rememberedUsername";
// Whether the app stores the control number to prefill future logins.
// Defaults to "false"; the user opts in via Ajustes to enable remembering.
export const SETTING_REMEMBER_USERNAME = "rememberUsername";
export const SETTING_ADEUDO_ALERTS_OPT_IN = "adeudoAlertsOptIn";
// JSON state of the reinscription-date alerts: which stages have fired for
// which date (see lib/notifications/reinscripcion.ts).
export const SETTING_REINS_ALERTS_STATE = "reinsAlertsState";
export const SETTING_GRADES_SEEN = "gradesSeen";
export const SETTING_LAST_REAUTH_PROMPT_DATE = "lastReAuthPromptDate";
export const SETTING_LAST_LOGIN_AT = "lastLoginAt";
export const SETTING_DEV_CONFIG = "devConfig";
// Legacy flag from the previous unlock-only flow; read once for migration.
export const SETTING_DEV_UNLOCKED = "devUnlocked";
export const SETTING_DEV_MODE_ENABLED = "devModeEnabled";
export const SETTING_SCHEDULE_EDITS = "scheduleEdits";
// First-class, always-on user preferences (see features/settings). Stored as
// a single JSON blob.
export const SETTING_USER_SETTINGS = "userSettings";

// Settings hold non-sensitive values only. The password must never be stored.
export async function getSetting(key: string): Promise<string | null> {
  const value = await getValue<string>(STORE_SETTINGS, key);
  return value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await putValue(STORE_SETTINGS, { key, value });
}

export async function removeSetting(key: string): Promise<void> {
  await removeValue(STORE_SETTINGS, key);
}
