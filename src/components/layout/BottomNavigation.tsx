import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import gsap from "gsap";
import { PILL_SLIDE_DURATION, PILL_SLIDE_EASE } from "@/lib/motion/eases";

export interface BottomNavigationItem<T extends string = string> {
  id: T;
  label: string;
  icon: ReactNode;
}

interface BottomNavigationProps<T extends string> {
  items: ReadonlyArray<BottomNavigationItem<T>>;
  activeId: T;
  onSelect: (id: T) => void;
}

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// Tuning for the active pill's liquid-glass surface (`<glass-element>`, see
// public/glass). Width/height/radius are derived from the measured button.
const GLASS_ATTRIBUTES = {
  depth: "5",
  blur: "1",
  strength: "40",
  "chromatic-aberration": "2",
  "background-color":
    "color-mix(in oklab, var(--studia-cobalto) 12%, transparent)",
} as const;

// Floating glass pill: the navigation reads as one object hovering over the
// content instead of a full-width bar bolted to the viewport edge. The active
// tab is a sliding foreground pill that glides between positions with a subtle
// bounce; icon and label keep their ink color so selection never relies on a
// chromatic swap.
export function BottomNavigation<T extends string>({
  items,
  activeId,
  onSelect,
}: BottomNavigationProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const indicatorRef = useRef<HTMLSpanElement>(null);
  const glassRef = useRef<HTMLElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [pillSize, setPillSize] = useState({ width: 0, height: 0 });
  const activeIndex = items.findIndex((item) => item.id === activeId);

  // Position the indicator exactly over the active button. Called on every
  // selection, resize, and size change of the container.
  function placeIndicator(animate: boolean): void {
    const container = containerRef.current;
    const indicator = indicatorRef.current;
    const button = itemRefs.current[activeIndex];
    if (container === null || indicator === null || button === null) return;

    const left = button.offsetLeft;
    const width = button.offsetWidth;
    const height = button.offsetHeight;
    setPillSize((current) =>
      current.width === width && current.height === height
        ? current
        : { width, height },
    );

    if (animate && !prefersReducedMotion()) {
      gsap.to(indicator, {
        x: left,
        duration: PILL_SLIDE_DURATION,
        ease: PILL_SLIDE_EASE,
        overwrite: "auto",
      });
    } else {
      gsap.killTweensOf(indicator);
      indicator.style.transform = `translateX(${left}px)`;
    }
  }

  useLayoutEffect(() => {
    placeIndicator(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount positioning only.
  }, []);

  useLayoutEffect(() => {
    placeIndicator(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- animate per active change.
  }, [activeIndex]);

  useEffect(() => {
    placeIndicator(false);

    const observer = new ResizeObserver(() => placeIndicator(false));
    const container = containerRef.current;
    const indicator = indicatorRef.current;
    if (container !== null) observer.observe(container);

    return () => {
      observer.disconnect();
      if (indicator !== null) gsap.killTweensOf(indicator);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- resize/fonts only.
  }, []);

  // Feed the measured pill geometry to the glass web component. Attributes are
  // set imperatively: React assigns custom-element props as DOM properties, and
  // `<glass-element>` exposes read-only getters for width/height/depth/… which
  // would throw on assignment.
  useLayoutEffect(() => {
    const glass = glassRef.current;
    if (glass === null || pillSize.width === 0) return;

    glass.setAttribute("width", String(pillSize.width));
    glass.setAttribute("height", String(pillSize.height));
    glass.setAttribute("radius", String(Math.round(pillSize.height / 2)));
    for (const [name, value] of Object.entries(GLASS_ATTRIBUTES)) {
      glass.setAttribute(name, value);
    }
  }, [pillSize]);

  return (
    <nav
      aria-label="Navegación principal"
      className="pointer-events-none flex justify-center pb-[max(env(safe-area-inset-bottom),10px)]"
    >
      <div
        ref={containerRef}
        className="glass-panel elevated pointer-events-auto relative mx-4 flex w-full max-w-sm items-center gap-1 rounded-full p-1.5"
      >
        <span
          ref={indicatorRef}
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-1.5 left-0"
          style={{ width: pillSize.width > 0 ? pillSize.width : undefined }}
        >
          <glass-element ref={glassRef} />
        </span>
        {items.map((item, index) => {
          const isActive = item.id === activeId;

          return (
            <button
              key={item.id}
              ref={(element) => {
                itemRefs.current[index] = element;
              }}
              type="button"
              onClick={() => onSelect(item.id)}
              aria-current={isActive ? "page" : undefined}
              className="relative flex min-h-12 flex-1 flex-col items-center justify-center gap-0.5 rounded-full text-[11px] font-medium text-on-surface focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary active:scale-[0.97]"
            >
              <span className="flex h-6 items-center justify-center">
                {item.icon}
              </span>
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}