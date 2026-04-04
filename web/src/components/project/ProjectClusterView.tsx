"use client";

import { useState, useCallback, useEffect } from "react";
import { GitBranch, Box, List, History, AlignLeft, Loader2 } from "lucide-react";
import { BranchSelector } from "./BranchSelector";
import { Button } from "@/components/ui/button";
import { useProjectConfig } from "@/lib/hooks/useProjectConfig";
import { useFileTree } from "@/lib/hooks/useFileTree";
import { useFileContent } from "@/lib/hooks/useFileContent";
import { useFileAnchors } from "@/lib/hooks/useNeuronAnchors";
import { useSandbox } from "@/lib/hooks/useSandbox";
import { useResizeHandle } from "@/lib/hooks/useResizeHandle";
import { api } from "@/lib/api";
import { FileTreePanel } from "./FileTreePanel";
import { CodeViewer } from "./CodeViewer";
import { NeuronPanel } from "./NeuronPanel";
import { ProvisionSandboxDialog } from "./ProvisionSandboxDialog";
import { SandboxStatusBar } from "./SandboxStatusBar";
import { GitLogPanel } from "./GitLogPanel";
import { BlameView } from "./BlameView";
import { DiffView } from "./DiffView";
import type { CodeSelection } from "./CodeViewer";
import { GoToLineDialog } from "./GoToLineDialog";
import { FileStructurePanel } from "./FileStructurePanel";
import { QuickOpenDialog } from "./QuickOpenDialog";
import { useCodeStructure } from "@/lib/hooks/useCodeStructure";
import type { Cluster, FileTreeEntry, FileContent } from "@/types";
import { useQuery } from "@tanstack/react-query";

interface ProjectClusterViewProps {
  cluster: Cluster;
  brainId: string;
}

export function ProjectClusterView({ cluster, brainId }: ProjectClusterViewProps) {
  const { config } = useProjectConfig(cluster.id);
  const { sandbox, provision, terminate, pull, checkout } = useSandbox(cluster.id);
  const isSandboxActive = sandbox?.status === "active";
  const ref = config?.defaultBranch ?? undefined;

  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [scrollToLine, setScrollToLine] = useState<number | null>(null);
  const [scrollKey, setScrollKey] = useState(0);
  const [provisionDialogOpen, setProvisionDialogOpen] = useState(false);
  const [quickOpenOpen, setQuickOpenOpen] = useState(false);
  const [structurePanelOpen, setStructurePanelOpen] = useState(false);
  const [gitLogOpen, setGitLogOpen] = useState(false);
  const [diffView, setDiffView] = useState<{ from: string; to: string } | null>(null);
  const [blameVisible, setBlameVisible] = useState(false);
  const [codeSelection, setCodeSelection] = useState<CodeSelection | null>(null);
  const [goToLineOpen, setGoToLineOpen] = useState(false);
  const { size: leftPanelWidth, handleMouseDown: handleLeftResize } = useResizeHandle(250, 150, 500, "left");
  const { size: rightPanelWidth, handleMouseDown: handleRightResize } = useResizeHandle(300, 200, 600, "right");
  const [pulling, setPulling] = useState(false);
  const [terminating, setTerminating] = useState(false);

  // File tree: use sandbox endpoint when active, otherwise GitHub API
  const { data: sandboxEntries = [], isLoading: sandboxTreeLoading } = useQuery({
    queryKey: ["sandbox-tree", cluster.id],
    queryFn: () => api.sandbox.tree(cluster.id, ""),
    enabled: isSandboxActive,
  });
  const { entries: browseEntries, loading: browseTreeLoading } = useFileTree(
    isSandboxActive ? null : cluster.id,
    ref
  );
  const entries = isSandboxActive ? sandboxEntries : browseEntries;
  const treeLoading = isSandboxActive ? sandboxTreeLoading : browseTreeLoading;

  // File content: use sandbox endpoint when active
  const { data: sandboxFileContent, isLoading: sandboxFileLoading } = useQuery({
    queryKey: ["sandbox-file", cluster.id, selectedPath],
    queryFn: () => api.sandbox.file(cluster.id, selectedPath!),
    enabled: isSandboxActive && !!selectedPath,
  });
  const { fileContent: browseFileContent, loading: browseFileLoading } = useFileContent(
    isSandboxActive ? null : cluster.id,
    selectedPath,
    ref
  );
  const fileContent = isSandboxActive ? sandboxFileContent : browseFileContent;
  const fileLoading = isSandboxActive ? sandboxFileLoading : browseFileLoading;

  const { anchors: fileAnchors, loading: anchorsLoading } = useFileAnchors(cluster.id, selectedPath);
  const { symbols, loading: symbolsLoading } = useCodeStructure(
    isSandboxActive ? cluster.id : null,
    selectedPath
  );

  // Blame data - fetched when blame toggle is on
  const { data: blameData } = useQuery({
    queryKey: ["sandbox-blame", cluster.id, selectedPath],
    queryFn: () => api.sandbox.blame(cluster.id, selectedPath!),
    enabled: blameVisible && isSandboxActive && !!selectedPath,
  });

  // Keyboard shortcuts: Ctrl+P (quick open), Ctrl+Shift+O (structure panel)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "p") {
        e.preventDefault();
        setQuickOpenOpen(true);
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "O") {
        e.preventDefault();
        setStructurePanelOpen((prev) => !prev);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "g") {
        e.preventDefault();
        setGoToLineOpen(true);
      }
      if (e.key === "Escape") {
        setGitLogOpen(false);
        setBlameVisible(false);
        setStructurePanelOpen(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const handleSymbolClick = useCallback((line: number) => {
    setScrollToLine(line);
    setScrollKey((k) => k + 1);
  }, []);

  const handleGoToLine = useCallback((line: number) => {
    setScrollToLine(line);
    setScrollKey((k) => k + 1);
  }, []);

  const handleGoToDefinition = useCallback(
    async (line: number, col: number) => {
      if (!isSandboxActive || !selectedPath) return;
      try {
        const result = await api.sandbox.definition(cluster.id, selectedPath, line, col);
        if (result.location) {
          if (result.location.file && result.location.file !== selectedPath) {
            setSelectedPath(result.location.file);
          }
          setScrollToLine(result.location.line);
          setScrollKey((k) => k + 1);
        }
      } catch {
        // silently ignore if definition lookup fails
      }
    },
    [isSandboxActive, selectedPath, cluster.id]
  );

  const handleLoadChildren = useCallback(
    async (path: string) => {
      if (isSandboxActive) {
        return api.sandbox.tree(cluster.id, path);
      }
      // Browse mode uses GitHub API which returns full recursive tree — no lazy loading needed
      return [];
    },
    [isSandboxActive, cluster.id]
  );

  const handleSelectFile = useCallback((path: string) => {
    setSelectedPath(path);
    setScrollToLine(null);
    setCodeSelection(null);
  }, []);

  const handleProvision = async (body: { branch: string; shallow: boolean }) => {
    await provision(body);
  };

  const handlePull = async () => {
    setPulling(true);
    try {
      await pull();
    } finally {
      setPulling(false);
    }
  };

  const handleTerminate = async () => {
    if (confirm("This will delete the cloned repository from the server. Your notes and anchors will be preserved.")) {
      setTerminating(true);
      try {
        await terminate();
      } finally {
        setTerminating(false);
      }
    }
  };

  return (
    <div className="flex flex-col h-full" data-testid="project-cluster-view">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2 border-b text-sm text-muted-foreground">
        {isSandboxActive && sandbox ? (
          <BranchSelector
            clusterId={cluster.id}
            currentBranch={sandbox.currentBranch}
            onCheckout={checkout}
          />
        ) : (
          <>
            <GitBranch className="h-4 w-4" />
            <span>{config?.defaultBranch ?? "main"}</span>
          </>
        )}
        {config?.repoUrl && (
          <span className="text-xs opacity-60 truncate ml-2">{config.repoUrl}</span>
        )}
        <div className="flex-1" />
        {isSandboxActive && (
          <>
            <Button
              size="sm"
              variant={structurePanelOpen ? "secondary" : "ghost"}
              className="h-7 text-xs"
              onClick={() => setStructurePanelOpen((prev) => !prev)}
              title="Toggle outline (Ctrl+Shift+O)"
            >
              <List className="h-3 w-3" />
            </Button>
            <Button
              size="sm"
              variant={gitLogOpen ? "secondary" : "ghost"}
              className="h-7 text-xs"
              onClick={() => setGitLogOpen((prev) => !prev)}
              title="Toggle commit log"
            >
              <History className="h-3 w-3" />
            </Button>
            <Button
              size="sm"
              variant={blameVisible ? "secondary" : "ghost"}
              className="h-7 text-xs"
              onClick={() => setBlameVisible((prev) => !prev)}
              title="Toggle blame annotations"
            >
              <AlignLeft className="h-3 w-3" />
            </Button>
          </>
        )}
        {!sandbox && (
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            onClick={() => setProvisionDialogOpen(true)}
          >
            <Box className="h-3 w-3 mr-1" />
            Provision Sandbox
          </Button>
        )}
      </div>

      {/* Loading state during sandbox provisioning */}
      {sandbox && (sandbox.status === "cloning" || sandbox.status === "indexing") && (
        <div className="flex flex-1 items-center justify-center">
          <div className="flex flex-col items-center gap-3 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin" />
            <p className="text-sm">
              {sandbox.status === "cloning" ? "Cloning repository..." : "Indexing files..."}
            </p>
          </div>
        </div>
      )}

      {/* Three-panel layout */}
      {!(sandbox && (sandbox.status === "cloning" || sandbox.status === "indexing")) && (
      <div className="flex flex-1 min-h-0">
        {/* File Tree + Structure Panel */}
        <div className="border-r overflow-hidden flex-shrink-0 flex flex-col" style={{ width: leftPanelWidth }}>
          <div className={structurePanelOpen ? "flex-1 min-h-0 overflow-hidden" : "flex-1 overflow-hidden"}>
            <FileTreePanel
              entries={entries}
              loading={treeLoading}
              selectedPath={selectedPath}
              onSelectFile={handleSelectFile}
              onLoadChildren={isSandboxActive ? handleLoadChildren : undefined}
            />
          </div>
          {structurePanelOpen && isSandboxActive && selectedPath && (
            <div className="border-t max-h-[40%] overflow-hidden flex flex-col">
              <div className="flex items-center justify-between px-2 py-1 text-xs font-medium text-muted-foreground border-b">
                <span>OUTLINE</span>
                <button
                  className="hover:text-foreground"
                  onClick={() => setStructurePanelOpen(false)}
                  aria-label="Close outline"
                >
                  ×
                </button>
              </div>
              <div className="overflow-y-auto flex-1">
                <FileStructurePanel
                  symbols={symbols}
                  loading={symbolsLoading}
                  onSymbolClick={handleSymbolClick}
                />
              </div>
            </div>
          )}
        </div>

        {/* Left resize handle */}
        <div
          className="w-1 cursor-col-resize hover:bg-primary/20 active:bg-primary/40 flex-shrink-0"
          onMouseDown={handleLeftResize}
        />

        {/* Code Viewer */}
        <div className="flex-1 min-w-0 overflow-hidden">
          {selectedPath && fileContent ? (
            <CodeViewer
              fileContent={fileContent}
              scrollToLine={scrollToLine}
              scrollKey={scrollKey}
              onGoToDefinition={isSandboxActive ? handleGoToDefinition : undefined}
              blameData={blameVisible ? blameData ?? null : null}
              onCodeSelection={setCodeSelection}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
              {fileLoading ? "Loading..." : "Select a file to view its contents"}
            </div>
          )}
        </div>

        {/* Right resize handle */}
        <div
          className="w-1 cursor-col-resize hover:bg-primary/20 active:bg-primary/40 flex-shrink-0"
          onMouseDown={handleRightResize}
        />

        {/* Neuron Panel / Orphan List */}
        <div className="overflow-hidden flex-shrink-0" style={{ width: rightPanelWidth }}>
          <NeuronPanel
            clusterId={cluster.id}
            brainId={brainId}
            selectedPath={selectedPath}
            fileAnchors={fileAnchors}
            anchorsLoading={anchorsLoading}
            codeSelection={codeSelection}
          />
        </div>
      </div>
      )}

      {/* Git Log Panel */}
      {gitLogOpen && isSandboxActive && (
        <GitLogPanel
          clusterId={cluster.id}
          onViewDiff={(sha) => setDiffView({ from: sha + "~1", to: sha })}
        />
      )}

      {/* Blame View */}
      {blameVisible && isSandboxActive && selectedPath && blameData && blameData.length > 0 && (
        <BlameView
          blameData={blameData}
          selectedPath={selectedPath}
          onViewDiff={(sha) => setDiffView({ from: sha + "~1", to: sha })}
        />
      )}

      {/* Sandbox Status Bar */}
      {sandbox && (
        <SandboxStatusBar
          sandbox={sandbox}
          onPull={handlePull}
          onTerminate={handleTerminate}
          pulling={pulling}
          terminating={terminating}
        />
      )}

      {/* Provision Dialog */}
      {config && (
        <ProvisionSandboxDialog
          open={provisionDialogOpen}
          onOpenChange={setProvisionDialogOpen}
          repoUrl={config.repoUrl}
          defaultBranch={config.defaultBranch}
          onProvision={handleProvision}
        />
      )}

      {/* Diff View Dialog */}
      {diffView && (
        <DiffView
          open={!!diffView}
          onOpenChange={(open) => { if (!open) setDiffView(null); }}
          clusterId={cluster.id}
          from={diffView.from}
          to={diffView.to}
        />
      )}

      {/* Go To Line Dialog */}
      <GoToLineDialog
        open={goToLineOpen}
        onOpenChange={setGoToLineOpen}
        onGoToLine={handleGoToLine}
        maxLine={fileContent?.content.split("\n").length}
      />

      {/* Quick Open Dialog */}
      <QuickOpenDialog
        open={quickOpenOpen}
        onOpenChange={setQuickOpenOpen}
        entries={entries}
        onSelectFile={handleSelectFile}
      />
    </div>
  );
}
