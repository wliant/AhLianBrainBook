"use client";

import { useState, useEffect, useRef, useId } from "react";
import type { Section } from "@/types";

interface DiagramSectionProps {
  section: Section;
  onUpdate: (content: Record<string, unknown>) => void;
}

export function DiagramSection({ section, onUpdate }: DiagramSectionProps) {
  const source = (section.content.source as string) || "";
  const [editing, setEditing] = useState(!source);
  const previewRef = useRef<HTMLDivElement>(null);
  const uniqueId = useId().replace(/:/g, "-");

  useEffect(() => {
    if (!previewRef.current || !source) return;

    let cancelled = false;
    (async () => {
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({ startOnLoad: false, theme: "default" });
        const { svg } = await mermaid.render(`mermaid-${uniqueId}`, source);
        if (!cancelled && previewRef.current) {
          previewRef.current.innerHTML = svg;
        }
      } catch {
        if (!cancelled && previewRef.current) {
          previewRef.current.innerHTML = `<span class="text-destructive text-sm">Invalid Mermaid syntax</span>`;
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [source, uniqueId]);

  if (editing) {
    return (
      <div className="border rounded-lg overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 border-b">
          <span className="text-xs text-muted-foreground font-medium">Mermaid Diagram</span>
          {source && (
            <button
              onClick={() => setEditing(false)}
              className="text-xs text-primary ml-auto hover:underline"
            >
              Preview
            </button>
          )}
        </div>
        <textarea
          value={source}
          onChange={(e) =>
            onUpdate({ source: e.target.value, diagramType: "mermaid" })
          }
          placeholder={`graph TD\n    A[Start] --> B{Decision}\n    B -->|Yes| C[OK]\n    B -->|No| D[End]`}
          className="w-full p-3 font-mono text-sm bg-transparent border-none outline-none resize-y min-h-[120px]"
          autoFocus
        />
        {source && (
          <div className="border-t p-3 bg-white dark:bg-zinc-900">
            <div ref={previewRef} className="overflow-x-auto flex justify-center" />
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className="border rounded-lg p-4 cursor-pointer hover:bg-muted/30 transition-colors"
      onClick={() => setEditing(true)}
    >
      <div ref={previewRef} className="overflow-x-auto flex justify-center" />
    </div>
  );
}
