"use client";

import { useCallback, useRef, lazy, Suspense } from "react";
import type { Section, SectionType, SectionsDocument } from "@/types";
import { createSection } from "./sectionUtils";
import { SectionWrapper } from "./SectionWrapper";
import { AddSectionButton } from "./AddSectionButton";
import { RichTextSection } from "./RichTextSection";
import { CalloutSection } from "./CalloutSection";
import { DividerSection } from "./DividerSection";
import { ImageSection } from "./ImageSection";
import { TableSection } from "./TableSection";
import { api } from "@/lib/api";

const CodeSection = lazy(() =>
  import("./CodeSection").then((m) => ({ default: m.CodeSection }))
);
const MathSection = lazy(() =>
  import("./MathSection").then((m) => ({ default: m.MathSection }))
);
const DiagramSection = lazy(() =>
  import("./DiagramSection").then((m) => ({ default: m.DiagramSection }))
);

interface SectionListProps {
  document: SectionsDocument;
  onDocumentChange: (doc: SectionsDocument) => void;
  richTextTextsRef: React.MutableRefObject<Map<string, string>>;
  presentationMode?: boolean;
  neuronId?: string;
}

export function SectionList({
  document,
  onDocumentChange,
  richTextTextsRef,
  presentationMode = false,
  neuronId,
}: SectionListProps) {
  const sections = document.sections;
  const sectionsRef = useRef(sections);
  sectionsRef.current = sections;


  const updateSections = useCallback(
    (newSections: Section[]) => {
      onDocumentChange({ version: 2, sections: newSections });
    },
    [onDocumentChange]
  );

  const addSection = useCallback(
    (type: SectionType, afterIndex: number) => {
      const current = sectionsRef.current;
      const newSection = createSection(type, afterIndex + 1);
      const updated = [
        ...current.slice(0, afterIndex + 1),
        newSection,
        ...current.slice(afterIndex + 1),
      ].map((s, i) => ({ ...s, order: i }));
      updateSections(updated);
    },
    [updateSections]
  );

  const addSectionAtEnd = useCallback(
    (type: SectionType) => {
      addSection(type, sectionsRef.current.length - 1);
    },
    [addSection]
  );

  const updateSection = useCallback(
    (id: string, content: Record<string, unknown>) => {
      const updated = sectionsRef.current.map((s) =>
        s.id === id ? { ...s, content } : s
      );
      updateSections(updated);
    },
    [updateSections]
  );

  const deleteSection = useCallback(
    (id: string) => {
      const section = sectionsRef.current.find((s) => s.id === id);
      if (section?.type === "image" && section.content.sourceType === "upload" && section.content.attachmentId) {
        api.delete(`/api/attachments/${section.content.attachmentId}`).catch(() => {});
      }
      const updated = sectionsRef.current
        .filter((s) => s.id !== id)
        .map((s, i) => ({ ...s, order: i }));
      richTextTextsRef.current.delete(id);
      updateSections(updated);
    },
    [updateSections, richTextTextsRef]
  );

  const moveSection = useCallback(
    (id: string, direction: "up" | "down") => {
      const current = sectionsRef.current;
      const idx = current.findIndex((s) => s.id === id);
      if (idx < 0) return;
      const targetIdx = direction === "up" ? idx - 1 : idx + 1;
      if (targetIdx < 0 || targetIdx >= current.length) return;
      const updated = [...current];
      [updated[idx], updated[targetIdx]] = [updated[targetIdx], updated[idx]];
      updateSections(updated.map((s, i) => ({ ...s, order: i })));
    },
    [updateSections]
  );

  const renderSection = (section: Section, isEditing: boolean) => {
    switch (section.type) {
      case "rich-text":
        return (
          <RichTextSection
            section={section}
            onUpdate={(json, text) => {
              richTextTextsRef.current.set(section.id, text);
              updateSection(section.id, json);
            }}
            editing={isEditing}
          />
        );
      case "code":
        return (
          <Suspense fallback={<SectionSkeleton />}>
            <CodeSection
              section={section}
              onUpdate={(content) => updateSection(section.id, content)}
              editing={isEditing}
            />
          </Suspense>
        );
      case "math":
        return (
          <Suspense fallback={<SectionSkeleton />}>
            <MathSection
              section={section}
              onUpdate={(content) => updateSection(section.id, content)}
              editing={isEditing}
            />
          </Suspense>
        );
      case "diagram":
        return (
          <Suspense fallback={<SectionSkeleton />}>
            <DiagramSection
              section={section}
              onUpdate={(content) => updateSection(section.id, content)}
              editing={isEditing}
            />
          </Suspense>
        );
      case "callout":
        return (
          <CalloutSection
            section={section}
            onUpdate={(content) => updateSection(section.id, content)}
            editing={isEditing}
          />
        );
      case "divider":
        return <DividerSection />;
      case "image":
        return (
          <ImageSection
            section={section}
            onUpdate={(content) => updateSection(section.id, content)}
            editing={isEditing}
            neuronId={neuronId}
          />
        );
      case "table":
        return (
          <TableSection
            section={section}
            onUpdate={(content) => updateSection(section.id, content)}
            editing={isEditing}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className={presentationMode ? "space-y-2" : "space-y-2 pl-10"}>
      {sections.length === 0 && !presentationMode && (
        <div className="flex justify-center py-8">
          <AddSectionButton onAdd={(type) => addSection(type, -1)} />
        </div>
      )}
      {sections.map((section, idx) => {
        const isEditing = !presentationMode;
        return (
          <div key={section.id}>
            <SectionWrapper
              section={section}
              isFirst={idx === 0}
              isLast={idx === sections.length - 1}
              onMoveUp={() => moveSection(section.id, "up")}
              onMoveDown={() => moveSection(section.id, "down")}
              onDelete={() => deleteSection(section.id)}
              presentationMode={presentationMode}
            >
              {renderSection(section, isEditing)}
            </SectionWrapper>
            {!presentationMode && (
              <div className="flex justify-center py-1 opacity-0 hover:opacity-100 transition-opacity">
                <AddSectionButton onAdd={(type) => addSection(type, idx)} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function SectionSkeleton() {
  return (
    <div className="border rounded-lg p-4 animate-pulse">
      <div className="h-4 bg-muted rounded w-1/3 mb-2" />
      <div className="h-20 bg-muted rounded" />
    </div>
  );
}
