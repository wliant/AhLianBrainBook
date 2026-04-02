"use client";

import type { CompletenessLevel } from "@/types";

const LEVEL_CONFIG: Record<CompletenessLevel, { label: string; color: string; bg: string }> = {
  none: { label: "None", color: "text-muted-foreground", bg: "bg-muted" },
  partial: { label: "Partial", color: "text-yellow-600 dark:text-yellow-400", bg: "bg-yellow-500/20" },
  good: { label: "Good", color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-500/20" },
  complete: { label: "Complete", color: "text-green-600 dark:text-green-400", bg: "bg-green-500/20" },
};

export function CompletenessIndicator({ level }: { level: CompletenessLevel }) {
  const config = LEVEL_CONFIG[level] || LEVEL_CONFIG.none;
  return (
    <span className={`text-[11px] px-1.5 py-0.5 rounded font-medium ${config.color} ${config.bg}`}>
      {config.label}
    </span>
  );
}

export function CompletenessBar({ level }: { level: CompletenessLevel }) {
  const widths: Record<CompletenessLevel, string> = {
    none: "w-0",
    partial: "w-1/4",
    good: "w-3/4",
    complete: "w-full",
  };
  const colors: Record<CompletenessLevel, string> = {
    none: "bg-muted",
    partial: "bg-yellow-500",
    good: "bg-blue-500",
    complete: "bg-green-500",
  };
  return (
    <div className="h-1.5 w-16 bg-muted rounded-full overflow-hidden">
      <div className={`h-full rounded-full transition-all ${widths[level]} ${colors[level]}`} />
    </div>
  );
}
