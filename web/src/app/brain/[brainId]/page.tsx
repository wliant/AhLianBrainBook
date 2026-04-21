"use client";

import { use, useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { FolderOpen, Plus, Network, Sparkles, Code, CheckSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useClusters } from "@/lib/hooks/useClusters";
import { useBrains } from "@/lib/hooks/useBrains";
import { TagCombobox } from "@/components/tags/TagCombobox";
import { BrainStats } from "@/components/brain/BrainStats";
import { EntityMetadata } from "@/components/shared/EntityMetadata";
import { CreateClusterDialog } from "@/components/shared/CreateClusterDialog";
import type { ClusterType, Tag } from "@/types";

export default function BrainPage({ params }: { params: Promise<{ brainId: string }> }) {
  const { brainId } = use(params);
  const { clusters, createCluster } = useClusters(brainId);
  const { brains, updateBrain } = useBrains();
  const brain = brains.find((b) => b.id === brainId);

  const [description, setDescription] = useState(brain?.description || "");
  const [brainTags, setBrainTags] = useState<Tag[]>(brain?.tags || []);
  const [clusterDialogOpen, setClusterDialogOpen] = useState(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setDescription(brain?.description || "");
    setBrainTags(brain?.tags || []);
  }, [brain?.description, brain?.tags]);

  const saveDescription = useCallback(
    (value: string) => {
      if (!brain) return;
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
        updateBrain(brain.id, brain.name, brain.icon || undefined, brain.color || undefined, value);
      }, 800);
    },
    [brain, updateBrain]
  );

  const handleDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setDescription(value);
    saveDescription(value);
  };

  const hasAiResearch = clusters.some((c) => c.type === "ai-research");
  const hasTodo = clusters.some((c) => c.type === "todo");

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto" data-testid="brain-page">
      <h1 className="text-2xl font-bold mb-2">{brain?.name || "Brain"}</h1>
      {brain && (
        <div className="mb-3">
          <EntityMetadata
            createdBy={brain.createdBy}
            createdAt={brain.createdAt}
            lastUpdatedBy={brain.lastUpdatedBy}
            updatedAt={brain.updatedAt}
          />
        </div>
      )}

      <div className="mb-4">
        <TagCombobox
          entityType="brain"
          entityId={brainId}
          currentTags={brainTags}
          onTagsChange={setBrainTags}
        />
      </div>

      <textarea
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring mb-6 resize-y min-h-[60px]"
        placeholder="Add a description..."
        value={description}
        onChange={handleDescriptionChange}
        rows={3}
      />

      <BrainStats brainId={brainId} />

      <div className="flex flex-wrap items-center justify-between gap-2 mb-6">
        <h2 className="text-xl font-semibold">Clusters</h2>
        <div className="flex flex-wrap gap-2">
          <Link href={`/brain/${brainId}/graph`}>
            <Button variant="outline" size="sm">
              <Network className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Knowledge Graph</span>
              <span className="sm:hidden">Graph</span>
            </Button>
          </Link>
          <Button size="sm" onClick={() => setClusterDialogOpen(true)} data-testid="new-cluster-btn">
            <Plus className="h-4 w-4 mr-1" />
            <span className="hidden sm:inline">New Cluster</span>
            <span className="sm:hidden">New</span>
          </Button>
        </div>
      </div>

      {clusters.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <FolderOpen className="h-12 w-12 mx-auto mb-3" />
          <p>No clusters yet. Create one to get started.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {[...clusters].sort((a, b) => {
            const typeOrder: Record<string, number> = { "todo": 0, "ai-research": 1 };
            const aOrder = typeOrder[a.type] ?? 99;
            const bOrder = typeOrder[b.type] ?? 99;
            if (aOrder !== bOrder) return aOrder - bOrder;
            return a.sortOrder - b.sortOrder;
          }).map((cluster) => {
            const Icon = cluster.type === "todo" ? CheckSquare
              : cluster.type === "ai-research" ? Sparkles
              : cluster.type === "project" ? Code : FolderOpen;
            return (
              <Link
                key={cluster.id}
                href={`/brain/${brainId}/cluster/${cluster.id}`}
                className="flex items-center gap-3 rounded-lg border p-4 hover:bg-accent transition-colors"
              >
                <Icon className="h-5 w-5 text-muted-foreground" />
                <span className="font-medium">{cluster.name}</span>
              </Link>
            );
          })}
        </div>
      )}
      <CreateClusterDialog
        open={clusterDialogOpen}
        onOpenChange={setClusterDialogOpen}
        hasAiResearch={hasAiResearch}
        hasTodo={hasTodo}
        onSubmit={createCluster}
      />
    </div>
  );
}
