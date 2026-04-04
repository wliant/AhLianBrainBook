"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { FileText, Plus, ChevronRight, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNeurons } from "@/lib/hooks/useNeurons";
import { TiptapEditor } from "@/components/editor/TiptapEditor";
import { api } from "@/lib/api";
import type { NeuronAnchor, Neuron } from "@/types";
import type { CodeSelection } from "./CodeViewer";

interface NeuronPanelProps {
  clusterId: string;
  brainId: string;
  selectedPath: string | null;
  fileAnchors: NeuronAnchor[];
  anchorsLoading: boolean;
  codeSelection: CodeSelection | null;
}

export function NeuronPanel({
  clusterId,
  brainId,
  selectedPath,
  fileAnchors,
  anchorsLoading,
  codeSelection,
}: NeuronPanelProps) {
  const { neurons } = useNeurons(clusterId);
  const [expandedNeurons, setExpandedNeurons] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);
  const queryClient = useQueryClient();
  const router = useRouter();

  const neuronMap = new Map(neurons.map((n) => [n.id, n]));

  const toggleExpanded = (neuronId: string) => {
    setExpandedNeurons((prev) => {
      const next = new Set(prev);
      if (next.has(neuronId)) {
        next.delete(neuronId);
      } else {
        next.add(neuronId);
      }
      return next;
    });
  };

  const handleCreateNeuron = async () => {
    if (!selectedPath || !codeSelection || creating) return;
    setCreating(true);
    try {
      const sectionId1 = crypto.randomUUID();
      const sectionId2 = crypto.randomUUID();
      const sectionId3 = crypto.randomUUID();

      // Detect language from file extension
      const ext = selectedPath.split(".").pop()?.toLowerCase() ?? "";
      const langMap: Record<string, string> = {
        js: "javascript", jsx: "javascript", ts: "typescript", tsx: "typescript",
        py: "python", java: "java", cpp: "cpp", c: "c", cs: "csharp",
        rs: "rust", go: "go", html: "html", css: "css", json: "json",
        md: "markdown", sql: "sql", xml: "xml", yaml: "yaml", yml: "yaml",
        sh: "bash", bash: "bash",
      };
      const language = langMap[ext] ?? "";

      const contentJson = JSON.stringify({
        version: 2,
        sections: [
          {
            id: sectionId1,
            type: "callout",
            order: 0,
            content: { type: "info", text: selectedPath },
            meta: { locked: true },
          },
          {
            id: sectionId2,
            type: "code",
            order: 1,
            content: { code: codeSelection.code, language },
            meta: { locked: true },
          },
          {
            id: sectionId3,
            type: "rich-text",
            order: 2,
            content: {},
            meta: {},
          },
        ],
      });

      const neuron = await api.post<Neuron>("/api/neurons", {
        title: "",
        brainId,
        clusterId,
        contentJson,
        contentText: "",
        anchor: { filePath: selectedPath },
      });

      queryClient.invalidateQueries({ queryKey: ["neurons", clusterId] });
      queryClient.invalidateQueries({ queryKey: ["neuron-anchors", clusterId] });

      router.push(`/brain/${brainId}/cluster/${clusterId}/neuron/${neuron.id}`);
    } catch (err) {
      console.error("Failed to create anchored neuron:", err);
    } finally {
      setCreating(false);
    }
  };

  if (!selectedPath) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        Select a file to see anchored neurons.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto" data-testid="neuron-panel">
      {/* Header */}
      <div className="px-3 py-2 border-b flex items-center justify-between">
        <h3 className="text-sm font-medium truncate">
          Neurons in {selectedPath.split("/").pop()}
        </h3>
      </div>

      {/* Create Neuron from selection */}
      {codeSelection && (
        <div className="px-3 py-2 border-b">
          <Button
            size="sm"
            className="w-full"
            onClick={handleCreateNeuron}
            disabled={creating}
            data-testid="create-neuron-from-selection"
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            {creating ? "Creating..." : `Create Neuron (L${codeSelection.startLine}–${codeSelection.endLine})`}
          </Button>
        </div>
      )}

      {/* Anchor list */}
      <div className="flex-1 p-2 space-y-1">
        {anchorsLoading ? (
          <p className="text-xs text-muted-foreground p-2">Loading...</p>
        ) : fileAnchors.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground">
            <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No anchored neurons.</p>
            <p className="text-xs mt-1">Highlight code to create a neuron.</p>
          </div>
        ) : (
          fileAnchors.map((anchor) => {
            const neuron = neuronMap.get(anchor.neuronId);
            const isExpanded = expandedNeurons.has(anchor.neuronId);
            const contentJson = neuron?.contentJson
              ? (typeof neuron.contentJson === "string"
                  ? JSON.parse(neuron.contentJson)
                  : neuron.contentJson)
              : null;
            const hasContent = contentJson && contentJson.content?.length > 0;

            return (
              <div key={anchor.id} className="rounded-md border border-border/50">
                <button
                  className="w-full text-left p-2 hover:bg-accent transition-colors rounded-t-md"
                  onClick={() => router.push(`/brain/${brainId}/cluster/${clusterId}/neuron/${anchor.neuronId}`)}
                >
                  <div className="flex items-center gap-2">
                    {hasContent ? (
                      <button
                        className="shrink-0 p-0.5 hover:bg-accent rounded"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleExpanded(anchor.neuronId);
                        }}
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-3 w-3 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-3 w-3 text-muted-foreground" />
                        )}
                      </button>
                    ) : (
                      <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    )}
                    <span className="text-sm font-medium truncate">
                      {neuron?.title || "Untitled"}
                    </span>
                  </div>
                  <div className="text-[10px] text-muted-foreground truncate ml-5.5">
                    {anchor.filePath}
                  </div>
                </button>

                {/* Expanded content */}
                {isExpanded && contentJson && (
                  <div className="px-3 pb-2 border-t border-border/30">
                    <div className="mt-2 text-sm">
                      <TiptapEditor
                        content={contentJson}
                        onUpdate={() => {}}
                        editable={false}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
