import { SpinnerIcon } from "@/components/ui/icons";

interface SpinnerProps {
  size?: number;
  className?: string;
}

export function Spinner({ size = 20, className }: SpinnerProps) {
  return (
    <SpinnerIcon
      size={size}
      className={`animate-spin ${className ?? ""}`}
    />
  );
}