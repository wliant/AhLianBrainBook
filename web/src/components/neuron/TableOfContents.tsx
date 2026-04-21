"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { SectionsDocument } from "@/types";

interface TocHeading {
  id: string;
  sectionId: string;
  headingIndex: number;
  level: number;
  text: string;
}

function extractHeadings(doc: SectionsDocument): TocHeading[] {
  const headings: TocHeading[] = [];

  for (const section of doc.sections) {
    if (section.type !== "rich-text") continue;

    const content = section.content as { type?: string; content?: unknown[] };
    if (!content?.content || !Array.isArray(content.content)) continue;

    let headingIndex = 0;
    for (const node of content.content) {
      const n = node as { type?: string; attrs?: { level?: number }; content?: Array<{ text?: string }> };
      if (n.type === "heading" && n.attrs?.level) {
        const text = (n.content || [])
          .map((child) => child.text || "")
          .join("");
        if (text.trim()) {
          headings.push({
            id: `${section.id}-h-${headingIndex}`,
            sectionId: section.id,
            headingIndex,
            level: n.attrs.level,
            text: text.trim(),
          });
        }
        headingIndex++;
      }
    }
  }

  return headings;
}

function getHeadingElements(): Element[] {
  return Array.from(
    document.querySelectorAll("[data-section-id] h1, [data-section-id] h2, [data-section-id] h3")
  );
}

export function TableOfContents({
  document: doc,
  onClose,
}: {
  document: SectionsDocument;
  onClose: () => void;
}) {
  const headings = extractHeadings(doc);
  const [activeId, setActiveId] = useState<string | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const setupObserver = useCallback(() => {
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    const headingElements = getHeadingElements();
    if (headingElements.length === 0) return;

    // Build a mapping from DOM elements to our heading IDs
    const elementToId = new Map<Element, string>();
    const sectionHeadingCounts = new Map<string, number>();

    for (const el of headingElements) {
      const sectionEl = el.closest("[data-section-id]");
      if (!sectionEl) continue;
      const sectionId = sectionEl.getAttribute("data-section-id");
      if (!sectionId) continue;

      const count = sectionHeadingCounts.get(sectionId) || 0;
      const id = `${sectionId}-h-${count}`;
      elementToId.set(el, id);
      sectionHeadingCounts.set(sectionId, count + 1);
    }

    observerRef.current = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const id = elementToId.get(entry.target);
            if (id) setActiveId(id);
          }
        }
      },
      { rootMargin: "0px 0px -80% 0px" }
    );

    for (const el of headingElements) {
      observerRef.current.observe(el);
    }
  }, []);

  useEffect(() => {
    // Small delay to let the DOM render
    const timer = setTimeout(setupObserver, 100);
    return () => {
      clearTimeout(timer);
      observerRef.current?.disconnect();
    };
  }, [setupObserver, doc]);

  const scrollToHeading = (heading: TocHeading) => {
    const sectionEl = document.querySelector(`[data-section-id="${heading.sectionId}"]`);
    if (!sectionEl) return;

    const headingEls = sectionEl.querySelectorAll("h1, h2, h3");
    const target = headingEls[heading.headingIndex];
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <div className="flex flex-col h-full bg-background" data-testid="toc-panel">
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <h3 className="font-semibold text-sm">Table of Contents</h3>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-4">
        {headings.length === 0 ? (
          <p className="text-xs text-muted-foreground px-2 py-4">
            No headings found. Add headings (H1, H2, H3) to your content to generate an outline.
          </p>
        ) : (
          <nav className="py-2">
            {headings.map((heading) => (
              <button
                key={heading.id}
                onClick={() => scrollToHeading(heading)}
                className={cn(
                  "w-full text-left text-sm py-1 px-2 rounded-md hover:bg-accent truncate block transition-colors",
                  heading.level === 1 && "pl-2 font-medium",
                  heading.level === 2 && "pl-5",
                  heading.level === 3 && "pl-8 text-muted-foreground",
                  activeId === heading.id && "bg-accent text-primary font-medium"
                )}
                title={heading.text}
              >
                {heading.text}
              </button>
            ))}
          </nav>
        )}
      </div>
    </div>
  );
}
