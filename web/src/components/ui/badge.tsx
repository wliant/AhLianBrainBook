import { cn } from "@/lib/utils";

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "outline";
}

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium transition-colors",
        variant === "default" && "bg-primary/10 text-primary",
        variant === "outline" && "border border-input text-foreground",
        className
      )}
      {...props}
    />
  );
}
