import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { ToastVariant } from "./toastVariants";
import { DEFAULT_TOAST_DURATION_MS } from "./toastVariants";

// How long the fade-out transition runs after the visibility window ends.
const FADE_OUT_MS = 200;

const VARIANT_CLASSES: Record<ToastVariant, string> = {
  neutral: "bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-300",
  success: "bg-success/95 text-on-success",
  error: "bg-error/95 text-on-error",
} as const;

interface ToastProps {
  message: string;
  variant?: ToastVariant;
  onClose: () => void;
  durationMs?: number;
}

// Rendered through a portal so it stays anchored to the viewport even when an
// ancestor uses transforms (for example the pull-to-refresh container).
export function Toast({
  message,
  variant = "neutral",
  onClose,
  durationMs = DEFAULT_TOAST_DURATION_MS,
}: ToastProps) {
  const [fading, setFading] = useState(false);
  // Kept in a ref so re-renders of the host never reset or extend the
  // visibility timers mid-toast.
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const hideTimer = window.setTimeout(() => setFading(true), durationMs);
    const closeTimer = window.setTimeout(
      () => onCloseRef.current(),
      durationMs + FADE_OUT_MS,
    );

    return () => {
      window.clearTimeout(hideTimer);
      window.clearTimeout(closeTimer);
    };
  }, [durationMs]);

  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(6rem+env(safe-area-inset-bottom))] z-50 flex justify-center px-4">
      <p
        role="status"
        style={{ transitionDuration: `${FADE_OUT_MS}ms` }}
        className={`pointer-events-auto max-w-md rounded-full px-5 py-2.5 text-sm font-medium elevated transition-opacity ease-out motion-safe:animate-[studia-fade-up_0.3s_var(--ease-out-soft)] ${
          fading ? "opacity-0" : "opacity-100"
        } ${VARIANT_CLASSES[variant]}`}
      >
        {message}
      </p>
    </div>,
    document.body,
  );
}
