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

// Collapse travels back a touch slower than the expansion, so leaving the
// expanded card reads as deliberate rather than a snap.
export const CAPSULE_COLLAPSE_DURATION = 0.8;
export const CAPSULE_COLLAPSE_EASE = "power3.out";

/** Capsule border-radius morph, tuned not to lag the Flip silhouette. */
export const CAPSULE_RADIUS_DURATION = 0.5;
export const CAPSULE_RADIUS_EASE = "power3.out";