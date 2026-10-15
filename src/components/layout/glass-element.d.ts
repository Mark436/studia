import type { DetailedHTMLProps, HTMLAttributes } from "react";

// The `<glass-element>` custom element is provided by the vendored Liquid Glass
// web component (public/glass/*.js) loaded from index.html. React 19 needs its
// tags declared so JSX can reference it with the right attribute types.
declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "glass-element": DetailedHTMLProps<
        HTMLAttributes<HTMLElement>,
        HTMLElement
      > & {
        width?: number | string;
        height?: number | string;
        radius?: number | string;
        depth?: number | string;
        blur?: number | string;
        strength?: number | string;
        "chromatic-aberration"?: number | string;
        "background-color"?: string;
        "auto-size"?: boolean;
        debug?: boolean;
        responsive?: boolean;
        "base-width"?: number | string;
        "base-height"?: number | string;
        "min-width"?: number | string;
        "min-height"?: number | string;
      };
    }
  }
}
