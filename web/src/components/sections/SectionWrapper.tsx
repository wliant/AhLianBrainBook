"use client";

import type { Section } from "@/types";
import { ChevronUp, ChevronDown, Trash2, GripVertical, Eye, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";

const TYPE_LABELS: Record<string, string> = {
  "rich-text": "Rich Text",
  code: "Code",
  math: "Math",
  diagram: "Diagram",
  callout: "Callout",
  divider: "Divider",
  image: "Image",
  table: "Table",
  audio: "Audio",
};

interface SectionWrapperProps {
  section: Section;
  isFirst: boolean;
  isLast: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
  onTogglePreview?: () => void;
  viewMode?: boolean;
  children: React.ReactNode;
}

export function SectionWrapper({
  section,
  isFirst,
  isLast,
  onMoveUp,
  onMoveDown,
  onDelete,
  onTogglePreview,
  viewMode,
  children,
}: SectionWrapperProps) {
  const isPreview = !!section.meta?.preview;

  return (
    <div className="group relative">
      {!viewMode && (
        <div
          className={cn(
            "absolute -left-10 top-0 flex flex-col items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity",
            section.type === "divider" && "top-1/2 -translate-y-1/2"
          )}
        >
          <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
          {section.type !== "divider" && onTogglePreview && (
            <button
              onClick={onTogglePreview}
              className="p-0.5 text-muted-foreground hover:text-foreground"
              title={isPreview ? "Switch to Edit" : "Switch to Preview"}
            >
              {isPreview ? <Pencil className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
            </button>
          )}
          <button
            onClick={onMoveUp}
            disabled={isFirst}
            className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30"
            title="Move up"
          >
            <ChevronUp className="h-3 w-3" />
          </button>
          <button
            onClick={onMoveDown}
            disabled={isLast}
            className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30"
            title="Move down"
          >
            <ChevronDown className="h-3 w-3" />
          </button>
          <button
            onClick={onDelete}
            className="p-0.5 text-muted-foreground hover:text-destructive"
            title="Delete section"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      )}
      <div className={cn(
        "rounded-lg transition-shadow",
        !viewMode && "group-hover:ring-1 group-hover:ring-border/50"
      )}>
        {!viewMode && section.type !== "divider" && section.type !== "rich-text" && (
          <div className="flex items-center px-1 py-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
              {TYPE_LABELS[section.type]}
            </span>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
