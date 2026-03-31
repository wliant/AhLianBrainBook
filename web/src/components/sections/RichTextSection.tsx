"use client";

import { TiptapEditor } from "@/components/editor/TiptapEditor";
import { useSettings } from "@/lib/hooks/useSettings";
import type { Section, SectionType } from "@/types";

interface RichTextSectionProps {
  section: Section;
  onUpdate: (content: Record<string, unknown>, text: string) => void;
  editing?: boolean;
  onInsertSection?: (type: SectionType) => void;
  brainId?: string;
}

export function RichTextSection({ section, onUpdate, editing = true, onInsertSection, brainId }: RichTextSectionProps) {
  const { settings } = useSettings();

  return (
    <TiptapEditor
      content={section.content as Record<string, unknown>}
      onUpdate={onUpdate}
      editable={editing}
      onInsertSection={onInsertSection}
      brainId={brainId}
      editorMode={settings?.editorMode}
    />
  );
}
