import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { BottomNavigation } from "@/components/layout/BottomNavigation";
import { PageTransition } from "@/components/layout/PageTransition";
import { Spinner } from "@/components/ui/Spinner";
import { Toast } from "@/components/ui/Toast";
import type { ToastVariant } from "@/components/ui/toastVariants";
import { DEFAULT_TOAST_DURATION_MS } from "@/components/ui/toastVariants";
import { applyDevOverrides } from "@/features/devtools/applyDevOverrides";
import { useDevConfig } from "@/features/devtools/useDevConfig";
import { useSettings } from "@/features/settings/useSettings";
import { useAuth } from "@/features/auth/auth-context";
import { AuthProvider } from "@/features/auth/AuthProvider";
import { LoginPage } from "@/features/auth/LoginPage";
import { ReAuthSheet } from "@/features/auth/components/ReAuthSheet";
import { toDateKey } from "@/features/auth/utils";
import { GradesPage } from "@/features/grades/GradesPage";
import { shouldOpenGradesFirst } from "@/features/grades/utils";
import { NotificationsPage } from "@/features/notifications/NotificationsPage";
import { getNextClassInfo } from "@/features/schedule/capsuleState";
import { ScheduleStateProvider } from "@/features/schedule/ScheduleStateProvider";
import { useScheduleState } from "@/features/schedule/scheduleStateContext";
import { ScheduleCapsule } from "@/features/schedule/components/ScheduleCapsule";
import { SchedulePage } from "@/features/schedule/SchedulePage";
import { getScheduleForDay } from "@/features/schedule/utils";
import { AdeudoAlertsCard } from "@/features/student/components/AdeudoAlertsCard";
import { StudentPage } from "@/features/student/StudentPage";
import { SettingsSheet } from "@/features/settings/components/SettingsSheet";
import { useCurrentTime } from "@/lib/devtools/useCurrentTime";
import { formatAverage } from "@/lib/formatAverage";
import { useHorariosCheck } from "@/lib/useHorariosCheck";
import {
  parseEstadoChequeo,
  tocaAvisarTurnosReinscripcion,
} from "@/lib/busquedaHorarios";
import type {
  CapsuleNotification,
  NotificationDraft,
} from "@/lib/notifications/capsuleEvents";
import {
  CAPSULE_FLASH_LIFETIME_MS,
  toCapsuleNotification,
} from "@/lib/notifications/capsuleEvents";
import { REINSCRIPCION_ALERT_MESSAGES } from "@/lib/notifications/reinscripcion";
import { parseReinscripcionDate } from "@/lib/notifications/reinscripcion";
import { sendPushNotificationTest } from "@/lib/notifications/testPush";
import {
  getSetting,
  setSetting,
  SETTING_HORARIOS_CHECKS_STATE,
  SETTING_LAST_LOGIN_AT,
  SETTING_LAST_REAUTH_PROMPT_DATE,
} from "@/lib/storage/settingsStore";
import {
  CAREER_PROGRESS_TOAST_PREFIX,
  GRADE_CHANGES_TOAST,
  NEW_ADEUDO_TOAST,
  REFRESH_NUDGE_TOAST,
  TURNOS_REINSCRIPCION_NUDGE_TOAST,
} from "@/lib/toastMessages";
import { formatProgressDelta } from "@/lib/notifications/progress";
import { getHomeTab, NAV_ITEMS } from "./navigation";
import type { TabId } from "./navigation";

// A session older than this gets one gentle reminder per day suggesting a
// pull-to-refresh; the re-auth sheet itself only appears on demand.
const STALE_SESSION_NUDGE_MS = 23 * 60 * 60 * 1000;

const REINS_DATE_FORMATTER = new Intl.DateTimeFormat("es-MX", {
  day: "numeric",
  month: "long",
  year: "numeric",
});
const REINS_TIME_FORMATTER = new Intl.DateTimeFormat("es-MX", {
  hour: "numeric",
  minute: "2-digit",
});

function formatReinscripcionDate(fecha: Date): string {
  return `${REINS_DATE_FORMATTER.format(fecha)} a las ${REINS_TIME_FORMATTER.format(fecha)}`;
}

interface ActiveToast {
  id: number;
  message: string;
  variant: ToastVariant;
}

/** Persistent context capsule: mounted once for every authenticated tab. */
function ContextCapsule({
  collapseMs,
  notification,
}: {
  collapseMs: number;
  notification: CapsuleNotification | null;
}) {
  const { resolvedWeek } = useScheduleState();
  const now = useCurrentTime();

  const todayMeetings = useMemo(
    () => getScheduleForDay(resolvedWeek, now),
    [resolvedWeek, now],
  );
  const nextClassInfo = useMemo(
    () => getNextClassInfo(resolvedWeek, now),
    [resolvedWeek, now],
  );

  return (
    <ScheduleCapsule
      meetings={todayMeetings}
      now={now}
      nextClassInfo={nextClassInfo}
      notification={notification}
      autoCollapseMs={collapseMs}
    />
  );
}

function AuthenticatedShell() {
  const {
    alumno,
    hasCredentials,
    refresh,
    unseenGradeChanges,
    gradeChangeCount,
    adeudoAlertCount,
    reinscripcionAlertCount,
    lastReinscripcionAlert,
    lastProgressGain,
    progressAlertCount,
    rememberedUsername,
    logout,
  } = useAuth();
  const dev = useDevConfig();
  const [tab, setTab] = useState<TabId>(() =>
    getHomeTab(shouldOpenGradesFirst(alumno, unseenGradeChanges)),
  );
  const [reAuthOpen, setReAuthOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [toast, setToast] = useState<ActiveToast | null>(null);
  const toastIdRef = useRef(0);

  // Dev simulation is presentation-only: the virtual alumno feeds every
  // screen, while fetches and persistence keep using the real data. Overrides
  // pause while the dev panel is closed (enabled === false).
  const effectiveAlumno = useMemo(
    () =>
      alumno && dev.loaded && dev.enabled
        ? applyDevOverrides(alumno, dev.config)
        : alumno,
    [alumno, dev.loaded, dev.enabled, dev.config],
  );

  // Always-on user preferences (apply regardless of dev mode): they previously
  // lived in DevConfig and only took effect while the panel was enabled.
  const settingsCtrl = useSettings();
  const {
    notificationChannel,
    capsuleCollapseMs,
    longPressDurationMs,
  } = settingsCtrl.settings;

  // Dev-only toast test duration: applies only while the panel is enabled.
  const devActive = dev.loaded && dev.enabled;
  const toastDurationMs = devActive
    ? dev.config.toastDurationMs
    : DEFAULT_TOAST_DURATION_MS;

  const showToast = useCallback((message: string, variant: ToastVariant) => {
    toastIdRef.current += 1;
    setToast({ id: toastIdRef.current, message, variant });
  }, []);

  // Daily background check for calendar/prehorario availability: runs at
  // startup and on every foreground return (see useHorariosCheck). Resultados
  // relevantes se anuncian como toast para avisar al alumno sin depender de
  // que abra el modo dev.
  useHorariosCheck(alumno, result => {
    if (!result.mensaje) return;
    const variant: ToastVariant =
      result.fase === "buscar-prehorario" ? "success" : "neutral";
    showToast(result.mensaje, variant);
  });

  // Stale-data nudge: once the session is ~23h old, remind with a plain
  // toast suggesting a pull-to-refresh. The re-auth sheet is never pushed
  // automatically; it stays reachable through pull-to-refresh without
  // credentials. Consumption is once per calendar day.
  useEffect(() => {
    if (!alumno) return;

    let cancelled = false;

    void (async () => {
      let lastLoginAt: string | null = null;
      let lastNudgeDate: string | null = null;
      try {
        lastLoginAt = await getSetting(SETTING_LAST_LOGIN_AT);
      } catch {
        lastLoginAt = null;
      }
      try {
        lastNudgeDate = await getSetting(SETTING_LAST_REAUTH_PROMPT_DATE);
      } catch {
        lastNudgeDate = null;
      }

      const today = new Date();
      if (lastNudgeDate === toDateKey(today)) return;

      const startedAtMs =
        lastLoginAt === null ? Number.NaN : Date.parse(lastLoginAt);
      // Unknown start (first run after this change): nudge once; from then on
      // lastLoginAt exists and the 23h rule governs.
      const stale = Number.isFinite(startedAtMs)
        ? today.getTime() - startedAtMs >= STALE_SESSION_NUDGE_MS
        : true;
      if (!stale) return;

      // Si ya pasó la fecha de publicación de turnos de reinscripción, el
      // nudge lo menciona en lugar del mensaje genérico de datos viejos.
      let mensaje = REFRESH_NUDGE_TOAST;
      try {
        const estado = parseEstadoChequeo(
          await getSetting(SETTING_HORARIOS_CHECKS_STATE),
        );
        if (tocaAvisarTurnosReinscripcion(estado, today)) {
          mensaje = TURNOS_REINSCRIPCION_NUDGE_TOAST;
        }
      } catch {
        // Cualquier fallo de lectura mantiene el nudge genérico.
      }

      try {
        await setSetting(SETTING_LAST_REAUTH_PROMPT_DATE, toDateKey(today));
      } catch {
        // A storage failure should not block the nudge itself.
      }

      if (cancelled) return;
      showToast(mensaje, "neutral");
    })();

    return () => {
      cancelled = true;
    };
  }, [alumno, showToast]);

  // One-shot notifications from real fetch events. Counters start at zero and
  // only grow when a fetch detects the event after mount, so app startup,
  // cache restores, and baselines never trigger an announcement. The channel
  // decides where they surface: classic toasts or the persistent capsule.
  useEffect(() => {
    if (notificationChannel !== "toast") return;
    if (gradeChangeCount > 0) {
      showToast(GRADE_CHANGES_TOAST, "success");
    }
  }, [gradeChangeCount, showToast, notificationChannel]);

  useEffect(() => {
    if (notificationChannel !== "toast") return;
    if (adeudoAlertCount > 0) {
      showToast(NEW_ADEUDO_TOAST, "error");
    }
  }, [adeudoAlertCount, showToast, notificationChannel]);

  useEffect(() => {
    if (notificationChannel !== "toast") return;
    if (reinscripcionAlertCount > 0 && lastReinscripcionAlert !== null) {
      showToast(
        REINSCRIPCION_ALERT_MESSAGES[lastReinscripcionAlert],
        "neutral",
      );
    }
  }, [
    reinscripcionAlertCount,
    lastReinscripcionAlert,
    showToast,
    notificationChannel,
  ]);

  useEffect(() => {
    if (
      notificationChannel !== "toast" ||
      progressAlertCount <= 0 ||
      lastProgressGain === null ||
      lastProgressGain <= 0
    ) {
      return;
    }
    showToast(
      `${CAREER_PROGRESS_TOAST_PREFIX} ${formatProgressDelta(lastProgressGain)} en tu carrera.`,
      "success",
    );
  }, [
    progressAlertCount,
    lastProgressGain,
    showToast,
    notificationChannel,
  ]);

  // Grade-flash detail: diffing the fresh boleta against the previous
  // snapshot names the changed subject ("Redes · 9.5") without racing the
  // tracking store's baseline save. Declared before the counter effect below
  // so effects run in order and the flash is ready when the bump arrives.
  const previousGradesRef = useRef<Map<string, string>>(new Map());
  const pendingGradeFlashRef = useRef<{
    title: string;
    detail: string;
  } | null>(null);

  useEffect(() => {
    const materias = effectiveAlumno?.boleta.materias ?? [];
    const previous = previousGradesRef.current;
    let flash: { title: string; detail: string } | null = null;

    for (const materia of materias) {
      const value = materia.calificacion.trim();
      if (value === "") continue;

      const before = previous.get(materia.clave);
      if (before === undefined) {
        flash = {
          title: "Nueva calificación",
          detail: `${materia.nombre} · ${value}`,
        };
      } else if (before !== value) {
        flash = {
          title: "Calificación actualizada",
          detail: `${materia.nombre} · ${value}`,
        };
      }
    }

    pendingGradeFlashRef.current = flash;
    previousGradesRef.current = new Map(materias.flatMap((materia) => {
      const value = materia.calificacion.trim();
      return value === "" ? [] : [[materia.clave, value] as const];
    }));
  }, [effectiveAlumno]);

  // Capsule channel: route the same fetch events into the persistent
  // capsule. Grades flash their subject first, then the period average.
  const [capsuleNotification, setCapsuleNotification] =
    useState<CapsuleNotification | null>(null);
  const eventCountsRef = useRef({
    grades: 0,
    adeudos: 0,
    reinscripcion: 0,
    progress: 0,
  });

  useEffect(() => {
    if (notificationChannel !== "capsule") return;

    const previous = eventCountsRef.current;

    if (adeudoAlertCount > previous.adeudos) {
      setCapsuleNotification({
        id: `adeudo:${adeudoAlertCount}`,
        title: "Adeudo nuevo",
        detail: "Revisa la lista de deudas en tu perfil.",
        conclusion: "Tienes un adeudo nuevo pendiente.",
      });
    } else if (
      reinscripcionAlertCount > previous.reinscripcion &&
      lastReinscripcionAlert !== null
    ) {
      const fecha = parseReinscripcionDate(effectiveAlumno);
      setCapsuleNotification({
        id: `reinscripcion:${reinscripcionAlertCount}`,
        title: "Reinscripción",
        detail: fecha !== null ? `Empieza el ${formatReinscripcionDate(fecha)}.` : undefined,
        conclusion: REINSCRIPCION_ALERT_MESSAGES[lastReinscripcionAlert],
      });
    } else if (
      progressAlertCount > previous.progress &&
      lastProgressGain !== null &&
      lastProgressGain > 0
    ) {
      const progreso = Number.isFinite(effectiveAlumno?.progreso)
        ? Math.round((effectiveAlumno?.progreso ?? 0) * 10) / 10
        : null;
      setCapsuleNotification({
        id: `progreso:${progressAlertCount}`,
        title: "Progreso de carrera",
        detail:
          progreso !== null ? `Tu progreso actual es ${progreso}%.` : undefined,
        conclusion: `Avanzaste ${formatProgressDelta(lastProgressGain)}.`,
      });
    } else if (gradeChangeCount > previous.grades) {
      const flash = pendingGradeFlashRef.current;
      setCapsuleNotification({
        id: `grado:${gradeChangeCount}`,
        title: flash?.title ?? "Calificaciones actualizadas",
        detail: flash?.detail,
        conclusion: `Promedio · ${formatAverage(effectiveAlumno?.boleta.promedio)}`,
      });
    }

    eventCountsRef.current = {
      grades: gradeChangeCount,
      adeudos: adeudoAlertCount,
      reinscripcion: reinscripcionAlertCount,
      progress: progressAlertCount,
    };
  }, [
    gradeChangeCount,
    adeudoAlertCount,
    reinscripcionAlertCount,
    lastReinscripcionAlert,
    progressAlertCount,
    lastProgressGain,
    effectiveAlumno,
    notificationChannel,
  ]);

  function handlePullToRefresh() {
    if (hasCredentials) return refresh();
    setReAuthOpen(true);
  }

  // The capsule flash is transient (never eternal): it clears itself after
  // CAPSULE_FLASH_LIFETIME_MS so the capsule returns to the schedule context
  // even if no newer event replaces it.
  useEffect(() => {
    if (capsuleNotification === null) return;
    const timer = window.setTimeout(
      () => setCapsuleNotification(null),
      CAPSULE_FLASH_LIFETIME_MS,
    );
    return () => window.clearTimeout(timer);
  }, [capsuleNotification]);

  // Dev-only test event: sends a custom alert through whichever in-app channel
// is selected in Ajustes (capsule or toast) and optionally fires a real
// system push, so every surface can be exercised without waiting for a real
// fetch change.
const sendTestNotification = useCallback(
  (draft: NotificationDraft, withSystemPush: boolean) => {
    if (notificationChannel === "capsule") {
      setCapsuleNotification(
        toCapsuleNotification(draft, `dev-test:${Date.now()}`),
      );
    } else {
      showToast(
        [draft.title, draft.conclusion].filter(Boolean).join(". "),
        "neutral",
      );
    }

    if (withSystemPush) {
      void sendPushNotificationTest({
        title: draft.title,
        body: [draft.conclusion, draft.detail].filter(Boolean).join("\n"),
      }).catch(() => undefined);
    }
  },
  [notificationChannel, showToast],
);

  return (
    <ScheduleStateProvider alumno={effectiveAlumno}>
      <AppShell
        navigation={
          <BottomNavigation
            items={NAV_ITEMS}
            activeId={tab}
            onSelect={setTab}
          />
        }
        onPullToRefresh={handlePullToRefresh}
        topSlot={
          <ContextCapsule
            collapseMs={capsuleCollapseMs}
            notification={
              notificationChannel === "capsule" ? capsuleNotification : null
            }
          />
        }
      >
        <AdeudoAlertsCard alumno={effectiveAlumno} />

        <PageTransition transitionKey={tab}>
          {(activeKey) =>
            activeKey === "schedule" ? (
              <SchedulePage
                alumno={effectiveAlumno}
                longPressDurationMs={longPressDurationMs}
                simulated={devActive}
                onShowToast={showToast}
              />
            ) : activeKey === "grades" ? (
              <GradesPage alumno={effectiveAlumno} />
            ) : activeKey === "notifications" ? (
              <NotificationsPage alumno={effectiveAlumno} />
            ) : (
              <StudentPage
                alumno={effectiveAlumno}
                onRequestRefresh={handlePullToRefresh}
                onShowToast={showToast}
                onSendTestNotification={sendTestNotification}
                onOpenSettings={() => setSettingsOpen(true)}
                onLogout={logout}
                dev={dev}
              />
            )
          }
        </PageTransition>
      </AppShell>

      {toast ? (
        <Toast
          key={toast.id}
          message={toast.message}
          variant={toast.variant}
          durationMs={toastDurationMs}
          onClose={() => setToast(null)}
        />
      ) : null}

      <ReAuthSheet
        open={reAuthOpen}
        initialUser={rememberedUsername ?? ""}
        onClose={() => setReAuthOpen(false)}
        onSuccess={() => setReAuthOpen(false)}
      />
      <SettingsSheet
        open={settingsOpen}
        settings={settingsCtrl}
        onClose={() => setSettingsOpen(false)}
      />
    </ScheduleStateProvider>
  );
}

function AppContent() {
  const { status } = useAuth();

  if (status === "restoring") {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <Spinner size={28} className="text-primary" />
      </div>
    );
  }

  if (status !== "authenticated") {
    return <LoginPage />;
  }

  return <AuthenticatedShell />;
}

export function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
