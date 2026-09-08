/**
 * A transient notification surfaced through the context capsule as an
 * alternative to toasts (the channel is configurable). Three fields with
 * complementary roles:
 *
 * - `title`: the short headline ("Nueva calificación");
 * - `detail`: the concrete explanation, revealed only on expand
 *   ("Matemáticas · 9.5");
 * - `conclusion`: the takeaway that fits the collapsed capsule next to the
 *   title ("Promedio · 8.75").
 */
export interface CapsuleNotification {
  /** Unique per occurrence; bumping it triggers the capsule pulse. */
  id: string;
  title: string;
  detail?: string;
  conclusion?: string;
}

/**
 * Editable fields of an alert, shared by the real event builders and the dev
 * composer (see features/devtools/components/InteractionSection.tsx).
 */
export interface NotificationDraft {
  title: string;
  detail?: string;
  conclusion?: string;
}

/** Reusable orchestration for a draft: only used by the dev test path. */
export function toCapsuleNotification(
  draft: NotificationDraft,
  id: string,
): CapsuleNotification {
  return {
    id,
    title: draft.title,
    detail: draft.detail,
    conclusion: draft.conclusion,
  };
}

/**
 * How long a capsule flash stays active before clearing itself and returning
 * the capsule to the schedule state (10 s). The flash is transient by design:
 * it announces the event, then yields to the class context.
 */
export const CAPSULE_FLASH_LIFETIME_MS = 10_000;