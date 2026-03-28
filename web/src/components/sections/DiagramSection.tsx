"use client";

import { useEffect, useRef, useId } from "react";
import type { Section } from "@/types";

interface DiagramSectionProps {
  section: Section;
  onUpdate: (content: Record<string, unknown>) => void;
  editing?: boolean;
}

export function DiagramSection({ section, onUpdate, editing = true }: DiagramSectionProps) {
  const source = (section.content.source as string) || "";
  const previewRef = useRef<HTMLDivElement>(null);
  const uniqueId = useId().replace(/:/g, "-");

  useEffect(() => {
    if (editing || !previewRef.current || !source) return;

    let cancelled = false;
    (async () => {
      try {
        const mermaid = (await import("mermaid")).default;
        const isDark = document.documentElement.classList.contains("dark");
        mermaid.initialize({
          startOnLoad: false,
          theme: "base",
          themeVariables: isDark
            ? { primaryColor: "#1e3a5f", primaryTextColor: "#f1f5f9", lineColor: "#e2e8f0", background: "#0f172a", mainBkg: "#1e293b", nodeBorder: "#64748b", clusterBkg: "#1e293b", edgeLabelBackground: "#1e293b", fontFamily: "inherit" }
            : { primaryColor: "#dbeafe", primaryTextColor: "#1e293b", lineColor: "#334155", background: "#ffffff", mainBkg: "#eff6ff", nodeBorder: "#93c5fd", clusterBkg: "#f8fafc", edgeLabelBackground: "#ffffff", fontFamily: "inherit" },
        });
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
  }, [source, uniqueId, editing]);

  if (editing) {
    return (
      <div className="border rounded-lg overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 border-b">
          <span className="text-xs text-muted-foreground font-medium">Mermaid Diagram</span>
        </div>
        <textarea
          value={source}
          onChange={(e) =>
            onUpdate({ source: e.target.value, diagramType: "mermaid" })
          }
          placeholder={`graph TD\n    A[Start] --> B{Decision}\n    B -->|Yes| C[OK]\n    B -->|No| D[End]`}
          className="w-full p-3 font-mono text-sm bg-transparent border-none outline-none resize-y min-h-[120px]"
        />
      </div>
    );
  }

  if (!source) {
    return (
      <div className="border rounded-lg p-4 text-center text-sm text-muted-foreground italic">
        Empty diagram
      </div>
    );
  }

  return (
    <div className="border rounded-lg p-4">
      <div ref={previewRef} className="overflow-x-auto flex justify-center" />
    </div>
  );
}
