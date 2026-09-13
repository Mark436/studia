import { useCallback, useEffect, useState } from "react";
import { DevTestEnvironment } from "@/lib/devtest/environment";
import {
  getSetting,
  removeSetting,
  setSetting,
  SETTING_DEV_CONFIG,
  SETTING_DEV_MODE_ENABLED,
  SETTING_DEV_UNLOCKED,
} from "@/lib/storage/settingsStore";
import type { DevConfig } from "./types";
import { EMPTY_DEV_CONFIG } from "./types";
import { isDevBuild } from "./config";

export interface DevToolsController {
  config: DevConfig;
  // Single visibility flag: dev builds default to true, production starts
  // hidden and unlocks via the tap gesture. Closing persists an explicit
  // "false" so the panel stays hidden across reloads until re-enabled.
  enabled: boolean;
  loaded: boolean;
  updateConfig: (updater: (previous: DevConfig) => DevConfig) => void;
  resetConfig: () => void;
  enable: () => void;
  disable: () => void;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseDevConfig(raw: string | null): DevConfig {
  if (!raw) return EMPTY_DEV_CONFIG;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return EMPTY_DEV_CONFIG;

    return {
      toastDurationMs: toPositiveNumber(
        parsed.toastDurationMs,
        EMPTY_DEV_CONFIG.toastDurationMs,
      ),
    };
  } catch {
    return EMPTY_DEV_CONFIG;
  }
}

function toPositiveNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : fallback;
}

async function saveDevConfig(config: DevConfig): Promise<void> {
  await setSetting(SETTING_DEV_CONFIG, JSON.stringify(config));
}

export function useDevConfig(): DevToolsController {
  const [config, setConfig] = useState<DevConfig>(EMPTY_DEV_CONFIG);
  const [enabled, setEnabled] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const env = DevTestEnvironment;

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      let raw: string | null = null;
      let enabledRaw: string | null = null;

      try {
        raw = await getSetting(SETTING_DEV_CONFIG);
      } catch {
        raw = null;
      }
      try {
        enabledRaw = await getSetting(SETTING_DEV_MODE_ENABLED);
      } catch {
        enabledRaw = null;
      }
      if (enabledRaw === null) {
        // Migration: inherit the previous unlock flag when present.
        try {
          enabledRaw = await getSetting(SETTING_DEV_UNLOCKED);
        } catch {
          enabledRaw = null;
        }
      }

      if (cancelled) return;

      const parsed = parseDevConfig(raw);
      setConfig(parsed);
      // Unset resolves per build type: dev builds show the panel, production
      // keeps it hidden until the tap gesture enables it.
      const shouldEnable = enabledRaw === null ? isDevBuild() : enabledRaw === "true";
      setEnabled(shouldEnable);
      if (shouldEnable) {
        env.activate();
      }
      setLoaded(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [env]);

  // Persist config on every post-load config change.
  useEffect(() => {
    if (!loaded) return;
    void saveDevConfig(config).catch((error: unknown) => {
      console.warn("No se pudo guardar la configuración de desarrollo.", error);
    });
  }, [config, loaded]);

  const updateConfig = useCallback(
    (updater: (previous: DevConfig) => DevConfig) => {
      setConfig(updater);
    },
    [],
  );

  const resetConfig = useCallback(() => {
    setConfig(EMPTY_DEV_CONFIG);
    env.reset();
    void removeSetting(SETTING_DEV_CONFIG).catch((error: unknown) => {
      console.warn("No se pudo borrar la configuración de desarrollo.", error);
    });
  }, [env]);

  const enable = useCallback(() => {
    setEnabled(true);
    env.activate();
    void setSetting(SETTING_DEV_MODE_ENABLED, "true").catch(() => undefined);
  }, [env]);

  // Closing keeps the saved DevConfig (it re-applies on the next unlock) but
  // pauses all simulation immediately: mock state is destroyed and the real
  // API / clock are restored.
  const disable = useCallback(() => {
    setEnabled(false);
    env.deactivate();
    void setSetting(SETTING_DEV_MODE_ENABLED, "false").catch(() => undefined);
  }, [env]);

  return { config, enabled, loaded, updateConfig, resetConfig, enable, disable };
}