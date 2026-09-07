import { useCallback, useEffect, useState } from "react";
import {
  getSetting,
  setSetting,
  SETTING_DEV_CONFIG,
  SETTING_USER_SETTINGS,
} from "@/lib/storage/settingsStore";
import { DEFAULT_USER_SETTINGS, parseUserSettings } from "./types";
import type { UserSettings } from "./types";

export interface SettingsController {
  settings: UserSettings;
  loaded: boolean;
  update: (updater: (previous: UserSettings) => UserSettings) => void;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function useSettings(): SettingsController {
  const [settings, setSettings] = useState<UserSettings>(
    DEFAULT_USER_SETTINGS,
  );
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      let raw: string | null = null;
      try {
        raw = await getSetting(SETTING_USER_SETTINGS);
      } catch {
        raw = null;
      }

      if (cancelled) return;

      if (raw === null) {
        // Migration: the user-facing prefs previously lived in DevConfig.
        const migrated = await migrateFromDevConfig();
        setSettings(migrated);
        void persist(migrated).catch(() => undefined);
      } else {
        setSettings(parseUserSettings(raw));
      }
      setLoaded(true);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!loaded) return;
    void persist(settings).catch((error: unknown) => {
      console.warn("No se pudieron guardar los ajustes.", error);
    });
  }, [settings, loaded]);

  const update = useCallback((updater: (previous: UserSettings) => UserSettings) => {
    setSettings(updater);
  }, []);

  return { settings, loaded, update };
}

async function persist(settings: UserSettings): Promise<void> {
  await setSetting(SETTING_USER_SETTINGS, JSON.stringify(settings));
}

// One-time migration: pull the always-on preferences out of the legacy
// DevConfig blob (where they previously existed and only applied in dev mode).
// Missing or invalid values fall back to the built-in defaults.
async function migrateFromDevConfig(): Promise<UserSettings> {
  let raw: string | null = null;
  try {
    raw = await getSetting(SETTING_DEV_CONFIG);
  } catch {
    raw = null;
  }
  if (!raw) return DEFAULT_USER_SETTINGS;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return DEFAULT_USER_SETTINGS;

    return parseUserSettings(
      JSON.stringify({
        notificationChannel: parsed.notificationChannel,
        capsuleCollapseMs: parsed.capsuleCollapseMs,
        longPressDurationMs: parsed.longPressDurationMs,
      }),
    );
  } catch {
    return DEFAULT_USER_SETTINGS;
  }
}
