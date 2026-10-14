import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import gsap from "gsap";
import {
  CAPSULE_COLLAPSE_DURATION,
  CAPSULE_COLLAPSE_EASE,
  CAPSULE_MORPH_DURATION,
  CAPSULE_MORPH_EASE,
} from "./eases";

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Sliding reveal synced to the context capsule. While `expanded` is true the
 * referenced element slides out past the right edge; when the capsule collapses
 * it slides back in. It reuses the capsule's morph duration/ease so both read as
 * a single gesture. Pair the ref with an `overflow-x-clip` wrapper so the exit
 * does not create horizontal scroll.
 *
 * Returns a callback ref, so it is safe for elements that mount after the first
 * render (loading/empty branches).
 */
export function useCapsuleSlideOut<T extends HTMLElement>(expanded: boolean) {
  const [element, setElement] = useState<T | null>(null);
  const ref = useCallback((node: T | null) => setElement(node), []);

  useLayoutEffect(() => {
    if (element === null) return;

    const distance = element.offsetWidth + 16;
    gsap.killTweensOf(element);

    if (prefersReducedMotion()) {
      gsap.set(element, { x: expanded ? distance : 0 });
      return;
    }

    gsap.to(element, {
      x: expanded ? distance : 0,
      duration: expanded ? CAPSULE_MORPH_DURATION : CAPSULE_COLLAPSE_DURATION,
      ease: expanded ? CAPSULE_MORPH_EASE : CAPSULE_COLLAPSE_EASE,
    });
  }, [expanded, element]);

  useEffect(() => {
    if (element === null) return;
    return () => {
      gsap.killTweensOf(element);
    };
  }, [element]);

  return ref;
}
