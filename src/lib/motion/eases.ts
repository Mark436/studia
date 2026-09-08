// Single motion vocabulary for the liquid subtle-bounce system (docs/design.md
// §5). Shared by the bottom-navigation pill, page transitions and the capsule
// morph so the whole app moves with the same feel.

/** Sliding active-pill in the bottom navigation. */
export const PILL_SLIDE_DURATION = 0.5;
export const PILL_SLIDE_EASE = "back.out(1.6)";

/** Page content transition: quick fade-out of the current tab. */
export const PAGE_EXIT_DURATION = 0.18;
export const PAGE_EXIT_EASE = "power2.in";

/** Page content transition: bounce entrance of the next tab. */
export const PAGE_ENTER_DURATION = 0.5;
export const PAGE_ENTER_EASE = "back.out(1.5)";

// Capsule open/close morph (size + position via GSAP Flip). Position travels
// horizontally (collapsed left → centered), so the ease settles without
// overshoot: a back.out here makes the capsule fling past its final x and
// snap back. Smoother bounce lives in the pill and page transitions.
export const CAPSULE_MORPH_DURATION = 0.6;
export const CAPSULE_MORPH_EASE = "power3.out";

// Collapse is slightly faster and snappier than expand: it should feel
// decisive, not sluggish. power2.inOut gives a quick start and clean stop
// without the "sticky" feel of power3.in.
export const CAPSULE_COLLAPSE_DURATION = 0.45;
export const CAPSULE_COLLAPSE_EASE = "power2.inOut";

// Transient flash announce (collapsed capsule grows to fit a new alert):
// bouncy so the size change reads as an event, not a layout jump. The
// blink (a quick opacity flicker) rides on the same pop.
export const CAPSULE_FLASH_DURATION = 0.6;
export const CAPSULE_FLASH_EASE = "back.out(2)";

// Content swap while the capsule stays in the same state (the "size attend"
// tracker in Capsule.tsx): a short, quiet tween so the box follows a new
// natural size instead of hopping. Discreet on purpose — content changes are
// layout upkeep, not events. Once `interpolate-size` is broadly supported
// this JS tracker goes away and a plain CSS height transition covers it.
export const CAPSULE_ATTEND_DURATION = 0.3;
export const CAPSULE_ATTEND_EASE = "power2.out";

/** Capsule border-radius morph, tuned not to lag the Flip silhouette. */
export const CAPSULE_RADIUS_DURATION = 0.5;
export const CAPSULE_RADIUS_EASE = "power3.out";