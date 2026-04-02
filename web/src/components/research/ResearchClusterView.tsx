"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Plus, RefreshCw, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useResearchTopics } from "@/lib/hooks/useResearchTopics";
import { useResearchSse } from "@/lib/hooks/useResearchSse";
import { useClusters } from "@/lib/hooks/useClusters";
import { ResearchTopicCard } from "./ResearchTopicCard";
import { NewResearchTopicDialog } from "./NewResearchTopicDialog";
import type { Cluster } from "@/types";

interface ResearchClusterViewProps {
  cluster: Cluster;
  brainId: string;
}

export function ResearchClusterView({ cluster, brainId }: ResearchClusterViewProps) {
  const { topics, loading, createTopic, deleteTopic, updateTopic, updateAll, expandBullet } =
    useResearchTopics(cluster.id);
  const { updateCluster } = useClusters(brainId);
  useResearchSse(cluster.id);

  const [dialogOpen, setDialogOpen] = useState(false);

  // Research goal editing
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalValue, setGoalValue] = useState(cluster.researchGoal || "");

  useEffect(() => {
    setGoalValue(cluster.researchGoal || "");
  }, [cluster.researchGoal]);

  const handleSaveGoal = useCallback(async () => {
    setEditingGoal(false);
    if (goalValue !== (cluster.researchGoal || "")) {
      await updateCluster(cluster.id, cluster.name, goalValue || undefined);
    }
  }, [goalValue, cluster, updateCluster]);

  const handleCreate = useCallback(async (prompt?: string) => {
    await createTopic(prompt);
  }, [createTopic]);

  const handleUpdateAll = useCallback(async () => {
    await updateAll();
  }, [updateAll]);

  const handleUpdateTopic = useCallback(async (id: string) => {
    await updateTopic(id);
  }, [updateTopic]);

  const handleExpand = useCallback(async (topicId: string, bulletId: string) => {
    await expandBullet(topicId, bulletId);
  }, [expandBullet]);

  const handleDeleteTopic = useCallback(async (id: string) => {
    await deleteTopic(id);
  }, [deleteTopic]);

  const isClusterGenerating = cluster.status === "generating";
  const readyTopics = topics.filter((t) => t.status === "ready");
  const hasUpdatableTopics = readyTopics.length > 0;

  return (
    <div data-testid="research-cluster-view">
      {/* Generating indicator */}
      {isClusterGenerating && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4 p-3 border rounded-lg bg-muted/30">
          <Loader2 className="h-4 w-4 animate-spin" />
          Generating research goal...
        </div>
      )}

      {/* Research Goal */}
      <div className="mb-6">
        <h3 className="text-xs uppercase text-muted-foreground mb-1 tracking-wider">Research Goal</h3>
        {editingGoal ? (
          <textarea
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y min-h-[60px]"
            value={goalValue}
            onChange={(e) => setGoalValue(e.target.value)}
            onBlur={handleSaveGoal}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSaveGoal(); } }}
            autoFocus
            data-testid="research-goal-input"
          />
        ) : (
          <div
            className="rounded-md border border-transparent hover:border-input px-3 py-2 text-sm cursor-pointer min-h-[40px]"
            onClick={() => !isClusterGenerating && setEditingGoal(true)}
            data-testid="research-goal-display"
          >
            {cluster.researchGoal || (
              <span className="text-muted-foreground italic">
                {isClusterGenerating ? "Generating..." : "Click to set research goal..."}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">Research Topics</h2>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleUpdateAll}
            disabled={!hasUpdatableTopics || isClusterGenerating}
          >
            <RefreshCw className="h-4 w-4 mr-1" />
            Update All
          </Button>
          <Button
            size="sm"
            onClick={() => setDialogOpen(true)}
            disabled={isClusterGenerating}
            data-testid="new-research-topic-btn"
          >
            <Plus className="h-4 w-4 mr-1" /> New Topic
          </Button>
        </div>
      </div>

      {/* Topic list */}
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : topics.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Sparkles className="h-12 w-12 mx-auto mb-3" />
          <p>No research topics yet.</p>
          <p className="text-sm mt-1">Create one to have AI map out what you should learn.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {topics.map((topic) => (
            <ResearchTopicCard
              key={topic.id}
              topic={topic}
              brainId={brainId}
              onUpdate={handleUpdateTopic}
              onDelete={handleDeleteTopic}
              onExpand={handleExpand}
            />
          ))}
        </div>
      )}

      <NewResearchTopicDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreate={handleCreate}
      />
    </div>
  );
}
