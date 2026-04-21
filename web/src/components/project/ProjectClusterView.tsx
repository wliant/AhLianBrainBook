"use client";

import { useState, useCallback, useEffect } from "react";
import { GitBranch, Box, List, History, AlignLeft, Loader2, Folder, X } from "lucide-react";
import { BranchSelector } from "./BranchSelector";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useProjectConfig } from "@/lib/hooks/useProjectConfig";
import { useFileTree } from "@/lib/hooks/useFileTree";
import { useFileContent } from "@/lib/hooks/useFileContent";
import { useFileAnchors } from "@/lib/hooks/useNeuronAnchors";
import { useSandbox } from "@/lib/hooks/useSandbox";
import { useResizeHandle } from "@/lib/hooks/useResizeHandle";
import { useIsTablet } from "@/lib/hooks/useMediaQuery";
import { api } from "@/lib/api";
import { FileTreePanel } from "./FileTreePanel";
import { FileContentViewer } from "./FileContentViewer";
import { NeuronPanel } from "./NeuronPanel";
import { ProvisionSandboxDialog } from "./ProvisionSandboxDialog";
import { SandboxStatusBar } from "./SandboxStatusBar";
import { GitLogPanel } from "./GitLogPanel";
import { BlameView } from "./BlameView";
import { DiffView } from "./DiffView";
import type { CodeSelection } from "./CodeViewer";
import { isImageFile } from "@/lib/fileIcons";
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
  const { config, loading: configLoading } = useProjectConfig(cluster.id);
  const { sandbox, provision, terminate, pull, checkout } = useSandbox(cluster.id);
  const isSandboxActive = sandbox?.status === "active";
  const ref = config?.defaultBranch ?? undefined;

  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<"file" | "directory" | null>(null);
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
  const isTablet = useIsTablet();
  const { size: leftPanelWidth, handleMouseDown: handleLeftResize } = useResizeHandle(250, 150, 500, "left", isTablet);
  const { size: rightPanelWidth, handleMouseDown: handleRightResize } = useResizeHandle(300, 200, 600, "right", isTablet);
  const [fileTreeOpen, setFileTreeOpen] = useState(false);
  const [neuronOpen, setNeuronOpen] = useState(false);
  const [pulling, setPulling] = useState(false);
  const [terminating, setTerminating] = useState(false);

  // File tree: use sandbox endpoint when active, otherwise GitHub API
  const { data: sandboxEntries = [], isLoading: sandboxTreeLoading } = useQuery({
    queryKey: ["sandbox-tree", cluster.id],
    queryFn: () => api.sandbox.tree(cluster.id, ""),
    enabled: isSandboxActive,
  });
  const { entries: browseEntries, loading: browseTreeLoading, isError: browseTreeError } = useFileTree(
    !isSandboxActive && config ? cluster.id : null,
    ref
  );
  const entries = isSandboxActive ? sandboxEntries : browseEntries;
  const treeLoading = isSandboxActive ? sandboxTreeLoading : (configLoading || browseTreeLoading);

  // File content: use sandbox endpoint when active, only for files (not directories)
  const isFileSelected = selectedType === "file" && !!selectedPath;
  const { data: sandboxFileContent, isLoading: sandboxFileLoading } = useQuery({
    queryKey: ["sandbox-file", cluster.id, selectedPath],
    queryFn: () => api.sandbox.file(cluster.id, selectedPath!),
    enabled: isSandboxActive && isFileSelected,
  });
  const { fileContent: browseFileContent, loading: browseFileLoading } = useFileContent(
    isSandboxActive ? null : cluster.id,
    isFileSelected ? selectedPath : null,
    ref
  );
  const fileContent = isSandboxActive ? sandboxFileContent : browseFileContent;
  const fileLoading = isSandboxActive ? sandboxFileLoading : browseFileLoading;

  const { anchors: fileAnchors, loading: anchorsLoading } = useFileAnchors(cluster.id, selectedPath);
  const { symbols, loading: symbolsLoading } = useCodeStructure(
    isSandboxActive && isFileSelected ? cluster.id : null,
    isFileSelected ? selectedPath : null
  );

  // Blame data - fetched when blame toggle is on
  const { data: blameData } = useQuery({
    queryKey: ["sandbox-blame", cluster.id, selectedPath],
    queryFn: () => api.sandbox.blame(cluster.id, selectedPath!),
    enabled: blameVisible && isSandboxActive && isFileSelected,
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
    setSelectedType("file");
    setScrollToLine(null);
    setCodeSelection(null);
    if (!isTablet) setFileTreeOpen(false);
  }, [isTablet]);

  const handleSelectFolder = useCallback((path: string) => {
    setSelectedPath(path);
    setSelectedType("directory");
    setScrollToLine(null);
    setCodeSelection(null);
  }, []);

  // Navigate to an anchor path — auto-detects if it's a file or directory
  const handleNavigateToAnchor = useCallback((path: string) => {
    if (path === "") {
      handleSelectFolder(path);
      return;
    }
    const isDir = entries.some((e) => e.type === "directory" && e.path === path);
    if (isDir) {
      handleSelectFolder(path);
    } else {
      handleSelectFile(path);
    }
  }, [entries, handleSelectFile, handleSelectFolder]);

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
        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-2 md:hidden"
          onClick={() => setFileTreeOpen((v) => !v)}
          title="Toggle file tree"
          aria-label="Toggle file tree"
        >
          <Folder className="h-3.5 w-3.5" />
        </Button>
        {isSandboxActive && sandbox ? (
          <BranchSelector
            clusterId={cluster.id}
            currentBranch={sandbox.currentBranch}
            onCheckout={checkout}
          />
        ) : (
          <>
            <GitBranch className="h-4 w-4" />
            <span>{config?.defaultBranch ?? ""}</span>
          </>
        )}
        {config?.repoUrl && (
          <span className="text-xs opacity-60 truncate ml-2 hidden sm:inline">{config.repoUrl}</span>
        )}
        <div className="flex-1" />
        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-2 md:hidden"
          onClick={() => setNeuronOpen((v) => !v)}
          title="Toggle notes"
          aria-label="Toggle notes"
        >
          <Box className="h-3.5 w-3.5" />
        </Button>
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
      <div className="flex flex-1 min-h-0 relative">
        {/* Mobile backdrop for left drawer */}
        {!isTablet && fileTreeOpen && (
          <div
            className="fixed inset-0 bg-black/30 z-30 md:hidden"
            onClick={() => setFileTreeOpen(false)}
            aria-hidden
          />
        )}

        {/* File Tree + Structure Panel */}
        <div
          className={cn(
            "border-r overflow-hidden flex flex-col bg-background",
            isTablet
              ? "flex-shrink-0"
              : cn(
                  "fixed inset-y-0 left-0 z-40 w-[85vw] max-w-xs shadow-xl transition-transform",
                  fileTreeOpen ? "translate-x-0" : "-translate-x-full"
                )
          )}
          style={isTablet ? { width: leftPanelWidth } : undefined}
        >
          {!isTablet && (
            <div className="flex items-center justify-between px-3 py-2 border-b md:hidden">
              <span className="text-xs font-medium text-muted-foreground">FILES</span>
              <button
                className="p-0.5 hover:bg-accent rounded"
                onClick={() => setFileTreeOpen(false)}
                aria-label="Close file tree"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
          <div className={structurePanelOpen ? "flex-1 min-h-0 overflow-hidden" : "flex-1 overflow-hidden"}>
            <FileTreePanel
              entries={entries}
              loading={treeLoading}
              isError={!isSandboxActive && browseTreeError}
              selectedPath={selectedPath}
              onSelectFile={handleSelectFile}
              onSelectFolder={handleSelectFolder}
              onLoadChildren={isSandboxActive ? handleLoadChildren : undefined}
              onOpenSearch={() => setQuickOpenOpen(true)}
              onProvisionSandbox={!sandbox ? () => setProvisionDialogOpen(true) : undefined}
            />
          </div>
          {structurePanelOpen && isSandboxActive && isFileSelected && (
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

        {/* Left resize handle — desktop only */}
        <div
          className="w-1 cursor-col-resize hover:bg-primary/20 active:bg-primary/40 flex-shrink-0 hidden md:block"
          onMouseDown={handleLeftResize}
        />

        {/* File Content Viewer */}
        <div className="flex-1 min-w-0 overflow-hidden">
          {selectedType === "directory" ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
              <Folder className="h-12 w-12 opacity-30" />
              <p className="text-sm font-medium">
                {selectedPath === "" ? "Project Root" : selectedPath}
              </p>
              <p className="text-xs opacity-60">Select a file to view code</p>
            </div>
          ) : isFileSelected && fileContent ? (
            <FileContentViewer
              fileContent={fileContent}
              scrollToLine={scrollToLine}
              scrollKey={scrollKey}
              onGoToDefinition={isSandboxActive && !isImageFile(selectedPath!) ? handleGoToDefinition : undefined}
              blameData={blameVisible && !isImageFile(selectedPath!) ? blameData ?? null : null}
              onCodeSelection={setCodeSelection}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
              {fileLoading ? "Loading..." : "Select a file to view its contents"}
            </div>
          )}
        </div>

        {/* Right resize handle — desktop only */}
        <div
          className="w-1 cursor-col-resize hover:bg-primary/20 active:bg-primary/40 flex-shrink-0 hidden md:block"
          onMouseDown={handleRightResize}
        />

        {/* Mobile backdrop for right sheet */}
        {!isTablet && neuronOpen && (
          <div
            className="fixed inset-0 bg-black/30 z-30 md:hidden"
            onClick={() => setNeuronOpen(false)}
            aria-hidden
          />
        )}

        {/* Neuron Panel / Orphan List */}
        <div
          className={cn(
            "overflow-hidden bg-background",
            isTablet
              ? "flex-shrink-0"
              : neuronOpen
                ? "fixed inset-x-0 bottom-0 h-[70dvh] z-40 border-t shadow-xl"
                : "hidden"
          )}
          style={isTablet ? { width: rightPanelWidth } : undefined}
        >
          {!isTablet && (
            <div className="flex items-center justify-between px-3 py-2 border-b md:hidden">
              <span className="text-xs font-medium text-muted-foreground">NOTES</span>
              <button
                className="p-0.5 hover:bg-accent rounded"
                onClick={() => setNeuronOpen(false)}
                aria-label="Close notes"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
          <NeuronPanel
            clusterId={cluster.id}
            brainId={brainId}
            selectedPath={selectedPath}
            selectedType={selectedType}
            fileAnchors={fileAnchors}
            anchorsLoading={anchorsLoading}
            codeSelection={codeSelection}
            onNavigateToFile={handleNavigateToAnchor}
            onNavigateToFolder={handleSelectFolder}
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
        maxLine={fileContent && fileContent.encoding !== "base64" ? fileContent.content.split("\n").length : undefined}
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
