"use client";

import { FileText, AlertTriangle, CheckCircle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFileAnchors, useNeuronAnchors } from "@/lib/hooks/useNeuronAnchors";
import { useNeurons } from "@/lib/hooks/useNeurons";
import type { NeuronAnchor } from "@/types";

interface NeuronPanelProps {
  clusterId: string;
  brainId: string;
  selectedPath: string | null;
  onAnchorClick: (line: number) => void;
}

export function NeuronPanel({
  clusterId,
  brainId,
  selectedPath,
  onAnchorClick,
}: NeuronPanelProps) {
  const { anchors: fileAnchors, loading: anchorsLoading } = useFileAnchors(
    clusterId,
    selectedPath
  );
  const { neurons } = useNeurons(clusterId);
  const { confirmDrift, deleteAnchor } = useNeuronAnchors(clusterId);

  // Build neuron title lookup
  const neuronTitles = new Map(neurons.map((n) => [n.id, n.title]));

  const activeAnchors = fileAnchors.filter((a) => a.status === "active");
  const needsReview = fileAnchors.filter(
    (a) => a.status === "drifted" || a.status === "orphaned"
  );

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
          activeAnchors.map((anchor) => (
            <button
              key={anchor.id}
              className="w-full text-left p-2 rounded-md hover:bg-accent transition-colors"
              onClick={() => onAnchorClick(anchor.startLine)}
            >
              <div className="flex items-center gap-2">
                <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="text-sm font-medium truncate">
                  {neuronTitles.get(anchor.neuronId) || "Untitled"}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-0.5 ml-5.5">
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/20 text-green-400">
                  L{anchor.startLine}
                  {anchor.endLine !== anchor.startLine
                    ? `–${anchor.endLine}`
                    : ""}
                </span>
              </div>
            </button>
          ))
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
                    {neuronTitles.get(anchor.neuronId) || "Untitled"}
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
