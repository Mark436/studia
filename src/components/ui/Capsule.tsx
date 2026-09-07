import { useEffect, useRef, useState } from "react";
import type { FocusEvent, KeyboardEvent } from "react";
import type { ReactNode } from "react";
import gsap from "gsap";
import {
  CAPSULE_COLLAPSE_DURATION,
  CAPSULE_COLLAPSE_EASE,
  CAPSULE_MORPH_DURATION,
  CAPSULE_MORPH_EASE,
} from "@/lib/motion/eases";

export type CapsuleTone = "neutral" | "accent";

interface CapsuleProps {
  /** Anchor shown while collapsed (and leading the content when expanded).
      This is the content that does NOT change between states. */
  minimized: ReactNode;
  /** Detail content revealed on expand. With `stacked` it renders below the
      anchor; otherwise beside it. */
  expanded?: ReactNode;
  /** Larger variant of `minimized` shown when `stacked` expands. Real layout
      instead of a transform scale, so the capsule grows to fit its content
      and the progress ring stays glued to the border. Falls back to
      `minimized` when omitted. */
  minimizedExpanded?: ReactNode;
  /** Change this key to trigger one expand pulse (important events only). */
  pulseKey?: string | number;
  /** Delay before an expanded capsule collapses back (ms), manual or pulsed. */
  autoCollapseMs?: number;
  /** 0–100: when provided, draws a progress ring on the capsule border that
      starts at the middle-left edge and fills up and down at the same time
      (used for the in-class countdown). */
  progressPercent?: number;
  /** "stacked": the anchor replaces the previous right-side detail — it is
      the only content, enlarged through `minimizedExpanded`, with `expanded`
      stacked below it. */
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
const RING_STROKE_PX = 2;
const RING_INSET_PX = 1;

/**
 * Two half-perimeter arc paths for the progress ring. Both start at the
 * middle of the left edge and grow outward: the top arc travels up → right →
 * down, the bottom arc travels down → right → up, so the ring fills the
 * border up and down at the same time and the gap closes at the
 * right-middle. `radius` matches the capsule corner radius so the stroke hugs
 * the (pill or rounded) border. Each path reports `pathLength` 100 so one
 * shared dasharray renders as a percentage.
 */
function ringArcPaths(
  width: number,
  height: number,
  radius: number,
): [string, string] {
  const r = Math.max(0, Math.min(radius, height / 2));
  const half = height / 2;
  const top = [
    `M 0 ${half}`,
    `L 0 ${r} A ${r} ${r} 0 0 1 ${r} 0`,
    `L ${width - r} 0 A ${r} ${r} 0 0 1 ${width} ${r}`,
    `L ${width} ${half}`,
  ].join(" ");
  const bottom = [
    `M 0 ${half}`,
    `L 0 ${height - r} A ${r} ${r} 0 0 0 ${r} ${height}`,
    `L ${width - r} ${height} A ${r} ${r} 0 0 0 ${width} ${height - r}`,
    `L ${width} ${half}`,
  ].join(" ");
  return [top, bottom];
}

// The context capsule: a floating island sitting at the top-left that morphs
// to a centered expanded card. Position travels through a composited `x`
// transform (never `left`), so the backdrop blur behind the glass panel stays
// rasterized and constant across the whole tween. The border-radius is NOT
// animated (it snaps per state via classes): any radius tween forces the
// browser to re-sample the backdrop-filter frame by frame, which reads as the
// blur "animating". Padding IS animated (interpolable), so the box grows
// smoothly even though width/height are content-fit. The anchor's position is
// owned by GSAP, so every collapse plays its full (slightly slower) duration
// regardless of what triggered it (tap, pulse, timer, Escape, blur or outside
// press).
//
// Expansion is always transient: it ends after autoCollapseMs, on Escape, on
// focus leaving the island, or on a pointer press outside of it.
export function Capsule({
  minimized,
  minimizedExpanded,
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
  // Collapse is a touch slower than the expansion so leaving reads as
  // deliberate.
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
      duration: isExpanded
        ? CAPSULE_MORPH_DURATION
        : CAPSULE_COLLAPSE_DURATION,
      ease: isExpanded ? CAPSULE_MORPH_EASE : CAPSULE_COLLAPSE_EASE,
      overwrite: "auto",
    });
  }, [isExpanded, reducedMotion]);

  // Border-radius is static per state (classes `rounded-full` / `rounded-[20px]`)
  // and never tweened: animating radius on a backdrop-filter element re-samples
  // the blur frame by frame. skipped on purpose — see comment on Capsule.

  // Track the capsule box so the ring hugs its border at every size.
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
  const ringRadius = isExpanded
    ? EXPANDED_RADIUS_PX
    : (ringSize?.height ?? 0) / 2;

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
          ? "max-w-[calc(100vw-1rem)] min-w-64 rounded-[20px] p-capsule-pad"
          : "min-h-12 rounded-full px-capsule-pad-sm"
      } transition-[padding,opacity] duration-300 ease-out active:opacity-80 ${
        tone === "accent" ? "glass-panel-accent" : "glass-panel-bare"
      } ${className ?? ""}`}
    >
      {progressPercent !== undefined ? (
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full"
        >
          {ringWidth > 0 && ringHeight > 0 ? (
            <g
              transform={`translate(${RING_INSET_PX} ${RING_INSET_PX})`}
              fill="none"
              stroke="var(--studia-cobalto)"
              strokeWidth={RING_STROKE_PX}
              vectorEffect="non-scaling-stroke"
            >
              {ringArcPaths(ringWidth, ringHeight, ringRadius).map((d) => (
                <path
                  key={d}
                  d={d}
                  pathLength={100}
                  strokeDasharray={`${progress} ${100 - progress}`}
                />
              ))}
            </g>
          ) : null}
        </svg>
      ) : null}

      <div
        className={
          isExpanded
            ? stacked
              ? "min-w-0"
              : "flex min-w-0 items-start gap-4"
            : "flex min-w-0 items-center gap-1.5"
        }
      >
        {isExpanded && stacked ? (
          <div className="flex min-w-0 flex-col gap-capsule-gap">
            <div className="min-w-0">{minimizedExpanded ?? minimized}</div>
            {expanded ? (
              <div className="min-w-0 motion-safe:animate-[studia-capsule-in_0.35s_var(--ease-out-soft)]">
                {expanded}
              </div>
            ) : null}
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