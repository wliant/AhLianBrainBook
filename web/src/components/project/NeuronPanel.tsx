"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { FileText, Plus, Search, Layers, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
  onNavigateToFile?: (filePath: string) => void;
}

export function NeuronPanel({
  clusterId,
  brainId,
  selectedPath,
  fileAnchors,
  anchorsLoading,
  codeSelection,
  onNavigateToFile,
}: NeuronPanelProps) {
  const { neurons } = useNeurons(clusterId);
  const [creating, setCreating] = useState(false);
  const [tab, setTab] = useState<"file" | "cluster">("file");
  const [clusterSearch, setClusterSearch] = useState("");
  const [dialogNeuron, setDialogNeuron] = useState<{ neuron: Neuron; anchor?: NeuronAnchor } | null>(null);
  const queryClient = useQueryClient();
  const router = useRouter();

  const neuronMap = new Map(neurons.map((n) => [n.id, n]));

  const filteredNeurons = useMemo(() => {
    if (!clusterSearch.trim()) return neurons;
    const lower = clusterSearch.toLowerCase();
    return neurons.filter(
      (n) =>
        n.title?.toLowerCase().includes(lower) ||
        n.contentText?.toLowerCase().includes(lower)
    );
  }, [neurons, clusterSearch]);

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

  return (
    <div className="flex flex-col h-full overflow-hidden" data-testid="neuron-panel">
      {/* Tab header */}
      <div className="px-2 py-1 border-b flex items-center gap-1 shrink-0">
        <button
          className={`text-xs px-2 py-1 rounded-sm transition-colors ${
            tab === "file"
              ? "bg-accent text-accent-foreground font-medium"
              : "text-muted-foreground hover:bg-accent/50"
          }`}
          onClick={() => setTab("file")}
        >
          This File
        </button>
        <button
          className={`text-xs px-2 py-1 rounded-sm transition-colors flex items-center gap-1 ${
            tab === "cluster"
              ? "bg-accent text-accent-foreground font-medium"
              : "text-muted-foreground hover:bg-accent/50"
          }`}
          onClick={() => setTab("cluster")}
        >
          <Layers className="h-3 w-3" />
          All Neurons
        </button>
      </div>

      {tab === "file" ? (
        /* "This File" tab */
        !selectedPath ? (
          <div className="p-4 text-sm text-muted-foreground">
            Select a file to see anchored neurons.
          </div>
        ) : (
          <div className="flex flex-col flex-1 overflow-y-auto">
            {/* File name header */}
            <div className="px-3 py-2 border-b">
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

                  return (
                    <div key={anchor.id} className="group rounded-md border border-border/50 flex items-center">
                      <button
                        className="flex-1 text-left p-2 hover:bg-accent transition-colors rounded-l-md min-w-0"
                        onClick={() => neuron && setDialogNeuron({ neuron, anchor })}
                      >
                        <div className="flex items-center gap-2">
                          <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="text-sm font-medium truncate">
                            {neuron?.title || "Untitled"}
                          </span>
                        </div>
                        <div className="text-[10px] text-muted-foreground truncate ml-5.5">
                          {anchor.filePath}
                        </div>
                      </button>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button aria-label="Neuron options" className="p-1.5 mr-1 opacity-0 group-hover:opacity-100 hover:bg-accent rounded shrink-0">
                            <MoreHorizontal className="h-3.5 w-3.5" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => onNavigateToFile?.(anchor.filePath)}
                          >
                            Open file in tree
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => router.push(`/brain/${brainId}/cluster/${clusterId}/neuron/${anchor.neuronId}`)}
                          >
                            Go to neuron page
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )
      ) : (
        /* "All Neurons" tab */
        <div className="flex flex-col flex-1 min-h-0">
          {/* Search */}
          <div className="px-2 py-2 border-b shrink-0">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <Input
                className="pl-7 h-7 text-xs"
                placeholder="Search neurons..."
                value={clusterSearch}
                onChange={(e) => setClusterSearch(e.target.value)}
              />
            </div>
          </div>

          {/* Neuron list */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {filteredNeurons.length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground">
                <Layers className="h-8 w-8 mx-auto mb-2 opacity-50" />
                {clusterSearch.trim()
                  ? <p>No results for &ldquo;{clusterSearch}&rdquo;</p>
                  : <p>No neurons in this cluster.</p>
                }
              </div>
            ) : (
              filteredNeurons.map((neuron) => (
                <div key={neuron.id} className="group rounded-md border border-border/50 flex items-center">
                  <button
                    className="flex-1 text-left p-2 hover:bg-accent transition-colors rounded-l-md min-w-0"
                    onClick={() => setDialogNeuron({ neuron, anchor: neuron.anchor ?? undefined })}
                  >
                    <div className="text-sm font-medium truncate">
                      {neuron.title || "Untitled"}
                    </div>
                    {neuron.anchor && (
                      <div className="text-[10px] text-muted-foreground truncate mt-0.5">
                        {neuron.anchor.filePath}
                      </div>
                    )}
                  </button>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button aria-label="Neuron options" className="p-1.5 mr-1 opacity-0 group-hover:opacity-100 hover:bg-accent rounded shrink-0">
                        <MoreHorizontal className="h-3.5 w-3.5" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {neuron.anchor && (
                        <DropdownMenuItem
                          onClick={() => {
                            onNavigateToFile?.(neuron.anchor!.filePath);
                            setTab("file");
                          }}
                        >
                          Open file in tree
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        onClick={() => router.push(`/brain/${brainId}/cluster/${clusterId}/neuron/${neuron.id}`)}
                      >
                        Go to neuron page
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Neuron content dialog */}
      <Dialog open={!!dialogNeuron} onOpenChange={(open) => { if (!open) setDialogNeuron(null); }}>
        <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{dialogNeuron?.neuron.title || "Untitled"}</DialogTitle>
            {dialogNeuron?.anchor && (
              <p className="text-xs text-muted-foreground">{dialogNeuron.anchor.filePath}</p>
            )}
          </DialogHeader>
          <div className="flex-1 overflow-y-auto">
            {dialogNeuron?.neuron.contentJson && (
              <TiptapEditor
                content={parseContent(dialogNeuron.neuron.contentJson)}
                onUpdate={() => {}}
                editable={false}
              />
            )}
          </div>
          <DialogFooter>
            {dialogNeuron?.anchor && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  onNavigateToFile?.(dialogNeuron.anchor!.filePath);
                  setDialogNeuron(null);
                }}
              >
                Open file in tree
              </Button>
            )}
            <Button
              size="sm"
              onClick={() =>
                router.push(`/brain/${brainId}/cluster/${clusterId}/neuron/${dialogNeuron!.neuron.id}`)
              }
            >
              Go to neuron page
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function parseContent(contentJson: unknown): Record<string, unknown> | null {
  if (!contentJson) return null;
  if (typeof contentJson === "string") {
    try { return JSON.parse(contentJson); } catch { return null; }
  }
  return contentJson as Record<string, unknown>;
}
