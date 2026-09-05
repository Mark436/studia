import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import type {
  Alumno,
  ApiErrorKind,
  Aviso,
  Credenciales,
} from "@/lib/api/client";
import { ApiError, fetchAppData } from "@/lib/api/client";
import { notifyNewAdeudos } from "@/lib/notifications/adeudos";
import {
  notifyCareerProgress,
  progressDelta,
} from "@/lib/notifications/progress";
import {
  notifyNewReinscripcion,
  type ReinscripcionAlertOutcome,
  type ReinscripcionAlertKind,
} from "@/lib/notifications/reinscripcion";
import { loadAppData, saveAppData } from "@/lib/storage/appDataStore";
import {
  loadGradeTracking,
  mergeGradeTracking,
  saveGradeTracking,
} from "@/lib/storage/gradeTracking";
import { clearAllStores } from "@/lib/storage/db";
import {
  getSetting,
  removeSetting,
  setSetting,
  SETTING_GRADES_SEEN,
  SETTING_LAST_LOGIN_AT,
  SETTING_REMEMBERED_USERNAME,
  SETTING_REMEMBER_USERNAME,
} from "@/lib/storage/settingsStore";
import type { AuthStatus } from "./auth-context";
import { AuthContext } from "./auth-context";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("restoring");
  const [pendingAuth, setPendingAuth] = useState(false);
  const [alumno, setAlumno] = useState<Alumno | null>(null);
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const [errorKind, setErrorKind] = useState<ApiErrorKind | null>(null);
  const [hasCredentials, setHasCredentials] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [unseenGradeChanges, setUnseenGradeChanges] = useState(false);
  const [gradeChangeCount, setGradeChangeCount] = useState(0);
  const [adeudoAlertCount, setAdeudoAlertCount] = useState(0);
  const [reinscripcionAlertCount, setReinscripcionAlertCount] = useState(0);
  const [lastReinscripcionAlert, setLastReinscripcionAlert] = useState<
    ReinscripcionAlertKind | null
  >(null);
  const [progressAlertCount, setProgressAlertCount] = useState(0);
  const [lastProgressGain, setLastProgressGain] = useState<number | null>(null);
  const [rememberedUsername, setRememberedUsername] = useState<string | null>(
    null,
  );

  // Session credentials live in volatile memory only (never in any storage),
  // so an in-session refresh can reuse them. Cleared on logout. See docs/api.md.
  const credentialsRef = useRef<Credenciales | null>(null);
  const refreshingRef = useRef(false);
  // Synchronous mirror so login() can detect a resume (re-auth inside an
  // authenticated session) without adding `status` to its dependencies.
  const statusRef = useRef(status);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  // Restore the last valid snapshot and the remembered username before any
  // network activity. Cached data hydrates the session; without it we fall
  // back to the login screen.
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      let cached: Awaited<ReturnType<typeof loadAppData>> = null;
      let username: string | null = null;
      let gradesSeen: string | null = null;

      try {
        cached = await loadAppData();
      } catch {
        cached = null;
      }
      try {
        username = await getSetting(SETTING_REMEMBERED_USERNAME);
      } catch {
        username = null;
      }
      try {
        gradesSeen = await getSetting(SETTING_GRADES_SEEN);
      } catch {
        gradesSeen = null;
      }

      if (cancelled) return;

      if (cached) {
        setAlumno(cached.alumno);
        setAvisos(cached.avisos);
      }
      setRememberedUsername(username);
      // Missing setting counts as seen: a fetch without changes never writes it.
      setUnseenGradeChanges(gradesSeen === "false");
      setStatus((current) =>
        current === "restoring"
          ? cached
            ? "authenticated"
            : "unauthenticated"
          : current,
      );
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // A fetch that reveals new or changed grades re-arms the conditional home
  // for the next app start; the first fetch only sets the baseline. Event
  // counters feed one-shot UI notifications (toasts) in the shell.
  const handlePersistResult = useCallback(
    (result: {
      hasChanges: boolean;
      newAdeudo: boolean;
      progressGain: number;
      reinscripcionAlert: ReinscripcionAlertOutcome;
    }) => {
      if (result.hasChanges) {
        setUnseenGradeChanges(true);
        setGradeChangeCount((count) => count + 1);
        void setSetting(SETTING_GRADES_SEEN, "false").catch(() => undefined);
      }
      if (result.newAdeudo) {
        setAdeudoAlertCount((count) => count + 1);
      }
      if (result.progressGain > 0) {
        setLastProgressGain(result.progressGain);
        setProgressAlertCount((count) => count + 1);
      }
      if (result.reinscripcionAlert !== "none") {
        setLastReinscripcionAlert(result.reinscripcionAlert);
        setReinscripcionAlertCount((count) => count + 1);
      }
    },
    [],
  );

  const login = useCallback(async (user: string, pass: string) => {
    // Re-auth inside an authenticated session (ReAuthSheet) must never flip
    // the global status: a failed attempt keeps the cached session alive and
    // the error surfaces inside the sheet only.
    const resuming = statusRef.current === "authenticated";
    if (!resuming) {
      setStatus("authenticating");
      setErrorKind(null);
    }
    setPendingAuth(true);
    try {
      const data = await fetchAppData({ user, pass });
      credentialsRef.current = { user, pass };
      const previousAlumno = await loadPreviousAlumno();
      setHasCredentials(true);
      setAlumno(data.alumno);
      setAvisos(data.avisos);
      setErrorKind(null);
      setStatus("authenticated");
      // Marks when this session's credentials were entered; the shell uses
      // it for the stale-data nudge (~23h). Refreshes never rewrite it.
      void setSetting(SETTING_LAST_LOGIN_AT, new Date().toISOString()).catch(
        () => undefined,
      );
      void persistSession(previousAlumno, data.alumno, data.avisos, user).then(
        handlePersistResult,
      );
      return true;
    } catch (error) {
      setErrorKind(error instanceof ApiError ? error.kind : "unknown");
      if (!resuming) setStatus("unauthenticated");
      return false;
    } finally {
      setPendingAuth(false);
    }
  }, [handlePersistResult]);

  // Same load path as login (fetch → persist → adeudo alert) but without the
  // "authenticating" status: cached data stays visible while refreshing and a
  // failure never deletes it.
  const refresh = useCallback(async () => {
    const credentials = credentialsRef.current;
    if (!credentials || refreshingRef.current) return false;

    refreshingRef.current = true;
    setRefreshing(true);
    try {
      const data = await fetchAppData(credentials);
      const previousAlumno = await loadPreviousAlumno();
      setAlumno(data.alumno);
      setAvisos(data.avisos);
      void persistSession(
        previousAlumno,
        data.alumno,
        data.avisos,
        credentials.user,
      ).then(handlePersistResult);
      return true;
    } catch {
      return false;
    } finally {
      refreshingRef.current = false;
      setRefreshing(false);
    }
  }, [handlePersistResult]);

  const markGradesSeen = useCallback(() => {
    setUnseenGradeChanges(false);
    void setSetting(SETTING_GRADES_SEEN, "true").catch(() => undefined);
  }, []);

  const logout = useCallback(() => {
    credentialsRef.current = null;
    setHasCredentials(false);
    setAlumno(null);
    setAvisos([]);
    setErrorKind(null);
    setRememberedUsername(null);
    setStatus("unauthenticated");
    void clearAllStores().catch((error: unknown) => {
      console.warn("No se pudo borrar el almacenamiento local.", error);
    });
  }, []);

  const value = useMemo(
    () => ({
      status,
      pendingAuth,
      alumno,
      avisos,
      errorKind,
      hasCredentials,
      refreshing,
      unseenGradeChanges,
      gradeChangeCount,
      adeudoAlertCount,
      reinscripcionAlertCount,
      lastReinscripcionAlert,
      lastProgressGain,
      progressAlertCount,
      rememberedUsername,
      login,
      refresh,
      markGradesSeen,
      logout,
    }),
    [
      status,
      pendingAuth,
      alumno,
      avisos,
      errorKind,
      hasCredentials,
      refreshing,
      unseenGradeChanges,
      gradeChangeCount,
      adeudoAlertCount,
      reinscripcionAlertCount,
      lastReinscripcionAlert,
      lastProgressGain,
      progressAlertCount,
      rememberedUsername,
      login,
      refresh,
      markGradesSeen,
      logout,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

async function loadPreviousAlumno(): Promise<Alumno | null> {
  try {
    return (await loadAppData())?.alumno ?? null;
  } catch {
    return null;
  }
}

// Persistence is fire-and-forget: a storage failure never blocks the session,
// and adeudo alerts compare against what was known before this fetch.
async function persistSession(
  previousAlumno: Alumno | null,
  alumno: Alumno,
  avisos: Aviso[],
  user: string,
): Promise<{
  hasChanges: boolean;
  newAdeudo: boolean;
  progressGain: number;
  reinscripcionAlert: ReinscripcionAlertOutcome;
}> {
  let hasChanges = false;
  try {
    const tracking = await loadGradeTracking();
    const merged = mergeGradeTracking(tracking, alumno.boleta.materias);
    hasChanges = merged.hasChanges;
    await saveGradeTracking(merged.tracking);
    await saveAppData({
      alumno,
      avisos,
      loadedAt: new Date().toISOString(),
    });
    // Remember the control number only if the user opted in; otherwise clear
    // it so future logins start blank. Default is "not remembered".
    const rememberRaw = await getSetting(SETTING_REMEMBER_USERNAME).catch(
      () => null,
    );
    if (rememberRaw === "true") {
      await setSetting(SETTING_REMEMBERED_USERNAME, user);
    } else {
      await removeSetting(SETTING_REMEMBERED_USERNAME);
    }
  } catch (error) {
    console.warn("No se pudieron guardar los datos localmente.", error);
  }
  await notifyNewAdeudos(previousAlumno, alumno);
  const progressGain = progressDelta(previousAlumno, alumno);
  await notifyCareerProgress(progressGain);
  // Same transition notifyNewAdeudos alerts on: no debt before, debt now.
  const newAdeudo =
    alumno.adeudos.tieneAdeudos && previousAlumno?.adeudos.tieneAdeudos !== true;
  const reinscripcionAlert = await notifyNewReinscripcion(
    previousAlumno,
    alumno,
  );
  return { hasChanges, newAdeudo, progressGain, reinscripcionAlert };
}
