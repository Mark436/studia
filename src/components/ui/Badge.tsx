import type { ReactNode } from "react";

type BadgeVariant = "primary" | "neutral" | "success" | "warning" | "error";

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  primary: "bg-primary-container text-on-primary-container",
  neutral: "bg-outline-variant/60 text-on-surface-variant",
  success: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  warning: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  error: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
};

interface BadgeProps {
  variant?: BadgeVariant;
  className?: string;
  children: ReactNode;
}

export function Badge({
  variant = "neutral",
  className,
  children,
}: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
        className ?? ""
      } ${VARIANT_CLASSES[variant]}`}
    >
      {children}
    </span>
  );
}
