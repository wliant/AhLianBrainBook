"use client";

import type { Section } from "@/types";
import { Info, AlertTriangle, Lightbulb, StickyNote } from "lucide-react";
import { cn } from "@/lib/utils";

const VARIANTS = {
  info: { icon: Info, bg: "bg-blue-50 dark:bg-blue-950/30", border: "border-blue-200 dark:border-blue-800", label: "Info" },
  warning: { icon: AlertTriangle, bg: "bg-amber-50 dark:bg-amber-950/30", border: "border-amber-200 dark:border-amber-800", label: "Warning" },
  tip: { icon: Lightbulb, bg: "bg-green-50 dark:bg-green-950/30", border: "border-green-200 dark:border-green-800", label: "Tip" },
  note: { icon: StickyNote, bg: "bg-purple-50 dark:bg-purple-950/30", border: "border-purple-200 dark:border-purple-800", label: "Note" },
} as const;

type CalloutVariant = keyof typeof VARIANTS;

interface CalloutSectionProps {
  section: Section;
  onUpdate: (content: Record<string, unknown>) => void;
}

export function CalloutSection({ section, onUpdate }: CalloutSectionProps) {
  const variant = (section.content.variant as CalloutVariant) || "info";
  const text = (section.content.text as string) || "";
  const config = VARIANTS[variant];
  const Icon = config.icon;

  return (
    <div className={cn("border rounded-lg overflow-hidden", config.border, config.bg)}>
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-inherit">
        <Icon className="h-4 w-4" />
        <select
          value={variant}
          onChange={(e) =>
            onUpdate({ variant: e.target.value, text })
          }
          className="text-xs bg-transparent border rounded px-1.5 py-0.5 outline-none"
        >
          {Object.entries(VARIANTS).map(([key, val]) => (
            <option key={key} value={key}>
              {val.label}
            </option>
          ))}
        </select>
      </div>
      <textarea
        value={text}
        onChange={(e) => onUpdate({ variant, text: e.target.value })}
        placeholder={`${config.label}...`}
        className="w-full p-3 text-sm bg-transparent border-none outline-none resize-y min-h-[40px]"
      />
    </div>
  );
}
