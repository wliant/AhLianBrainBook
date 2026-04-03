"use client";

import { use, useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { FolderOpen, Plus, Network, Sparkles, Code } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useClusters } from "@/lib/hooks/useClusters";
import { useBrains } from "@/lib/hooks/useBrains";
import { TagCombobox } from "@/components/tags/TagCombobox";
import { BrainStats } from "@/components/brain/BrainStats";
import { EntityMetadata } from "@/components/shared/EntityMetadata";
import type { ClusterType, Tag } from "@/types";

export default function BrainPage({ params }: { params: Promise<{ brainId: string }> }) {
  const { brainId } = use(params);
  const { clusters, createCluster } = useClusters(brainId);
  const { brains, updateBrain } = useBrains();
  const brain = brains.find((b) => b.id === brainId);

  const [description, setDescription] = useState(brain?.description || "");
  const [brainTags, setBrainTags] = useState<Tag[]>(brain?.tags || []);
  const [clusterDialogOpen, setClusterDialogOpen] = useState(false);
  const [clusterName, setClusterName] = useState("");
  const [clusterType, setClusterType] = useState<ClusterType>("knowledge");
  const [repoUrl, setRepoUrl] = useState("");
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

  const handleNewCluster = async () => {
    const name = clusterType === "ai-research" ? "AI Research" : clusterName.trim();
    if (!name) return;
    if (clusterType === "project" && !repoUrl.trim()) return;
    await createCluster(name, clusterType, clusterType === "project" ? repoUrl.trim() : undefined);
    setClusterName("");
    setClusterType("knowledge");
    setRepoUrl("");
    setClusterDialogOpen(false);
  };

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

      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold">Clusters</h2>
        <div className="flex gap-2">
          <Link href={`/brain/${brainId}/graph`}>
            <Button variant="outline" size="sm">
              <Network className="h-4 w-4 mr-1" /> Knowledge Graph
            </Button>
          </Link>
          <Button size="sm" onClick={() => setClusterDialogOpen(true)} data-testid="new-cluster-btn">
            <Plus className="h-4 w-4 mr-1" /> New Cluster
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
            if (a.type === "ai-research" && b.type !== "ai-research") return -1;
            if (a.type !== "ai-research" && b.type === "ai-research") return 1;
            return a.sortOrder - b.sortOrder;
          }).map((cluster) => {
            const Icon = cluster.type === "ai-research" ? Sparkles
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
      <Dialog open={clusterDialogOpen} onOpenChange={(open) => {
        setClusterDialogOpen(open);
        if (!open) { setClusterName(""); setClusterType("knowledge"); setRepoUrl(""); }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Cluster</DialogTitle>
          </DialogHeader>
          {clusterType !== "ai-research" && (
            <Input
              autoFocus
              placeholder="Cluster name"
              value={clusterName}
              onChange={(e) => setClusterName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleNewCluster()}
              data-testid="cluster-name-input"
            />
          )}
          <div className="space-y-2">
            <p className="text-sm font-medium">Type</p>
            <div className="space-y-1.5">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="radio" name="cluster-type" value="knowledge"
                  checked={clusterType === "knowledge"}
                  onChange={() => setClusterType("knowledge")}
                  className="accent-primary" />
                <FolderOpen className="h-4 w-4 text-muted-foreground" />
                Knowledge
              </label>
              <label className={`flex items-center gap-2 text-sm ${hasAiResearch ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}>
                <input type="radio" name="cluster-type" value="ai-research"
                  checked={clusterType === "ai-research"}
                  onChange={() => setClusterType("ai-research")}
                  disabled={hasAiResearch}
                  className="accent-primary" />
                <Sparkles className="h-4 w-4 text-muted-foreground" />
                AI Research
                {hasAiResearch && <span className="text-xs text-muted-foreground">(already exists)</span>}
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="radio" name="cluster-type" value="project"
                  checked={clusterType === "project"}
                  onChange={() => setClusterType("project")}
                  className="accent-primary" />
                <Code className="h-4 w-4 text-muted-foreground" />
                Project
              </label>
            </div>
          </div>
          {clusterType === "project" && (
            <Input
              placeholder="Repository URL (e.g. https://github.com/owner/repo)"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              data-testid="repo-url-input"
            />
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setClusterDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleNewCluster} disabled={
              clusterType !== "ai-research" && !clusterName.trim() ||
              clusterType === "project" && !repoUrl.trim()
            }>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
