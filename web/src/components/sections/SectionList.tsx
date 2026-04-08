"use client";

import { useCallback, useRef, useEffect, useState, lazy, Suspense } from "react";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Section, SectionType, SectionsDocument } from "@/types";
import { AI_SUPPORTED_SECTION_TYPES } from "@/types";
import { AiAssistDialog } from "./AiAssistDialog";
import { createSection } from "./sectionUtils";
import { SectionWrapper } from "./SectionWrapper";
import { AddSectionButton } from "./AddSectionButton";
import { RichTextSection } from "./RichTextSection";
import { CalloutSection } from "./CalloutSection";
import { DividerSection } from "./DividerSection";
import { ImageSection } from "./ImageSection";
import { AudioSection } from "./AudioSection";
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
  neuronId?: string;
  brainId?: string;
  viewMode?: boolean;
}

export function SectionList({
  document,
  onDocumentChange,
  richTextTextsRef,
  neuronId,
  brainId,
  viewMode,
}: SectionListProps) {
  const sections = document.sections;
  const sectionsRef = useRef(sections);
  sectionsRef.current = sections;
  const [aiAssistSectionId, setAiAssistSectionId] = useState<string | null>(null);
  const aiAssistSection = aiAssistSectionId
    ? sections.find((s) => s.id === aiAssistSectionId) ?? null
    : null;

  useEffect(() => {
    if (sections.length === 0) return;
    const hash = window.location.hash;
    if (!hash) return;
    // Delay to let sections render
    const timer = setTimeout(() => {
      const el = window.document.getElementById(hash.slice(1));
      if (el) el.scrollIntoView({ behavior: "smooth" });
    }, 300);
    return () => clearTimeout(timer);
  }, [sections.length > 0]); // eslint-disable-line react-hooks/exhaustive-deps

  const updateSections = useCallback(
    (newSections: Section[]) => {
      onDocumentChange({ version: 2, sections: newSections });
    },
    [onDocumentChange]
  );

  const togglePreview = useCallback(
    (id: string) => {
      const updated = sectionsRef.current.map((s) =>
        s.id === id ? { ...s, meta: { ...s.meta, preview: !s.meta?.preview } } : s
      );
      updateSections(updated);
    },
    [updateSections]
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
      if (section?.meta?.locked) return;
      if (
        (section?.type === "image" || section?.type === "audio") &&
        section.content.attachmentId
      ) {
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
      if (current[idx].meta?.locked) return;
      const targetIdx = direction === "up" ? idx - 1 : idx + 1;
      if (targetIdx < 0 || targetIdx >= current.length) return;
      const updated = [...current];
      [updated[idx], updated[targetIdx]] = [updated[targetIdx], updated[idx]];
      updateSections(updated.map((s, i) => ({ ...s, order: i })));
    },
    [updateSections]
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const current = sectionsRef.current;
      const oldIndex = current.findIndex((s) => s.id === active.id);
      const newIndex = current.findIndex((s) => s.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;

      const reordered = arrayMove(current, oldIndex, newIndex)
        .map((s, i) => ({ ...s, order: i }));
      updateSections(reordered);
    },
    [updateSections]
  );

  const renderSection = (section: Section, isEditing: boolean) => {
    switch (section.type) {
      case "rich-text": {
        const sectionIdx = sections.findIndex((s) => s.id === section.id);
        return (
          <RichTextSection
            section={section}
            onUpdate={(json, text) => {
              richTextTextsRef.current.set(section.id, text);
              updateSection(section.id, json);
            }}
            editing={isEditing}
            onInsertSection={isEditing ? (type) => addSection(type, sectionIdx) : undefined}
            brainId={brainId}
          />
        );
      }
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
      case "audio":
        return (
          <AudioSection
            section={section}
            onUpdate={(content) => updateSection(section.id, content)}
            editing={isEditing}
            neuronId={neuronId}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className={viewMode ? "space-y-2" : "space-y-2 pl-10"}>
      {!viewMode && sections.length === 0 && (
        <div className="flex justify-center py-8">
          <AddSectionButton onAdd={(type) => addSection(type, -1)} />
        </div>
      )}
      {aiAssistSection && neuronId && (
        <AiAssistDialog
          open={true}
          onClose={() => setAiAssistSectionId(null)}
          onSave={(content) => {
            updateSection(aiAssistSection.id, content);
            setAiAssistSectionId(null);
          }}
          section={aiAssistSection}
          neuronId={neuronId}
        />
      )}
      {viewMode ? (
        sections.map((section, idx) => (
          <div key={section.id} id={`section-${section.id}`}>
            <SectionWrapper
              section={section}
              isFirst={idx === 0}
              isLast={idx === sections.length - 1}
              onMoveUp={() => moveSection(section.id, "up")}
              onMoveDown={() => moveSection(section.id, "down")}
              onDelete={() => deleteSection(section.id)}
              onTogglePreview={() => togglePreview(section.id)}
              viewMode={viewMode}
            >
              {renderSection(section, false)}
            </SectionWrapper>
          </div>
        ))
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={sections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
            {sections.map((section, idx) => (
              <SortableSectionItem
                key={section.id}
                section={section}
                isFirst={idx === 0}
                isLast={idx === sections.length - 1}
                isEditing={!section.meta?.preview}
                onMoveUp={() => moveSection(section.id, "up")}
                onMoveDown={() => moveSection(section.id, "down")}
                onDelete={() => deleteSection(section.id)}
                onTogglePreview={() => togglePreview(section.id)}
                onAiAssist={
                  AI_SUPPORTED_SECTION_TYPES.includes(section.type)
                    ? () => setAiAssistSectionId(section.id)
                    : undefined
                }
                onAddSection={(type) => addSection(type, idx)}
                renderSection={renderSection}
              />
            ))}
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}

function SortableSectionItem({
  section,
  isFirst,
  isLast,
  isEditing,
  onMoveUp,
  onMoveDown,
  onDelete,
  onTogglePreview,
  onAiAssist,
  onAddSection,
  renderSection,
}: {
  section: Section;
  isFirst: boolean;
  isLast: boolean;
  isEditing: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
  onTogglePreview: () => void;
  onAiAssist?: () => void;
  onAddSection: (type: SectionType) => void;
  renderSection: (section: Section, isEditing: boolean) => React.ReactNode;
}) {
  const isLocked = !!section.meta?.locked;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: section.id,
    disabled: isLocked,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : undefined,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style} id={`section-${section.id}`}>
      <SectionWrapper
        section={section}
        isFirst={isFirst}
        isLast={isLast}
        onMoveUp={onMoveUp}
        onMoveDown={onMoveDown}
        onDelete={onDelete}
        onTogglePreview={onTogglePreview}
        onAiAssist={onAiAssist}
        dragHandleProps={!isLocked ? { attributes, listeners } : undefined}
      >
        {renderSection(section, isEditing)}
      </SectionWrapper>
      {!isLocked && (
        <div className="flex justify-center py-1 opacity-0 hover:opacity-100 transition-opacity">
          <AddSectionButton onAdd={onAddSection} />
        </div>
      )}
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
