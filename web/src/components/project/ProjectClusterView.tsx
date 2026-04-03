"use client";

import { useState, useCallback } from "react";
import { GitBranch } from "lucide-react";
import { useProjectConfig } from "@/lib/hooks/useProjectConfig";
import { useFileTree } from "@/lib/hooks/useFileTree";
import { useFileContent } from "@/lib/hooks/useFileContent";
import { useFileAnchors } from "@/lib/hooks/useNeuronAnchors";
import { FileTreePanel } from "./FileTreePanel";
import { CodeViewer } from "./CodeViewer";
import { NeuronPanel } from "./NeuronPanel";
import type { Cluster } from "@/types";

interface ProjectClusterViewProps {
  cluster: Cluster;
  brainId: string;
}

export function ProjectClusterView({ cluster, brainId }: ProjectClusterViewProps) {
  const { config } = useProjectConfig(cluster.id);
  const ref = config?.defaultBranch ?? undefined;
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [scrollToLine, setScrollToLine] = useState<number | null>(null);

  const { entries, loading: treeLoading } = useFileTree(cluster.id, ref);
  const { fileContent, loading: fileLoading } = useFileContent(cluster.id, selectedPath, ref);
  const { anchors: fileAnchors, loading: anchorsLoading } = useFileAnchors(cluster.id, selectedPath);
  const [scrollKey, setScrollKey] = useState(0);

  const handleSelectFile = useCallback((path: string) => {
    setSelectedPath(path);
    setScrollToLine(null);
  }, []);

  const handleAnchorClick = useCallback((line: number) => {
    setScrollToLine(line);
    setScrollKey((k) => k + 1);
  }, []);

  return (
    <div className="flex flex-col h-full" data-testid="project-cluster-view">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2 border-b text-sm text-muted-foreground">
        <GitBranch className="h-4 w-4" />
        <span>{config?.defaultBranch ?? "main"}</span>
        {config?.repoUrl && (
          <span className="text-xs opacity-60 truncate ml-2">{config.repoUrl}</span>
        )}
      </div>

      {/* Three-panel layout */}
      <div className="flex flex-1 min-h-0">
        {/* File Tree */}
        <div className="w-[250px] border-r overflow-hidden flex-shrink-0">
          <FileTreePanel
            entries={entries}
            loading={treeLoading}
            selectedPath={selectedPath}
            onSelectFile={handleSelectFile}
          />
        </div>

        {/* Code Viewer */}
        <div className="flex-1 min-w-0 overflow-hidden">
          {selectedPath && fileContent ? (
            <CodeViewer
              fileContent={fileContent}
              anchors={fileAnchors}
              scrollToLine={scrollToLine}
              scrollKey={scrollKey}
              clusterId={cluster.id}
              brainId={brainId}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
              {fileLoading ? "Loading..." : "Select a file to view its contents"}
            </div>
          )}
        </div>

        {/* Neuron Panel */}
        <div className="w-[300px] border-l overflow-hidden flex-shrink-0">
          <NeuronPanel
            clusterId={cluster.id}
            brainId={brainId}
            selectedPath={selectedPath}
            fileAnchors={fileAnchors}
            anchorsLoading={anchorsLoading}
            onAnchorClick={handleAnchorClick}
          />
        </div>
      </div>
    </div>
  );
}
