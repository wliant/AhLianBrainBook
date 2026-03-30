"use client";

import { useRef } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionList } from "@/components/sections/SectionList";
import { normalizeContent } from "@/components/sections/sectionUtils";
import type { Neuron, SectionsDocument } from "@/types";

interface NeuronViewerProps {
  neurons: Neuron[];
  currentIndex: number;
  onIndexChange: (index: number) => void;
  brainNames: Record<string, string>;
  clusterNames: Record<string, string>;
}

export function NeuronViewer({
  neurons,
  currentIndex,
  onIndexChange,
  brainNames,
  clusterNames,
}: NeuronViewerProps) {
  const richTextTextsRef = useRef<Map<string, string>>(new Map());
  const neuron = neurons[currentIndex];

  if (!neuron) return null;

  const contentJson =
    typeof neuron.contentJson === "string"
      ? JSON.parse(neuron.contentJson)
      : neuron.contentJson;
  const doc: SectionsDocument = normalizeContent(contentJson);

  const brainName = brainNames[neuron.brainId] ?? "Unknown Brain";
  const clusterName = clusterNames[neuron.clusterId] ?? "Unknown Cluster";

  return (
    <>
      <div
        className="flex items-center justify-between rounded-lg border bg-muted/30 px-4 py-2 mb-4"
        data-testid="neuron-navigator"
      >
        <Button
          variant="ghost"
          size="sm"
          disabled={currentIndex === 0}
          onClick={() => onIndexChange(currentIndex - 1)}
          className="gap-1"
          data-testid="prev-neuron"
        >
          <ChevronLeft className="h-4 w-4" />
          Prev
        </Button>
        <span className="text-sm text-muted-foreground">
          Neuron {currentIndex + 1} of {neurons.length}
        </span>
        <Button
          variant="ghost"
          size="sm"
          disabled={currentIndex === neurons.length - 1}
          onClick={() => onIndexChange(currentIndex + 1)}
          className="gap-1"
          data-testid="next-neuron"
        >
          Next
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="text-xs text-muted-foreground text-center mb-4">
        Use &larr; &rarr; arrow keys to navigate
      </div>

      <div className="rounded-lg border bg-card p-6" data-testid="neuron-content">
        <h2 className="text-lg font-semibold mb-1">
          {neuron.title || "Untitled"}
        </h2>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-4">
          <span>in</span>
          <Link
            href={`/brain/${neuron.brainId}/cluster/${neuron.clusterId}/neuron/${neuron.id}`}
            className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
            data-testid="neuron-origin-link"
          >
            {brainName} &gt; {clusterName}
            <ExternalLink className="h-3 w-3" />
          </Link>
        </div>
        <SectionList
          document={doc}
          onDocumentChange={() => {}}
          richTextTextsRef={richTextTextsRef}
          neuronId={neuron.id}
          viewMode={true}
        />
      </div>
    </>
  );
}
