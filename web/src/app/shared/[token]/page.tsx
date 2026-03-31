"use client";

import { use, useState, useEffect, useRef } from "react";
import { Loader2, AlertCircle, BookOpen } from "lucide-react";
import { api } from "@/lib/api";
import { SectionList } from "@/components/sections/SectionList";
import { normalizeContent } from "@/components/sections/sectionUtils";
import type { SharedNeuron, SectionsDocument, Tag } from "@/types";

export default function SharedNeuronPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const [neuron, setNeuron] = useState<SharedNeuron | null>(null);
  const [sectionsDoc, setSectionsDoc] = useState<SectionsDocument | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const richTextTextsRef = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    api
      .get<SharedNeuron>(`/api/shares/${token}`)
      .then((data) => {
        setNeuron(data);
        const parsed =
          typeof data.contentJson === "string"
            ? JSON.parse(data.contentJson)
            : data.contentJson;
        setSectionsDoc(normalizeContent(parsed));
      })
      .catch(() => {
        setError("This share link is invalid or has expired.");
      })
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !neuron) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
        <AlertCircle className="h-8 w-8" />
        <p>{error || "Neuron not found"}</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
      <div className="flex items-center gap-2 mb-6 text-sm text-muted-foreground">
        <BookOpen className="h-4 w-4" />
        <span>Shared from {neuron.brainName || "BrainBook"}</span>
        <span className="ml-auto text-xs">
          {new Date(neuron.createdAt).toLocaleDateString()}
        </span>
      </div>

      <h1 className="text-3xl font-bold mb-2">{neuron.title || "Untitled"}</h1>

      {neuron.tags && neuron.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-6">
          {neuron.tags.map((tag: Tag) => (
            <span
              key={tag.id}
              className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-muted text-muted-foreground"
            >
              {tag.name}
            </span>
          ))}
        </div>
      )}

      {sectionsDoc && (
        <SectionList
          document={sectionsDoc}
          onDocumentChange={() => {}}
          richTextTextsRef={richTextTextsRef}
          viewMode={true}
        />
      )}

      <div className="mt-12 pt-4 border-t text-center text-xs text-muted-foreground">
        Shared via BrainBook
      </div>
    </div>
  );
}
