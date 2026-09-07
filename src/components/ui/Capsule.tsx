import { useEffect, useRef, useState } from "react";
import type { FocusEvent, KeyboardEvent } from "react";
import type { ReactNode } from "react";
import gsap from "gsap";
import {
  CAPSULE_MORPH_DURATION,
  CAPSULE_MORPH_EASE,
  CAPSULE_RADIUS_DURATION,
  CAPSULE_RADIUS_EASE,
} from "@/lib/motion/eases";

export type CapsuleTone = "neutral" | "accent";

interface CapsuleProps {
  /** Anchor shown while collapsed (and leading the content when expanded).
      This is the content that does NOT change between states. */
  minimized: ReactNode;
  /** Detail content revealed on expand. With `stacked` it renders below the
      scaled anchor; otherwise beside it. */
  expanded?: ReactNode;
  /** Change this key to trigger one expand pulse (important events only). */
  pulseKey?: string | number;
  /** Delay before an expanded capsule collapses back (ms), manual or pulsed. */
  autoCollapseMs?: number;
  /** 0–100: when provided, draws a progress ring on the capsule border that
      grows clockwise from the top-left (used for the in-class countdown). */
  progressPercent?: number;
  /** "stacked": the anchor replaces the previous right-side detail — it is
      the only content, simply scaled up, with `expanded` stacked below it. */
  stacked?: boolean;
  tone?: CapsuleTone;
  ariaLabel?: string;
  className?: string;
}

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(prefersReducedMotion);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  return reduced;
}

const EXPANDED_RADIUS_PX = 20;
/** The stacked anchor grows by this factor (transform scale, no font-size
    change), so the same layout just reads bigger. */
const ANCHOR_SCALE = 1.25;
const RING_STROKE_PX = 2;

// The context capsule: a floating island sitting at the top-left that morphs
// to a centered expanded card. Position travels through a composited `x`
// transform (never `left`), so the backdrop blur behind the glass panel stays
// rasterized and constant across the whole tween; only transform + radius
// animate. The anchor's geometry is owned by GSAP, so collapse animates back
// with the exact same duration regardless of what triggered it (tap, pulse,
// timer, Escape, blur or outside press).
//
// Expansion is always transient: it ends after autoCollapseMs, on Escape, on
// focus leaving the island, or on a pointer press outside of it.
export function Capsule({
  minimized,
  expanded,
  pulseKey,
  autoCollapseMs = 1500,
  progressPercent,
  stacked = false,
  tone = "neutral",
  ariaLabel = "Contexto actual",
  className,
}: CapsuleProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [ringSize, setRingSize] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const elementRef = useRef<HTMLButtonElement>(null);
  const ringRectRef = useRef<SVGRectElement>(null);
  const collapseTimerRef = useRef<number | undefined>(undefined);
  const previousPulseRef = useRef(pulseKey);
  const reducedMotion = usePrefersReducedMotion();

  function clearCollapseTimer() {
    if (collapseTimerRef.current !== undefined) {
      window.clearTimeout(collapseTimerRef.current);
      collapseTimerRef.current = undefined;
    }
  }

  function scheduleCollapse() {
    clearCollapseTimer();
    collapseTimerRef.current = window.setTimeout(() => {
      setIsExpanded(false);
    }, autoCollapseMs);
  }

  function collapseNow() {
    clearCollapseTimer();
    setIsExpanded(false);
  }

  // Auto-expand pulses: fired only when the caller bumps pulseKey.
  useEffect(() => {
    if (pulseKey === undefined || pulseKey === "") return;
    if (previousPulseRef.current === pulseKey) return;

    previousPulseRef.current = pulseKey;
    setIsExpanded(true);
    scheduleCollapse();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- timers are refs; re-run only per pulse key.
  }, [pulseKey]);

  // Re-arm the timer when the delay changes while expanded (dev slider).
  useEffect(() => {
    if (!isExpanded) return;
    scheduleCollapse();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- collapse scheduling only.
  }, [autoCollapseMs, isExpanded]);

  useEffect(() => clearCollapseTimer, []);

  // A press anywhere outside the island dismisses it immediately.
  useEffect(() => {
    if (!isExpanded) return;

    function handlePointerDown(event: globalThis.PointerEvent) {
      const element = elementRef.current;
      if (
        element !== null &&
        event.target instanceof Node &&
        !element.contains(event.target)
      ) {
        collapseNow();
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [isExpanded]);

  function handleToggle() {
    if (isExpanded) {
      collapseNow();
      return;
    }

    setIsExpanded(true);
    scheduleCollapse();
  }

  function handleBlur(event: FocusEvent<HTMLButtonElement>) {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      collapseNow();
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "Escape" && isExpanded) {
      event.stopPropagation();
      collapseNow();
    }
  }

  // After React commits the new layout, travel to (or from) the centered
  // position. `x` is a composited transform: the backdrop filter never
  // re-renders frame-by-frame and every collapse plays the full duration.
  useEffect(() => {
    const element = elementRef.current;
    if (element === null || reducedMotion) return;

    const parent = element.parentElement;
    const targetX =
      isExpanded && parent !== null
        ? Math.max(0, (parent.clientWidth - element.offsetWidth) / 2)
        : 0;

    gsap.to(element, {
      x: targetX,
      duration: CAPSULE_MORPH_DURATION,
      ease: CAPSULE_MORPH_EASE,
      overwrite: "auto",
    });
  }, [isExpanded, reducedMotion]);

  // Border-radius morph, tuned not to lag the silhouette. The progress ring
  // shares the same targets so the rounded corners stay glued to the glass.
  useEffect(() => {
    const element = elementRef.current;
    if (element === null || reducedMotion) return;

    const targetRadius = isExpanded
      ? EXPANDED_RADIUS_PX
      : element.offsetHeight / 2;
    if (ringRectRef.current !== null) {
      gsap.to(ringRectRef.current, {
        attr: { rx: targetRadius },
        duration: CAPSULE_RADIUS_DURATION,
        ease: CAPSULE_RADIUS_EASE,
        overwrite: "auto",
      });
    }
    gsap.to(element, {
      borderRadius: targetRadius,
      duration: CAPSULE_RADIUS_DURATION,
      ease: CAPSULE_RADIUS_EASE,
      overwrite: "auto",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- geometry targets only.
  }, [isExpanded, reducedMotion]);

  // Track the capsule box so the ring hugs its border at every size, and for
  // `prefers-reduced-motion` place the corner radius directly (no tween).
  useEffect(() => {
    const element = elementRef.current;
    if (element === null || progressPercent === undefined) {
      setRingSize(null);
      return;
    }

    const update = () =>
      setRingSize({ width: element.offsetWidth, height: element.offsetHeight });
    update();

    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [progressPercent, isExpanded]);

  const positionClass =
    reducedMotion && isExpanded ? "left-1/2 -translate-x-1/2" : "left-0";

  const progress = Math.min(Math.max(progressPercent ?? 0, 0), 100);
  const ringWidth = (ringSize?.width ?? 0) - RING_STROKE_PX;
  const ringHeight = (ringSize?.height ?? 0) - RING_STROKE_PX;
  const targetRadius =
    reducedMotion && ringSize !== null
      ? isExpanded
        ? EXPANDED_RADIUS_PX
        : ringSize.height / 2
      : 0;

  return (
    <button
      ref={elementRef}
      type="button"
      onClick={handleToggle}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      aria-expanded={isExpanded}
      aria-label={ariaLabel}
      className={`pointer-events-auto absolute z-30 select-none text-left ${positionClass} ${
        isExpanded
          ? "max-w-[calc(100vw-1.5rem)] rounded-[20px] p-4"
          : "min-h-12 rounded-full px-4"
      } transition-opacity duration-150 ease-out active:opacity-80 ${
        tone === "accent" ? "glass-panel-accent" : "glass-panel"
      } ${className ?? ""}`}
    >
      {progressPercent !== undefined ? (
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full"
        >
          {ringWidth > 0 && ringHeight > 0 ? (
            <rect
              ref={ringRectRef}
              x={1}
              y={1}
              width={ringWidth}
              height={ringHeight}
              rx={targetRadius}
              fill="none"
              stroke="var(--studia-cobalto)"
              strokeWidth={RING_STROKE_PX}
              vectorEffect="non-scaling-stroke"
              pathLength={100}
              strokeDasharray={`${progress} ${100 - progress}`}
            />
          ) : null}
        </svg>
      ) : null}

      <div
        className={
          isExpanded
            ? stacked
              ? "min-w-0"
              : "flex items-start gap-3"
            : "flex min-w-0 items-center gap-1.5"
        }
      >
        {isExpanded && stacked ? (
          <div
            className="origin-top-left will-change-transform"
            style={{ transform: `scale(${ANCHOR_SCALE})` }}
          >
            <div className="flex min-w-0 flex-col gap-1.5">
              <div className="min-w-0">{minimized}</div>
              {expanded ? (
                <div className="min-w-0 motion-safe:animate-[studia-capsule-in_0.35s_var(--ease-out-soft)]">
                  {expanded}
                </div>
              ) : null}
            </div>
          </div>
        ) : (
          <>
            <div className={isExpanded ? "shrink-0" : "min-w-0"}>
              {minimized}
            </div>
            {isExpanded && expanded ? (
              <div className="min-w-0 flex-1 motion-safe:animate-[studia-capsule-in_0.35s_var(--ease-out-soft)]">
                {expanded}
              </div>
            ) : null}
          </>
        )}
      </div>
    </button>
  );
}