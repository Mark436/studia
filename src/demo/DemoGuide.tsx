// Automatic, hands-free tour for the `?demo` showcase. It only orchestrates the
// existing notification primitives (toasts + the context capsule flash); it
// never renders UI of its own and touches no notification/capsule internals.
//
// Sequence:
//   1. on entry                     → welcome toast ("calificaciones nuevas");
//   2. on opening Calificaciones    → capsule flash (notifications land here);
//   3. on Horario (back from grades, or after 5 s there) → schedule toast.
//
// Loaded lazily and rendered only in demo mode (see app/App.tsx), so it stays
// out of the real app's bundle.

import { useEffect, useRef } from "react";
import type { ToastVariant } from "@/components/ui/toastVariants";
import type { TabId } from "@/app/navigation";
import type { CapsuleNotification } from "@/lib/notifications/capsuleEvents";
import { GRADE_CHANGES_TOAST } from "@/lib/toastMessages";

// How long the visitor has to linger on Horario before the tip fires on its
// own (without having visited Calificaciones first).
const SCHEDULE_TIP_DELAY_MS = 5000;

const SCHEDULE_TIP_TOAST =
  "Aquí puedes ver tu horario en cualquier momento, incluso si se acaba el mundo.";

interface DemoGuideProps {
  tab: TabId;
  onToast: (message: string, variant: ToastVariant) => void;
  onCapsule: (notification: CapsuleNotification) => void;
}

export function DemoGuide({ tab, onToast, onCapsule }: DemoGuideProps) {
  const welcomedRef = useRef(false);
  const sawGradesRef = useRef(false);
  const scheduleTipShownRef = useRef(false);

  // 1) Welcome: announce the simulated "new grades" on entry.
  useEffect(() => {
    if (welcomedRef.current) return;
    welcomedRef.current = true;
    onToast(GRADE_CHANGES_TOAST, "success");
  }, [onToast]);

  // 2) Opening Calificaciones flashes the capsule so the visitor sees the
  //    alternative channel in the place it matters.
  useEffect(() => {
    if (tab !== "grades" || sawGradesRef.current) return;
    sawGradesRef.current = true;
    onCapsule({
      id: "demo-guide-grades",
      title: "Notificaciones",
      detail: "Aquí llegan las calificaciones nuevas, los avisos y los adeudos.",
      conclusion: "También puedes recibir notificaciones aquí.",
    });
  }, [tab, onCapsule]);

  // 3) Horario tip: fires either right after returning from Calificaciones or
  //    on its own once the visitor has stayed a few seconds.
  useEffect(() => {
    if (tab !== "schedule" || scheduleTipShownRef.current) return;

    const show = () => {
      if (scheduleTipShownRef.current) return;
      scheduleTipShownRef.current = true;
      onToast(SCHEDULE_TIP_TOAST, "neutral");
    };

    if (sawGradesRef.current) {
      show();
      return;
    }

    const timer = window.setTimeout(show, SCHEDULE_TIP_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [tab, onToast]);

  return null;
}
