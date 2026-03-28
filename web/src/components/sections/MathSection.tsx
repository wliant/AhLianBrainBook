"use client";

import { useEffect, useRef } from "react";
import type { Section } from "@/types";

interface MathSectionProps {
  section: Section;
  onUpdate: (content: Record<string, unknown>) => void;
  editing?: boolean;
}

export function MathSection({ section, onUpdate, editing = true }: MathSectionProps) {
  const latex = (section.content.latex as string) || "";
  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editing || !previewRef.current || !latex) return;

    (async () => {
      try {
        const katex = (await import("katex")).default;
        await import("katex/dist/katex.min.css");
        if (previewRef.current) {
          previewRef.current.innerHTML = katex.renderToString(latex, {
            displayMode: true,
            throwOnError: false,
          });
        }
      } catch {
        if (previewRef.current) {
          previewRef.current.innerHTML = `<span class="text-destructive text-sm">Invalid LaTeX</span>`;
        }
      }
    })();
  }, [latex, editing]);

  if (editing) {
    return (
      <div className="border rounded-lg overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 border-b">
          <span className="text-xs text-muted-foreground font-medium">LaTeX</span>
        </div>
        <textarea
          value={latex}
          onChange={(e) => onUpdate({ latex: e.target.value })}
          placeholder="Enter LaTeX expression, e.g. E = mc^2"
          className="w-full p-3 font-mono text-sm bg-transparent border-none outline-none resize-y min-h-[60px]"
        />
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
    <div className="border rounded-lg p-4 overflow-x-auto">
      <div ref={previewRef} />
    </div>
  );
}
