"use client";

import { useState } from "react";
import { FileText, FileCode, AlertTriangle, CheckCircle, Trash2, ChevronRight, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNeuronAnchors } from "@/lib/hooks/useNeuronAnchors";
import { useNeurons } from "@/lib/hooks/useNeurons";
import { TiptapEditor } from "@/components/editor/TiptapEditor";
import type { NeuronAnchor } from "@/types";

interface NeuronPanelProps {
  clusterId: string;
  brainId: string;
  selectedPath: string | null;
  fileAnchors: NeuronAnchor[];
  anchorsLoading: boolean;
  onAnchorClick: (line: number) => void;
}

export function NeuronPanel({
  clusterId,
  brainId,
  selectedPath,
  fileAnchors,
  anchorsLoading,
  onAnchorClick,
}: NeuronPanelProps) {
  const { neurons } = useNeurons(clusterId);
  const { confirmDrift, deleteAnchor } = useNeuronAnchors(clusterId);
  const [expandedNeurons, setExpandedNeurons] = useState<Set<string>>(new Set());

  // Build neuron lookup
  const neuronMap = new Map(neurons.map((n) => [n.id, n]));

  const activeAnchors = fileAnchors.filter((a) => a.status === "active");
  const needsReview = fileAnchors.filter(
    (a) => a.status === "drifted" || a.status === "orphaned"
  );

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

  const handleConfirmDrift = async (anchor: NeuronAnchor) => {
    try {
      await confirmDrift(anchor.id);
    } catch (err) {
      console.error("Failed to confirm drift:", err);
    }
  };

  const handleDeleteAnchor = async (anchor: NeuronAnchor) => {
    try {
      await deleteAnchor(anchor.id);
    } catch (err) {
      console.error("Failed to delete anchor:", err);
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
      <div className="px-3 py-2 border-b">
        <h3 className="text-sm font-medium truncate">
          Neurons in {selectedPath.split("/").pop()}
        </h3>
      </div>

      {/* Active Anchors */}
      <div className="flex-1 p-2 space-y-1">
        {anchorsLoading ? (
          <p className="text-xs text-muted-foreground p-2">Loading...</p>
        ) : activeAnchors.length === 0 && needsReview.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground">
            <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No anchored neurons.</p>
            <p className="text-xs mt-1">Click line numbers to select a range, then shift+click to create an anchor.</p>
          </div>
        ) : (
          activeAnchors.map((anchor) => {
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
                  onClick={() => onAnchorClick(anchor.startLine)}
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
                  <div className="flex items-center gap-2 mt-0.5 ml-5.5">
                    <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-green-500/20 text-green-400">
                      <FileCode className="h-2.5 w-2.5" />
                      L{anchor.startLine}
                      {anchor.endLine !== anchor.startLine
                        ? `–${anchor.endLine}`
                        : ""}
                    </span>
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

      {/* Needs Review Section */}
      {needsReview.length > 0 && (
        <div className="border-t p-2">
          <h4 className="text-xs font-medium text-muted-foreground px-2 py-1 flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" />
            Needs Review ({needsReview.length})
          </h4>
          <div className="space-y-1">
            {needsReview.map((anchor) => (
              <div
                key={anchor.id}
                className="p-2 rounded-md border border-yellow-500/30 bg-yellow-500/5"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium truncate">
                    {neuronMap.get(anchor.neuronId)?.title || "Untitled"}
                  </span>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded ${
                      anchor.status === "drifted"
                        ? "bg-yellow-500/20 text-yellow-400"
                        : "bg-red-500/20 text-red-400"
                    }`}
                  >
                    {anchor.status}
                  </span>
                </div>
                <div className="flex items-center gap-1 mt-1.5">
                  {anchor.status === "drifted" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 text-xs px-2"
                      onClick={() => handleConfirmDrift(anchor)}
                    >
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Confirm
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 text-xs px-2 text-destructive"
                    onClick={() => handleDeleteAnchor(anchor)}
                  >
                    <Trash2 className="h-3 w-3 mr-1" />
                    Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
