"use client";

import { useState } from "react";
import Link from "next/link";
import { Lightbulb, Plus, AlertCircle, Trash2 } from "lucide-react";
import { useThoughts } from "@/lib/hooks/useThoughts";
import { useTags } from "@/lib/hooks/useTags";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ThoughtFormDialog } from "@/components/thoughts/ThoughtFormDialog";
import { DeleteThoughtDialog } from "@/components/thoughts/DeleteThoughtDialog";
import type { ThoughtFormData } from "@/components/thoughts/ThoughtFormDialog";
import type { Thought } from "@/types";

function TagBadges({ thought }: { thought: Thought }) {
  return (
    <div className="flex flex-wrap gap-3">
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-muted-foreground">
          Neuron tags ({thought.neuronTagMode}):
        </span>
        <div className="flex flex-wrap gap-1">
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
        </div>
      </div>
      {thought.brainTags.length > 0 && (
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">
            Brain tags ({thought.brainTagMode}):
          </span>
          <div className="flex flex-wrap gap-1">
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
      )}
    </div>
  );
}

export default function ThoughtsPage() {
  const { thoughts, loading, createThought, deleteThought } = useThoughts();
  const { tags } = useTags();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Thought | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async (data: ThoughtFormData) => {
    try {
      setError(null);
      await createThought({
        name: data.name,
        description: data.description || undefined,
        neuronTagMode: data.neuronTagMode,
        brainTagMode: data.brainTagMode,
        neuronTagIds: data.neuronTags.map((t) => t.id),
        brainTagIds: data.brainTags.length > 0 ? data.brainTags.map((t) => t.id) : undefined,
      });
    } catch (err) {
      console.error("Failed to create thought:", err);
      setError("Failed to create thought");
      throw err;
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      setError(null);
      await deleteThought(deleteTarget.id);
    } catch (err) {
      console.error("Failed to delete thought:", err);
      setError("Failed to delete thought");
      throw err;
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Lightbulb className="h-6 w-6" />
          Thoughts
        </h1>
        <Button
          data-testid="create-thought-button"
          onClick={() => setCreateDialogOpen(true)}
          size="sm"
          className="gap-1.5"
        >
          <Plus className="h-4 w-4" />
          New Thought
        </Button>
      </div>

      {error && (
        <div className="mb-6 flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {!loading && thoughts.length === 0 ? (
        <p className="text-muted-foreground text-center py-12">
          No thoughts yet. Create one to start collecting neurons by tags.
        </p>
      ) : (
        <div className="grid gap-3" data-testid="thoughts-list">
          {thoughts.map((thought) => (
            <div
              key={thought.id}
              data-testid={`thought-card-${thought.id}`}
              className="group relative rounded-lg border bg-card p-4 hover:shadow-sm transition-shadow"
            >
              <Link href={`/thoughts/${thought.id}`} className="block">
                <h2 className="text-lg font-semibold mb-1">{thought.name}</h2>
                {thought.description && (
                  <p className="text-sm text-muted-foreground mb-3">{thought.description}</p>
                )}
                <TagBadges thought={thought} />
              </Link>
              <button
                data-testid={`delete-thought-${thought.id}`}
                className="absolute top-3 right-3 p-1.5 opacity-0 group-hover:opacity-100 rounded hover:bg-destructive/10 text-destructive transition-opacity"
                onClick={() => setDeleteTarget(thought)}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      <ThoughtFormDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        title="New Thought"
        submitLabel="Create"
        allTags={tags}
        onSubmit={handleCreate}
      />

      {deleteTarget && (
        <DeleteThoughtDialog
          open={!!deleteTarget}
          onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
          thoughtName={deleteTarget.name}
          onConfirm={handleDelete}
        />
      )}
    </div>
  );
}
