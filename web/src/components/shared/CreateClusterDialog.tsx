"use client";

import { useState, useEffect } from "react";
import { FolderOpen, Sparkles, Code, CheckSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import type { ClusterType } from "@/types";

interface CreateClusterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hasAiResearch: boolean;
  hasTodo?: boolean;
  onSubmit: (name: string, type: ClusterType, repoUrl?: string) => Promise<unknown>;
}

export function CreateClusterDialog({
  open,
  onOpenChange,
  hasAiResearch,
  hasTodo,
  onSubmit,
}: CreateClusterDialogProps) {
  const [clusterName, setClusterName] = useState("");
  const [clusterType, setClusterType] = useState<ClusterType>("knowledge");
  const [repoUrl, setRepoUrl] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!open) {
      setClusterName("");
      setClusterType("knowledge");
      setRepoUrl("");
    }
  }, [open]);

  const canSubmit =
    (clusterType === "ai-research" || clusterType === "todo" || clusterName.trim()) &&
    (clusterType !== "project" || repoUrl.trim());

  const handleSubmit = async () => {
    if (!canSubmit || creating) return;
    const name = clusterType === "ai-research" ? "AI Research" : clusterType === "todo" ? "Tasks" : clusterName.trim();
    setCreating(true);
    try {
      await onSubmit(name, clusterType, clusterType === "project" ? repoUrl.trim() : undefined);
      onOpenChange(false);
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Cluster</DialogTitle>
        </DialogHeader>
        {clusterType !== "ai-research" && clusterType !== "todo" && (
          <Input
            autoFocus
            placeholder="Cluster name"
            value={clusterName}
            onChange={(e) => setClusterName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
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
            <label className={`flex items-center gap-2 text-sm ${hasTodo ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}>
              <input type="radio" name="cluster-type" value="todo"
                checked={clusterType === "todo"}
                onChange={() => setClusterType("todo")}
                disabled={hasTodo}
                className="accent-primary" />
              <CheckSquare className="h-4 w-4 text-muted-foreground" />
              Todo List
              {hasTodo && <span className="text-xs text-muted-foreground">(already exists)</span>}
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
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit || creating}>
            {creating ? "Creating..." : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
