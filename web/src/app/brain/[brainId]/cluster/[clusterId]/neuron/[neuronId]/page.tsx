"use client";

import { use, useState, useEffect, useCallback, useRef } from "react";
import { api } from "@/lib/api";
import type { Neuron, SectionsDocument } from "@/types";
import { CheckCircle, AlertCircle, Loader2, Star, Pin } from "lucide-react";
import { SectionList } from "@/components/sections/SectionList";
import { normalizeContent, extractPlainText } from "@/components/sections/sectionUtils";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type SaveStatus = "idle" | "saving" | "saved" | "error";

export default function NeuronPage({
  params,
}: {
  params: Promise<{ brainId: string; clusterId: string; neuronId: string }>;
}) {
  const { neuronId } = use(params);
  const [neuron, setNeuron] = useState<Neuron | null>(null);
  const [title, setTitle] = useState("");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [sectionsDoc, setSectionsDoc] = useState<SectionsDocument | null>(null);
  const saveTimeout = useRef<ReturnType<typeof setTimeout>>(undefined);
  const versionRef = useRef(1);
  const latestDoc = useRef<SectionsDocument>({ version: 2, sections: [] });
  const richTextTextsRef = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    api.get<Neuron>(`/api/neurons/${neuronId}`).then((n) => {
      const parsedJson =
        typeof n.contentJson === "string"
          ? JSON.parse(n.contentJson)
          : n.contentJson;
      const parsed = { ...n, contentJson: parsedJson };
      setNeuron(parsed);
      setTitle(parsed.title);
      versionRef.current = parsed.version;
      const doc = normalizeContent(parsedJson);
      setSectionsDoc(doc);
      latestDoc.current = doc;
    });
  }, [neuronId]);

  const saveContent = useCallback(
    async (newTitle: string) => {
      setSaveStatus("saving");
      try {
        const doc = latestDoc.current;
        // Build plain text: use richTextTextsRef for rich-text sections, extractPlainText for others
        const textParts = doc.sections.map((s) => {
          if (s.type === "rich-text") {
            return richTextTextsRef.current.get(s.id) || "";
          }
          return extractPlainText([s]);
        });
        const contentText = textParts.filter(Boolean).join("\n");

        await api.put(`/api/neurons/${neuronId}/content`, {
          contentJson: JSON.stringify(doc),
          contentText,
          clientVersion: versionRef.current,
        });
        if (newTitle !== neuron?.title) {
          await api.patch(`/api/neurons/${neuronId}`, { title: newTitle });
        }
        versionRef.current += 1;
        setSaveStatus("saved");
      } catch {
        setSaveStatus("error");
      }
    },
    [neuronId, neuron?.title]
  );

  const debouncedSave = useCallback(
    (newTitle: string) => {
      if (saveTimeout.current) clearTimeout(saveTimeout.current);
      saveTimeout.current = setTimeout(() => saveContent(newTitle), 1500);
    },
    [saveContent]
  );

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTitle(e.target.value);
    debouncedSave(e.target.value);
  };

  const handleDocumentChange = useCallback(
    (doc: SectionsDocument) => {
      latestDoc.current = doc;
      setSectionsDoc(doc);
      debouncedSave(title);
    },
    [debouncedSave, title]
  );

  const toggleFavorite = async () => {
    await api.post(`/api/neurons/${neuronId}/favorite`);
    setNeuron((prev) => (prev ? { ...prev, isFavorite: !prev.isFavorite } : prev));
  };

  const togglePin = async () => {
    await api.post(`/api/neurons/${neuronId}/pin`);
    setNeuron((prev) => (prev ? { ...prev, isPinned: !prev.isPinned } : prev));
  };

  if (!neuron || !sectionsDoc) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 border-b px-6 py-2">
        <SaveStatusIndicator status={saveStatus} />
        <div className="flex-1" />
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={toggleFavorite}
          title="Toggle Favorite"
        >
          <Star
            className={cn(
              "h-4 w-4",
              neuron.isFavorite && "fill-yellow-400 text-yellow-400"
            )}
          />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={togglePin}
          title="Toggle Pin"
        >
          <Pin
            className={cn(
              "h-4 w-4",
              neuron.isPinned && "fill-blue-400 text-blue-400"
            )}
          />
        </Button>
      </div>
      <div className="flex-1 overflow-auto p-6 max-w-4xl mx-auto w-full">
        <input
          type="text"
          value={title}
          onChange={handleTitleChange}
          placeholder="Untitled"
          className="w-full text-3xl font-bold border-none outline-none mb-4 bg-transparent"
        />
        <SectionList
          document={sectionsDoc}
          onDocumentChange={handleDocumentChange}
          richTextTextsRef={richTextTextsRef}
          neuronId={neuronId}
        />
      </div>
    </div>
  );
}

function SaveStatusIndicator({ status }: { status: SaveStatus }) {
  if (status === "idle") return null;
  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
      {status === "saving" && (
        <>
          <Loader2 className="h-3 w-3 animate-spin" />
          <span>Saving...</span>
        </>
      )}
      {status === "saved" && (
        <>
          <CheckCircle className="h-3 w-3 text-green-500" />
          <span>Saved</span>
        </>
      )}
      {status === "error" && (
        <>
          <AlertCircle className="h-3 w-3 text-destructive" />
          <span>Save failed</span>
        </>
      )}
    </div>
  );
}
