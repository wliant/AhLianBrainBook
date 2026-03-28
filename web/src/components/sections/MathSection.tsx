"use client";

import { useState, useEffect, useRef } from "react";
import type { Section } from "@/types";

interface MathSectionProps {
  section: Section;
  onUpdate: (content: Record<string, unknown>) => void;
  editing?: boolean;
}

export function MathSection({ section, onUpdate, editing: editingProp = true }: MathSectionProps) {
  const latex = (section.content.latex as string) || "";
  const displayMode = (section.content.displayMode as boolean) ?? true;
  const [internalEditing, setInternalEditing] = useState(!latex);
  const previewRef = useRef<HTMLDivElement>(null);

  const isEditing = editingProp && internalEditing;

  useEffect(() => {
    if (previewRef.current && latex) {
      (async () => {
        try {
          const katex = (await import("katex")).default;
          await import("katex/dist/katex.min.css");
          if (previewRef.current) {
            previewRef.current.innerHTML = katex.renderToString(latex, {
              displayMode,
              throwOnError: false,
            });
          }
        } catch {
          if (previewRef.current) {
            previewRef.current.innerHTML = `<span class="text-destructive text-sm">Invalid LaTeX</span>`;
          }
        }
      })();
    }
  }, [latex, displayMode]);

  if (isEditing) {
    return (
      <div className="border rounded-lg overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 border-b">
          <span className="text-xs text-muted-foreground font-medium">LaTeX</span>
          <label className="flex items-center gap-1 text-xs text-muted-foreground ml-auto">
            <input
              type="checkbox"
              checked={displayMode}
              onChange={(e) =>
                onUpdate({ latex, displayMode: e.target.checked })
              }
              className="h-3 w-3"
            />
            Display mode
          </label>
        </div>
        <textarea
          value={latex}
          onChange={(e) => onUpdate({ latex: e.target.value, displayMode })}
          onBlur={() => latex && setInternalEditing(false)}
          placeholder="Enter LaTeX expression, e.g. E = mc^2"
          className="w-full p-3 font-mono text-sm bg-transparent border-none outline-none resize-y min-h-[60px]"
          autoFocus
        />
        {latex && (
          <div className="border-t p-3">
            <div ref={previewRef} className="overflow-x-auto" />
          </div>
        )}
      </div>
    );
  }

  if (!latex) {
    return (
      <div className="border rounded-lg p-4 text-center text-sm text-muted-foreground italic">
        Empty math block
      </div>
    );
  }

  return (
    <div
      className="border rounded-lg p-4 cursor-pointer hover:bg-muted/30 transition-colors overflow-x-auto"
      onClick={() => editingProp && setInternalEditing(true)}
    >
      <div ref={previewRef} />
    </div>
  );
}
