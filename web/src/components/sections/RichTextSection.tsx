"use client";

import { TiptapEditor } from "@/components/editor/TiptapEditor";
import type { Section } from "@/types";

interface RichTextSectionProps {
  section: Section;
  onUpdate: (content: Record<string, unknown>, text: string) => void;
}

export function RichTextSection({ section, onUpdate }: RichTextSectionProps) {
  return (
    <TiptapEditor
      content={section.content as Record<string, unknown>}
      onUpdate={onUpdate}
    />
  );
}
