import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { FocusEvent, KeyboardEvent } from "react";
import type { ReactNode } from "react";
import gsap from "gsap";
import {
  CAPSULE_ATTEND_DURATION,
  CAPSULE_ATTEND_EASE,
  CAPSULE_COLLAPSE_DURATION,
  CAPSULE_COLLAPSE_EASE,
  CAPSULE_FLASH_DURATION,
  CAPSULE_FLASH_EASE,
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
  /** Change this key while collapsed to play a bouncy "pop" (blink + size
      tween toward the new natural size) without expanding — used by the
      transient academic flash. */
  popKey?: string | number;
  /** Delay before an expanded capsule collapses back (ms), manual or pulsed. */
  autoCollapseMs?: number;
  /** 0–100: when provided, draws a progress ring on the capsule border via a
      CSS mask (the full border revealed across the capsule, left to right)
      used for the in-class countdown. */
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

/** Per-side padding of the capsule box (px). */
interface CapsulePadding {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

function readPadding(element: HTMLElement): CapsulePadding {
  const computed = getComputedStyle(element);
  return {
    top: parseFloat(computed.paddingTop) || 0,
    right: parseFloat(computed.paddingRight) || 0,
    bottom: parseFloat(computed.paddingBottom) || 0,
    left: parseFloat(computed.paddingLeft) || 0,
  };
}

function applyPadding(element: HTMLElement, padding: CapsulePadding): void {
  element.style.paddingTop = `${padding.top}px`;
  element.style.paddingRight = `${padding.right}px`;
  element.style.paddingBottom = `${padding.bottom}px`;
  element.style.paddingLeft = `${padding.left}px`;
}

function clearPadding(element: HTMLElement): void {
  element.style.paddingTop = "";
  element.style.paddingRight = "";
  element.style.paddingBottom = "";
  element.style.paddingLeft = "";
}

/** Tween target for the "size attend" tween (structural TweenVars stand-in). */
interface AttendTarget {
  width: number;
  height: number;
  duration: number;
  ease: string;
  overwrite: "auto";
  onComplete: () => void;
  x?: number;
}

/**
 * Progress ring geometry for the capsule box (single rounded rect, drawn as a
 * closed path so `pathLength` + `strokeDasharray` fill it clockwise from the
 * top-left). A rounded rect — not two hand-built arcs — stays glued to the
 * border because GSAP can tween its x/y/width/height/rx attributes in one
 * pass while the capsule morphs, so the ring resizes with the box instead of
 * lagging behind it.
 */
function ringAttrs(
  width: number,
  height: number,
  radius: number,
): Record<"x" | "y" | "width" | "height" | "rx", number> {
  return {
    x: RING_INSET_PX,
    y: RING_INSET_PX,
    width: Math.max(0, width - RING_STROKE_PX),
    height: Math.max(0, height - RING_STROKE_PX),
    rx: Math.max(0, radius),
  };
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
  popKey,
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
  const previousPopKeyRef = useRef(popKey);
  const popTimelineRef = useRef<ReturnType<typeof gsap.timeline> | null>(null);
  // Natural sizes of both states so the morph can travel width/height px when
  // the content swap happens (fit-content is not interpolable by GSAP).
  const collapsedSizeRef = useRef<{ width: number; height: number } | null>(
    null,
  );
  const expandedSizeRef = useRef<{ width: number; height: number } | null>(
    null,
  );
  // Same bookkeeping for per-side padding, tweened in sync with the box so
  // the interior doesn't lag the outer size (the CSS padding transition would
  // animate on its own 300 ms clock and make the height "jump" at the end).
  const collapsedPadRef = useRef<CapsulePadding | null>(null);
  const expandedPadRef = useRef<CapsulePadding | null>(null);
  const prevExpandedRef = useRef(isExpanded);
  const morphingRef = useRef(false);
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
  // position AND grow/shrink the box to match the new content. Width/height
  // are fit-content (not interpolable), so each state's natural size is
  // measured and the other state's size is applied as the from-value while
  // GSAP tweens width/height/x together. Runs before paint so the swap into
  // the expanded content never flashes at full size. On completion the box
  // returns to content-fit (auto) and the ring's ResizeObserver re-hugs the
  // border. Collapse is a touch slower than the expansion so leaving reads as
  // deliberate. A re-toggle mid-tween kills the running tween and resumes
  // from the current visual size instead of being ignored.
  useLayoutEffect(() => {
    const element = elementRef.current;
    if (element === null) return;

    const parent = element.parentElement;
    if (parent === null) return;

    const changed = prevExpandedRef.current !== isExpanded;
    prevExpandedRef.current = isExpanded;

    if (reducedMotion || !changed) {
      // Still capture the rest-size of the committed state so the first real
      // morph has a from-value (and the ring has settled dimensions).
      if (!morphingRef.current) {
        if (isExpanded) {
          expandedSizeRef.current = {
            width: element.offsetWidth,
            height: element.offsetHeight,
          };
          expandedPadRef.current = readPadding(element);
        } else {
          collapsedSizeRef.current = {
            width: element.offsetWidth,
            height: element.offsetHeight,
          };
          collapsedPadRef.current = readPadding(element);
        }
      }
      return;
    }

    const fromRef = isExpanded
      ? collapsedSizeRef.current
      : expandedSizeRef.current;
    const fromPadRef = isExpanded
      ? collapsedPadRef.current
      : expandedPadRef.current;
    // If a morph is in flight the box is pinned to the animated size; snap up
    // from there instead of from a rest state (rare mid-tween re-toggle).
    const inFlight = gsap.getTweensOf(element).length > 0;
    const fromWidth = inFlight ? element.offsetWidth : fromRef?.width;
    const fromHeight = inFlight ? element.offsetHeight : fromRef?.height;
    const fromPadding = inFlight ? readPadding(element) : fromPadRef;
    const fromX = inFlight ? gsap.getProperty(element, "x") : 0;

    gsap.killTweensOf(element);
    // Unpin (no-op on a resting element) to read the true natural size of the
    // committed content — the morph target.
    element.style.width = "";
    element.style.height = "";
    element.style.minWidth = "";
    gsap.set(element, { x: 0, scale: 1, opacity: 1 });
    // The class carries `transition-[padding,opacity]`: while it is active a
    // freshly-started transition reports its START value, so a measurement
    // would read padding from the wrong state and the tween would land short
    // (the classic "height jumps" at the end). Disable it for the measurement
    // and the whole tween; padding is animated by GSAP below and the class
    // transition is restored (inline "") once the morph completes.
    element.style.transition = "none";
    void element.offsetWidth; // flush a layout read with the target classes
    const targetWidth = element.offsetWidth;
    const targetHeight = element.offsetHeight;
    const targetPadding = readPadding(element);
    if (targetWidth <= 0 || targetHeight <= 0) {
      element.style.transition = "";
      return;
    }

    if (isExpanded) {
      expandedSizeRef.current = { width: targetWidth, height: targetHeight };
      expandedPadRef.current = targetPadding;
    } else {
      collapsedSizeRef.current = { width: targetWidth, height: targetHeight };
      collapsedPadRef.current = targetPadding;
    }

    const targetX = isExpanded
      ? Math.max(0, (parent.clientWidth - targetWidth) / 2)
      : 0;

    morphingRef.current = true;
    // Allow the from-side to dip under min-w-64 while the width tween runs;
    // the class min-width is restored on complete.
    if (fromWidth !== undefined) {
      gsap.set(element, {
        width: fromWidth,
        height: fromHeight ?? fromWidth,
        minWidth: 0,
        x: Number(fromX),
      });
      if (fromPadding !== null) applyPadding(element, fromPadding);
    }
    gsap.to(element, {
      width: targetWidth,
      height: targetHeight,
      x: targetX,
      paddingTop: targetPadding.top,
      paddingRight: targetPadding.right,
      paddingBottom: targetPadding.bottom,
      paddingLeft: targetPadding.left,
      duration: isExpanded
        ? CAPSULE_MORPH_DURATION
        : CAPSULE_COLLAPSE_DURATION,
      ease: isExpanded ? CAPSULE_MORPH_EASE : CAPSULE_COLLAPSE_EASE,
      overwrite: "auto",
      onComplete() {
        element.style.width = "";
        element.style.height = "";
        element.style.minWidth = "";
        clearPadding(element);
        element.style.transition = "";
        morphingRef.current = false;
      },
    });

    // Keep the progress ring glued to the border: tween its rounded-rect
    // geometry on the same clock as the box so it never lags the silhouette.
    // (Only the child rect's rx tween is animated — the button's own radius
    // still snaps via classes, so the backdrop blur is never re-sampled.)
    if (ringRectRef.current !== null) {
      gsap.to(ringRectRef.current, {
        attr: ringAttrs(
          targetWidth,
          targetHeight,
          isExpanded ? EXPANDED_RADIUS_PX : targetHeight / 2,
        ),
        duration: isExpanded
          ? CAPSULE_MORPH_DURATION
          : CAPSULE_COLLAPSE_DURATION,
        ease: isExpanded ? CAPSULE_MORPH_EASE : CAPSULE_COLLAPSE_EASE,
        overwrite: "auto",
      });
    }
  }, [isExpanded, reducedMotion]);

  // Size attend: when the CONTENT swaps while the capsule stays in the same
  // state (schedule pill "Xh" → "mañana HH:MM", the flash replacing the pill,
  // the expanded anchor growing, a container reflow), the natural size changes
  // with no state toggle — which otherwise hops. Watch the box; when its size
  // moves while nothing else owns it (no morph, no flash pop in flight),
  // travel to the new natural size with a short quiet tween.
  //
  // `interpolate-size: allow-keywords` in index.css already makes `auto`
  // interpolable for the browsers that support it; once support is broad this
  // JS tracker gets deleted and a plain CSS height transition covers the same
  // swaps.
  useEffect(() => {
    const element = elementRef.current;
    if (element === null) return;

    const attend = () => {
      if (morphingRef.current) return; // state morph or pop owns the size

      const record = isExpanded ? expandedSizeRef : collapsedSizeRef;
      const previous = record.current;
      if (previous === null) return;

      const targetWidth = element.offsetWidth;
      const targetHeight = element.offsetHeight;
      if (targetWidth <= 0 || targetHeight <= 0) return;

      if (reducedMotion) {
        // Honor reduced motion: snap is fine, but keep the recorded sizes
        // fresh so a later (enabled) morph starts from the right value.
        record.current = { width: targetWidth, height: targetHeight };
        return;
      }

      const moved =
        Math.abs(previous.width - targetWidth) > 1 ||
        Math.abs(previous.height - targetHeight) > 1;
      if (!moved) {
        record.current = { width: targetWidth, height: targetHeight };
        return;
      }

      record.current = { width: targetWidth, height: targetHeight };
      morphingRef.current = true;
      element.style.transition = "none";
      gsap.killTweensOf(element);
      gsap.set(element, {
        width: previous.width,
        height: previous.height,
        minWidth: 0,
        scale: 1,
        opacity: 1,
      });

      const target: AttendTarget = {
        width: targetWidth,
        height: targetHeight,
        duration: CAPSULE_ATTEND_DURATION,
        ease: CAPSULE_ATTEND_EASE,
        overwrite: "auto",
        onComplete() {
          element.style.width = "";
          element.style.height = "";
          element.style.minWidth = "";
          element.style.transition = "";
          morphingRef.current = false;
        },
      };
      // An expanded swap changes the centering too.
      if (isExpanded && element.parentElement !== null) {
        target.x = Math.max(
          0,
          (element.parentElement.clientWidth - targetWidth) / 2,
        );
      }

      if (ringRectRef.current !== null) {
        gsap.to(ringRectRef.current, {
          attr: ringAttrs(
            targetWidth,
            targetHeight,
            isExpanded ? EXPANDED_RADIUS_PX : targetHeight / 2,
          ),
          duration: CAPSULE_ATTEND_DURATION,
          ease: CAPSULE_ATTEND_EASE,
          overwrite: "auto",
        });
      }

      gsap.to(element, target);
    };

    const observer = new ResizeObserver(attend);
    observer.observe(element);
    return () => observer.disconnect();
  }, [isExpanded, reducedMotion]);

  // Transient pop while collapsed: a swapped-in flash is announced with a
  // bouncy size/scale spring toward its new natural size plus a quick double
  // blink, so an event reads as "something happened" without the card opening
  // on its own. When the flash leaves (notification cleared), the same tween
  // settles back to the schedule pill's natural size so the return doesn't
  // hop. Skips when the capsule is mid-morph or already expanded.
  useLayoutEffect(() => {
    if (popKey === previousPopKeyRef.current) return;
    const departed = popKey === undefined || popKey === "";
    previousPopKeyRef.current = popKey;

    const element = elementRef.current;
    if (element === null || reducedMotion || isExpanded) return;

    const fromSize = collapsedSizeRef.current;

    gsap.killTweensOf(element);
    popTimelineRef.current?.kill();
    // The class carries `transition-[padding,opacity]`; the blink below moves
    // opacity by the frame, so the CSS transition must not double-ease it.
    element.style.transition = "none";
    // Unpin to read the true natural size of the committed content.
    element.style.width = "";
    element.style.height = "";
    element.style.minWidth = "";
    gsap.set(element, { x: 0, scale: 1, opacity: 1 });
    const targetWidth = element.offsetWidth;
    const targetHeight = element.offsetHeight;
    if (targetWidth <= 0 || targetHeight <= 0) {
      element.style.transition = "";
      return;
    }

    morphingRef.current = true;
    if (fromSize !== null) {
      gsap.set(element, {
        width: fromSize.width,
        height: fromSize.height,
        minWidth: 0,
        scale: departed ? 1 : 0.96,
        opacity: 1,
      });
    }

    const timeline = gsap.timeline({
      onComplete() {
        element.style.width = "";
        element.style.height = "";
        element.style.minWidth = "";
        gsap.set(element, { scale: 1, opacity: 1 });
        element.style.transition = "";
        morphingRef.current = false;
        collapsedSizeRef.current = { width: targetWidth, height: targetHeight };
      },
    });
    popTimelineRef.current = timeline;

    // Flash leaving: a quiet settle back to the schedule pill size — no blink.
    if (departed) {
      timeline.to(
        element,
        {
          width: targetWidth,
          height: targetHeight,
          scale: 1,
          duration: CAPSULE_COLLAPSE_DURATION,
          ease: CAPSULE_COLLAPSE_EASE,
          overwrite: "auto",
        },
        0,
      );
    } else {
      // Arrival: bouncy pop plus a double blink right where the event lands.
      timeline
        .to(
          element,
          {
            width: targetWidth,
            height: targetHeight,
            scale: 1,
            duration: CAPSULE_FLASH_DURATION,
            ease: CAPSULE_FLASH_EASE,
            overwrite: "auto",
          },
          0,
        )
        .fromTo(
          element,
          { opacity: 0.35 },
          { opacity: 1, duration: 0.09, ease: "power1.out" },
          0,
        )
        .to(
          element,
          { opacity: 0.65, duration: 0.05, ease: "power1.in" },
          0.12,
        )
        .to(element, { opacity: 1, duration: 0.06, ease: "power1.out" }, 0.17);
    }
  }, [popKey, isExpanded, reducedMotion]);

  useEffect(
    () => () => {
      popTimelineRef.current?.kill();
    },
    [],
  );

  // The button's border-radius is static per state (classes `rounded-full` /
  // `rounded-[20px]`) and never tweened: animating the radius on a
  // backdrop-filter element re-samples the blur frame by frame. Only the child
  // progress rect's `rx` is tweened (SVG, no blur), so the ring hugs the border
  // through the morph while the glass stays rasterized.

  // Track the capsule box so the ring hugs its border at every size. Updates
  // are skipped while the morph tween runs (the box size is in flight); the
  // final RestoreObserver read lands once sizing returns to auto.
  useEffect(() => {
    const element = elementRef.current;
    if (element === null || progressPercent === undefined) {
      setRingSize(null);
      return;
    }

    const update = () => {
      if (morphingRef.current) return;
      setRingSize({ width: element.offsetWidth, height: element.offsetHeight });
    };
    update();

    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [progressPercent, isExpanded]);

  const positionClass =
    reducedMotion && isExpanded ? "left-1/2 -translate-x-1/2" : "left-0";

  const progress = Math.min(Math.max(progressPercent ?? 0, 0), 100);
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
          {ringSize !== null && ringSize.width > 0 && ringSize.height > 0 ? (
            <rect
              ref={ringRectRef}
              {...ringAttrs(ringSize.width, ringSize.height, ringRadius)}
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