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
  /** Anchor shown while collapsed AND when expanded (same content, scaled).
      This is the single source of truth for the capsule's visible content. */
  minimized: ReactNode;
  /** Optional detail content revealed on expand (stacked below the anchor). */
  minimizedExpanded?: ReactNode;
  /** Optional detail content revealed on expand (stacked below the anchor). */
  expanded?: ReactNode;
  /** Change this key to trigger one expand pulse (important events only). */
  pulseKey?: string | number;
  /** Change this key while collapsed to play a bouncy "pop" (blink + size
      tween toward the new natural size) without expanding — used by the
      transient academic flash. */
  popKey?: string | number;
  /** Delay before an expanded capsule collapses back (ms), manual or pulsed. */
  autoCollapseMs?: number;
  /** 0–100: when provided, draws two horizontal progress lines (top/bottom)
      filling left→right on the capsule border, used for in-class countdown. */
  progressPercent?: number;
  /** "stacked": the anchor is the only content, enlarged via transform scale;
      `expanded` stacks below it. */
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

const PROGRESS_STROKE_PX = 2;
const PROGRESS_INSET_PX = 1;
const EXPANDED_RADIUS_PX = 12;

function collapsedRadiusPx({ element, isExpanded }: { element: HTMLElement; isExpanded: boolean }): number {
  if (isExpanded) return EXPANDED_RADIUS_PX;
  const height = element.offsetHeight || 0;
  return height / 2;
}

/**
 * Progress line geometry: two horizontal lines (top and bottom) that fill
 * from left to right.
 */
function progressLineAttrs(
  width: number,
  height: number,
): {
  top: { x1: number; y1: number; x2: number; y2: number };
  bottom: { x1: number; y1: number; x2: number; y2: number };
} {
  const inset = PROGRESS_INSET_PX;
  const innerWidth = Math.max(0, width - 2 * inset);
  const yTop = inset;
  const yBottom = Math.max(inset, height - inset);
  return {
    top: { x1: inset, y1: yTop, x2: inset + innerWidth, y2: yTop },
    bottom: { x1: inset, y1: yBottom, x2: inset + innerWidth, y2: yBottom },
  };
}

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
 * Capsule component:
 * - Single anchor content (`minimized`) used in both collapsed and expanded states
 * - Expanded state scales the anchor via transform (not font-size) and optionally
 *   reveals `expanded` content below it (stacked layout)
 * - Border-radius animated via CSS variable on the button (no backdrop-filter
 *   re-sampling because the glass panel is a pseudo-element or separate layer)
 * - Progress lines (top/bottom) fill left→right, animated on same timeline
 * - Flash (`popKey`) shows accent background at 40% opacity with blink
 */
export function Capsule({
  minimized,
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
  const [progressSize, setProgressSize] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const elementRef = useRef<HTMLButtonElement>(null);
  const topLineRef = useRef<SVGLineElement>(null);
  const bottomLineRef = useRef<SVGLineElement>(null);
  const flashOverlayRef = useRef<HTMLDivElement>(null);
  const collapseTimerRef = useRef<number | undefined>(undefined);
  const previousPulseRef = useRef(pulseKey);
  const previousPopKeyRef = useRef(popKey);
  const popTimelineRef = useRef<ReturnType<typeof gsap.timeline> | null>(null);
  // Natural sizes of both states (width/height are fit-content, not interpolable).
  const collapsedSizeRef = useRef<{ width: number; height: number } | null>(null);
  const expandedSizeRef = useRef<{ width: number; height: number } | null>(null);
  // Per-side padding, tweened in sync with the box.
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

  // Dismiss on outside press.
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

  // Main morph: size + position + padding + border-radius + progress lines.
  useLayoutEffect(() => {
    const element = elementRef.current;
    if (element === null) return;

    const parent = element.parentElement;
    if (parent === null) return;

    const changed = prevExpandedRef.current !== isExpanded;
    prevExpandedRef.current = isExpanded;

    if (reducedMotion || !changed) {
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
    const inFlight = gsap.getTweensOf(element).length > 0;
    const fromWidth = inFlight ? element.offsetWidth : fromRef?.width;
    const fromHeight = inFlight ? element.offsetHeight : fromRef?.height;
    const fromPadding = inFlight ? readPadding(element) : fromPadRef;
    // For collapse, read actual centered x; for expand, from 0.
    const fromX = isExpanded
      ? 0
      : inFlight
        ? gsap.getProperty(element, "x")
        : gsap.getProperty(element, "x");

    gsap.killTweensOf(element);
    element.style.width = "";
    element.style.height = "";
    element.style.minWidth = "";
    gsap.set(element, { x: 0, scale: 1, opacity: 1 });
    element.style.transition = "none";
    void element.offsetWidth;
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
    const targetRadius = collapsedRadiusPx({ element, isExpanded });

    morphingRef.current = true;
    if (fromWidth !== undefined) {
      gsap.set(element, {
        width: fromWidth,
        height: fromHeight ?? fromWidth,
        minWidth: 0,
        x: Number(fromX),
        borderRadius: collapsedRadiusPx({ element, isExpanded }),
      });
      if (fromPadding !== null) applyPadding(element, fromPadding);
    }
    gsap.to(element, {
      width: targetWidth,
      height: targetHeight,
      x: targetX,
      borderRadius: targetRadius,
      paddingTop: targetPadding.top,
      paddingRight: targetPadding.right,
      paddingBottom: targetPadding.bottom,
      paddingLeft: targetPadding.left,
      duration: isExpanded ? CAPSULE_MORPH_DURATION : CAPSULE_COLLAPSE_DURATION,
      ease: isExpanded ? CAPSULE_MORPH_EASE : CAPSULE_COLLAPSE_EASE,
      overwrite: "auto",
      onComplete() {
        element.style.width = "";
        element.style.height = "";
        element.style.minWidth = "";
        clearPadding(element);
        element.style.transition = "";
        element.style.borderRadius = "";
        morphingRef.current = false;
      },
    });

    // Progress lines on same timeline.
    if (topLineRef.current !== null && bottomLineRef.current !== null) {
      const { top, bottom } = progressLineAttrs(targetWidth, targetHeight);
      gsap.to(topLineRef.current, {
        attr: top,
        duration: isExpanded
          ? CAPSULE_MORPH_DURATION
          : CAPSULE_COLLAPSE_DURATION,
        ease: isExpanded ? CAPSULE_MORPH_EASE : CAPSULE_COLLAPSE_EASE,
        overwrite: "auto",
      });
      gsap.to(bottomLineRef.current, {
        attr: bottom,
        duration: isExpanded
          ? CAPSULE_MORPH_DURATION
          : CAPSULE_COLLAPSE_DURATION,
        ease: isExpanded ? CAPSULE_MORPH_EASE : CAPSULE_COLLAPSE_EASE,
        overwrite: "auto",
      });
    }
  }, [isExpanded, reducedMotion]);

  // Size attend: content swap while same state.
  useEffect(() => {
    const element = elementRef.current;
    if (element === null) return;

    const attend = () => {
      if (morphingRef.current) return;

      const record = isExpanded ? expandedSizeRef : collapsedSizeRef;
      const previous = record.current;
      if (previous === null) return;

      const targetWidth = element.offsetWidth;
      const targetHeight = element.offsetHeight;
      if (targetWidth <= 0 || targetHeight <= 0) return;

      if (reducedMotion) {
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
          element.style.borderRadius = "";
          morphingRef.current = false;
        },
      };
      if (isExpanded && element.parentElement !== null) {
        target.x = Math.max(
          0,
          (element.parentElement.clientWidth - targetWidth) / 2,
        );
      }

      if (topLineRef.current !== null && bottomLineRef.current !== null) {
        const { top, bottom } = progressLineAttrs(targetWidth, targetHeight);
        gsap.to(topLineRef.current, {
          attr: top,
          duration: CAPSULE_ATTEND_DURATION,
          ease: CAPSULE_ATTEND_EASE,
          overwrite: "auto",
        });
        gsap.to(bottomLineRef.current, {
          attr: bottom,
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

  // Flash pop (collapsed only): bouncy scale + accent blink at 40% opacity.
  useLayoutEffect(() => {
    if (popKey === previousPopKeyRef.current) return;
    const departed = popKey === undefined || popKey === "";
    previousPopKeyRef.current = popKey;

    const element = elementRef.current;
    const flashOverlay = flashOverlayRef.current;
    if (element === null || reducedMotion || isExpanded) return;

    const fromSize = collapsedSizeRef.current;

    gsap.killTweensOf(element);
    popTimelineRef.current?.kill();
    element.style.transition = "none";
    element.style.width = "";
    element.style.height = "";
    element.style.minWidth = "";
    gsap.set(element, { x: 0, scale: 1, opacity: 1 });
    if (flashOverlay) gsap.set(flashOverlay, { opacity: 0 });
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
        if (flashOverlay) gsap.set(flashOverlay, { opacity: 0 });
        element.style.transition = "";
        element.style.borderRadius = "";
        morphingRef.current = false;
        collapsedSizeRef.current = { width: targetWidth, height: targetHeight };
      },
    });
    popTimelineRef.current = timeline;

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
      // Arrival: bouncy scale + accent flash blink at 40% opacity.
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
        .to(element, { opacity: 0.65, duration: 0.05, ease: "power1.in" }, 0.12)
        .to(element, { opacity: 1, duration: 0.06, ease: "power1.out" }, 0.17);

      // Accent flash overlay blink (40% opacity).
      if (flashOverlay) {
        timeline
          .fromTo(
            flashOverlay,
            { opacity: 0 },
            { opacity: 0.4, duration: 0.08, ease: "power1.out" },
            0,
          )
          .to(flashOverlay, { opacity: 0.15, duration: 0.06, ease: "power1.in" }, 0.1)
          .to(flashOverlay, { opacity: 0.4, duration: 0.07, ease: "power1.out" }, 0.16)
          .to(flashOverlay, { opacity: 0, duration: 0.08, ease: "power1.in" }, 0.23);
      }
    }
  }, [popKey, isExpanded, reducedMotion]);

  useEffect(
    () => () => {
      popTimelineRef.current?.kill();
    },
    [],
  );

  // Track size for progress lines.
  useEffect(() => {
    const element = elementRef.current;
    if (element === null || progressPercent === undefined) {
      setProgressSize(null);
      return;
    }

    const update = () => {
      if (morphingRef.current) return;
      setProgressSize({ width: element.offsetWidth, height: element.offsetHeight });
    };
    update();

    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [progressPercent, isExpanded]);

  const positionClass =
    reducedMotion && isExpanded ? "left-1/2 -translate-x-1/2" : "left-0";

  const progress = Math.min(Math.max(progressPercent ?? 0, 0), 100);
  const inset = PROGRESS_INSET_PX;

  // Tone class for glass panel (base color). Flash overlay handles accent.
  const glassClass = tone === "accent" ? "glass-panel-accent" : "glass-panel-bare";

  return (
    <button
      ref={elementRef}
      type="button"
      onClick={handleToggle}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      aria-expanded={isExpanded}
      aria-label={ariaLabel}
      className={`pointer-events-auto absolute z-30 select-none text-left overflow-hidden ${positionClass} ${
        isExpanded
          ? "max-w-[calc(100vw-1rem)] min-w-64 rounded-[20px] p-capsule-pad"
          : "min-h-12 rounded-full px-capsule-pad-sm"
      } transition-[padding,opacity] duration-300 ease-out active:opacity-80 ${glassClass} ${className ?? ""}`}
      style={{
        // CSS variable for border-radius animated by GSAP.
        // The actual radius is set inline by GSAP; this is the resting value.
        borderRadius: isExpanded ? `${EXPANDED_RADIUS_PX}px` : "30px",
      }}
    >
      {/* Accent flash overlay (40% opacity) - sits behind content, above glass. */}
      <div
        ref={flashOverlayRef}
        className="pointer-events-none absolute inset-0"
        style={{
          background: "var(--studia-cobalto)",
          borderRadius: "inherit",
          opacity: 0,
        }}
        aria-hidden="true"
      />

      {/* Progress lines (top + bottom), fill left→right. */}
      {progressPercent !== undefined ? (
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full"
        >
          {progressSize !== null &&
          progressSize.width > 0 &&
          progressSize.height > 0 ? (
            <>
              <line
                ref={topLineRef}
                x1={inset}
                y1={inset}
                x2={inset + progressSize.width * (progress / 100) - inset}
                y2={inset}
                stroke="var(--studia-cobalto)"
                strokeWidth={PROGRESS_STROKE_PX}
                vectorEffect="non-scaling-stroke"
                strokeLinecap="round"
              />
              <line
                ref={bottomLineRef}
                x1={inset}
                y1={progressSize.height - inset}
                x2={inset + progressSize.width * (progress / 100) - inset}
                y2={progressSize.height - inset}
                stroke="var(--studia-cobalto)"
                strokeWidth={PROGRESS_STROKE_PX}
                vectorEffect="non-scaling-stroke"
                strokeLinecap="round"
              />
            </>
          ) : null}
        </svg>
      ) : null}

      {/* Content: same anchor in both states, scaled via transform when expanded. */}
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
            <div className="min-w-0">
              {minimized}
            </div>
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