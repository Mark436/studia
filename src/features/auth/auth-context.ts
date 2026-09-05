import { createContext, useContext } from "react";
import type { Alumno, ApiErrorKind, Aviso } from "@/lib/api/client";
import type { ReinscripcionAlertKind } from "@/lib/notifications/reinscripcion";

export type AuthStatus =
  | "restoring"
  | "unauthenticated"
  | "authenticating"
  | "authenticated";

export interface AuthContextValue {
  status: AuthStatus;
  /** A login request is in flight; true even while resuming an
   * authenticated session (re-auth), where `status` stays untouched. */
  pendingAuth: boolean;
  alumno: Alumno | null;
  avisos: Aviso[];
  errorKind: ApiErrorKind | null;
  hasCredentials: boolean;
  rememberedUsername: string | null;
  login: (user: string, pass: string) => Promise<boolean>;
  refresh: () => Promise<boolean>;
  refreshing: boolean;
  unseenGradeChanges: boolean;
  markGradesSeen: () => void;
  // Monotonic counters incremented only when a real fetch detects the event
  // after mount; UI watches them to fire one-shot notifications. Starting at
  // zero guarantees app startup and cache restores never trigger them.
  gradeChangeCount: number;
  adeudoAlertCount: number;
  /** Last reinscription-date alert kind detected by a real fetch, if any. */
  reinscripcionAlertCount: number;
  lastReinscripcionAlert: ReinscripcionAlertKind | null;
  /** Career progress percentage-point gain of the latest real fetch. */
  lastProgressGain: number | null;
  progressAlertCount: number;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth debe usarse dentro de un AuthProvider.");
  }
  return context;
}
