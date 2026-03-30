"use client";

import { use, useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Lightbulb, ArrowLeft, Pencil, AlertCircle } from "lucide-react";
import { api } from "@/lib/api";
import { useTags } from "@/lib/hooks/useTags";
import { useBrains } from "@/lib/hooks/useBrains";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ThoughtFormDialog } from "@/components/thoughts/ThoughtFormDialog";
import { DeleteThoughtDialog } from "@/components/thoughts/DeleteThoughtDialog";
import { NeuronViewer } from "@/components/thoughts/NeuronViewer";
import type { ThoughtFormData } from "@/components/thoughts/ThoughtFormDialog";
import type { Thought, Neuron, Cluster } from "@/types";

export default function ThoughtViewerPage({
  params,
}: {
  params: Promise<{ thoughtId: string }>;
}) {
  const { thoughtId } = use(params);
  const router = useRouter();
  const { tags } = useTags();
  const { brains } = useBrains();

  const [thought, setThought] = useState<Thought | null>(null);
  const [neurons, setNeurons] = useState<Neuron[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [clusterNames, setClusterNames] = useState<Record<string, string>>({});

  const brainNames: Record<string, string> = {};
  for (const b of brains) {
    brainNames[b.id] = b.name;
  }

  const fetchThought = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [t, n] = await Promise.all([
        api.thoughts.get(thoughtId),
        api.thoughts.neurons(thoughtId),
      ]);
      setThought(t);
      setNeurons(n);
      setCurrentIndex(0);

      const clusterIds = [...new Set(n.map((neuron) => neuron.clusterId))];
      const clusterNameMap: Record<string, string> = {};
      await Promise.all(
        clusterIds.map(async (cid) => {
          try {
            const cluster = await api.get<Cluster>(`/api/clusters/${cid}`);
            clusterNameMap[cid] = cluster.name;
          } catch (err) {
            console.warn(`Failed to load cluster ${cid}:`, err);
            clusterNameMap[cid] = "Unknown";
          }
        })
      );
      setClusterNames(clusterNameMap);
    } catch (err) {
      console.error("Failed to load thought:", err);
      setError("Failed to load thought");
    } finally {
      setLoading(false);
    }
  }, [thoughtId]);

  useEffect(() => {
    fetchThought();
  }, [fetchThought]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "ArrowLeft") {
        setCurrentIndex((prev) => Math.max(0, prev - 1));
      } else if (e.key === "ArrowRight") {
        setCurrentIndex((prev) => Math.min(neurons.length - 1, prev + 1));
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [neurons.length]);

  const handleUpdate = async (data: ThoughtFormData) => {
    try {
      setError(null);
      const updated = await api.thoughts.update(thoughtId, {
        name: data.name,
        description: data.description || undefined,
        neuronTagMode: data.neuronTagMode,
        brainTagMode: data.brainTagMode,
        neuronTagIds: data.neuronTags.map((t) => t.id),
        brainTagIds: data.brainTags.length > 0 ? data.brainTags.map((t) => t.id) : undefined,
      });
      setThought(updated);
      // Re-fetch neurons since tag criteria may have changed
      const n = await api.thoughts.neurons(thoughtId);
      setNeurons(n);
      setCurrentIndex(0);
    } catch (err) {
      console.error("Failed to update thought:", err);
      setError("Failed to update thought");
      throw err;
    }
  };

  const handleDelete = async () => {
    try {
      await api.thoughts.delete(thoughtId);
      router.push("/thoughts");
    } catch (err) {
      console.error("Failed to delete thought:", err);
      setError("Failed to delete thought");
      throw err;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error && !thought) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
        <div className="flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      </div>
    );
  }

  if (!thought) return null;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto" data-testid="thought-viewer">
      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Header */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Lightbulb className="h-5 w-5" />
            {thought.name}
          </h1>
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => setEditDialogOpen(true)}
              data-testid="edit-thought-button"
            >
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-destructive"
              onClick={() => setDeleteDialogOpen(true)}
              data-testid="delete-thought-button"
            >
              Delete
            </Button>
            <Link href="/thoughts">
              <Button variant="ghost" size="sm" className="gap-1.5">
                <ArrowLeft className="h-3.5 w-3.5" />
                Back
              </Button>
            </Link>
          </div>
        </div>
        {thought.description && (
          <p className="text-sm text-muted-foreground mb-2">{thought.description}</p>
        )}
        <div className="flex flex-wrap gap-2">
          {thought.neuronTags.map((tag) => (
            <Badge
              key={tag.id}
              variant="default"
              className="text-xs"
              style={tag.color ? { backgroundColor: tag.color + "20", color: tag.color } : undefined}
            >
              {tag.name}
            </Badge>
          ))}
          {thought.brainTags.map((tag) => (
            <Badge
              key={tag.id}
              variant="outline"
              className="text-xs"
              style={tag.color ? { borderColor: tag.color, color: tag.color } : undefined}
            >
              {tag.name}
            </Badge>
          ))}
        </div>
      </div>

      {/* Neuron content */}
      {neurons.length > 0 ? (
        <NeuronViewer
          neurons={neurons}
          currentIndex={currentIndex}
          onIndexChange={setCurrentIndex}
          brainNames={brainNames}
          clusterNames={clusterNames}
        />
      ) : (
        <p className="text-muted-foreground text-center py-12">
          No neurons match the current tag criteria. Try adjusting your filters or adding tags to neurons.
        </p>
      )}

      {/* Dialogs */}
      <ThoughtFormDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        title="Edit Thought"
        submitLabel="Save"
        allTags={tags}
        initial={{
          name: thought.name,
          description: thought.description ?? "",
          neuronTagMode: thought.neuronTagMode,
          brainTagMode: thought.brainTagMode,
          neuronTags: thought.neuronTags,
          brainTags: thought.brainTags,
        }}
        onSubmit={handleUpdate}
      />

      <DeleteThoughtDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        thoughtName={thought.name}
        onConfirm={handleDelete}
      />
    </div>
  );
}
