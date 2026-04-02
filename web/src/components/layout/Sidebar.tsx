"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import {
  Brain,
  ChevronRight,
  ChevronsDownUp,
  FolderOpen,
  FileText,
  Plus,
  MoreHorizontal,
  Trash2,
  Star,
  Search,
  Home,
  PanelLeftClose,
  PanelLeftOpen,
  Lightbulb,
  Settings,
  X,
  GraduationCap,
  Sparkles,
  Code,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useBrains } from "@/lib/hooks/useBrains";
import { useClusters } from "@/lib/hooks/useClusters";
import { api } from "@/lib/api";
import { useNeurons } from "@/lib/hooks/useNeurons";
import { useThoughts } from "@/lib/hooks/useThoughts";
import { useSpacedRepetition } from "@/lib/hooks/useSpacedRepetition";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import type { Brain as BrainType, Cluster as ClusterType, Thought as ThoughtType } from "@/types";

export function Sidebar({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const params = useParams();
  const pathname = usePathname();
  const activeBrainId = params?.brainId as string | undefined;
  const activeClusterId = params?.clusterId as string | undefined;
  const activeNeuronId = params?.neuronId as string | undefined;

  const queryClient = useQueryClient();
  const { brains, createBrain, updateBrain, deleteBrain } = useBrains();
  const { thoughts, createThought, deleteThought } = useThoughts();
  const { queue } = useSpacedRepetition();
  const [collapsed, setCollapsed] = useState(false);
  const [expandedBrains, setExpandedBrains] = useState<Set<string>>(new Set());
  const [expandedClusters, setExpandedClusters] = useState<Set<string>>(new Set());
  const [thoughtsExpanded, setThoughtsExpanded] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create-brain" | "rename-brain" | "create-cluster" | "rename-cluster" | "create-thought">("create-brain");
  const [dialogValue, setDialogValue] = useState("");
  const [editingBrainId, setEditingBrainId] = useState<string | null>(null);
  const [editingClusterId, setEditingClusterId] = useState<string | null>(null);
  const initialPathname = useRef(pathname);

  // Auto-close mobile sidebar on navigation (skip initial mount)
  useEffect(() => {
    if (pathname !== initialPathname.current) {
      onOpenChange(false);
    }
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleBrain = (id: string) => {
    setExpandedBrains((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleCluster = (id: string) => {
    setExpandedClusters((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCollapseAll = () => {
    setExpandedBrains(new Set());
    setExpandedClusters(new Set());
  };

  const handleCreateBrain = () => {
    setDialogMode("create-brain");
    setDialogValue("");
    setDialogOpen(true);
  };

  const handleRenameBrain = (brain: BrainType) => {
    setDialogMode("rename-brain");
    setDialogValue(brain.name);
    setEditingBrainId(brain.id);
    setDialogOpen(true);
  };

  const handleCreateCluster = (brainId: string) => {
    setDialogMode("create-cluster");
    setDialogValue("");
    setEditingBrainId(brainId);
    setDialogOpen(true);
  };

  const handleRenameCluster = (cluster: ClusterType) => {
    setDialogMode("rename-cluster");
    setDialogValue(cluster.name);
    setEditingBrainId(cluster.brainId);
    setEditingClusterId(cluster.id);
    setDialogOpen(true);
  };

  const handleCreateThought = () => {
    setDialogMode("create-thought");
    setDialogValue("");
    setDialogOpen(true);
  };

  const handleDialogSubmit = async () => {
    if (!dialogValue.trim()) return;
    if (dialogMode === "create-brain") {
      await createBrain(dialogValue.trim());
    } else if (dialogMode === "rename-brain" && editingBrainId) {
      await updateBrain(editingBrainId, dialogValue.trim());
    } else if (dialogMode === "create-cluster" && editingBrainId) {
      await api.post("/api/clusters", { name: dialogValue.trim(), brainId: editingBrainId });
      queryClient.invalidateQueries({ queryKey: ["clusters", editingBrainId] });
    } else if (dialogMode === "rename-cluster" && editingClusterId && editingBrainId) {
      await api.patch(`/api/clusters/${editingClusterId}`, { name: dialogValue.trim() });
      queryClient.invalidateQueries({ queryKey: ["clusters", editingBrainId] });
    } else if (dialogMode === "create-thought") {
      await createThought({ name: dialogValue.trim(), neuronTagIds: [] });
    }
    setDialogOpen(false);
  };

  const sidebarContent = (
    <>
      {collapsed ? (
        <>
          <nav className="flex flex-col items-center gap-1 px-2 py-2">
            <Link href="/search">
              <Button variant="outline" size="icon" className="h-8 w-8">
                <Search className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/">
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Home className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/favorites">
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Star className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/trash">
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Trash2 className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/thoughts">
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Lightbulb className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/review">
              <Button variant="ghost" size="icon" className="h-8 w-8 relative">
                <GraduationCap className="h-4 w-4" />
                {queue.length > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 bg-purple-500 text-white text-[9px] rounded-full h-4 w-4 flex items-center justify-center">
                    {queue.length}
                  </span>
                )}
              </Button>
            </Link>
          </nav>
          <div className="flex-1" />
          <div className="flex flex-col items-center gap-1 border-t border-sidebar-border px-2 py-2">
            <Link href="/settings">
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Settings className="h-4 w-4" />
              </Button>
            </Link>
            <ThemeToggle iconOnly />
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCollapsed(false)}>
              <PanelLeftOpen className="h-4 w-4" />
            </Button>
          </div>
        </>
      ) : (
        <>
          <div className="px-3 py-2">
            <Link href="/search">
              <Button variant="outline" size="sm" className="w-full justify-start gap-2">
                <Search className="h-4 w-4" />
                Search
              </Button>
            </Link>
          </div>

          <nav className="px-3 py-1 space-y-1">
            <Link href="/">
              <Button variant="ghost" size="sm" className="w-full justify-start gap-2">
                <Home className="h-4 w-4" />
                Dashboard
              </Button>
            </Link>
            <Link href="/favorites">
              <Button variant="ghost" size="sm" className="w-full justify-start gap-2">
                <Star className="h-4 w-4" />
                Favorites
              </Button>
            </Link>
            <Link href="/trash">
              <Button variant="ghost" size="sm" className="w-full justify-start gap-2">
                <Trash2 className="h-4 w-4" />
                Trash
              </Button>
            </Link>
            <Link href="/review">
              <Button variant="ghost" size="sm" className="w-full justify-start gap-2">
                <GraduationCap className="h-4 w-4" />
                Review
                {queue.length > 0 && (
                  <span className="ml-auto bg-purple-500 text-white text-[10px] rounded-full h-5 w-5 flex items-center justify-center">
                    {queue.length}
                  </span>
                )}
              </Button>
            </Link>
          </nav>

          <div className="flex items-center justify-between px-4 py-2">
            <span className="text-xs font-medium uppercase text-sidebar-muted">Thoughts</span>
            <div className="flex items-center gap-0.5">
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setThoughtsExpanded(!thoughtsExpanded)}>
                <ChevronRight className={cn("h-3.5 w-3.5 transition-transform", thoughtsExpanded && "rotate-90")} />
              </Button>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleCreateThought}>
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {thoughtsExpanded && thoughts.length > 0 && (
            <div className="px-2 pb-2 space-y-0.5">
              {thoughts.map((thought) => (
                <div key={thought.id} className="group flex items-center rounded-md px-2 py-1 text-sm">
                  <Link
                    href={`/thoughts/${thought.id}`}
                    className={cn(
                      "flex items-center gap-1.5 flex-1 truncate text-sidebar-foreground hover:text-sidebar-foreground/80",
                      pathname.startsWith(`/thoughts/${thought.id}`) && "font-medium"
                    )}
                  >
                    <Lightbulb className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{thought.name}</span>
                  </Link>
                  <button
                    className="p-0.5 opacity-0 group-hover:opacity-100 hover:bg-sidebar-accent rounded text-destructive"
                    onClick={() => deleteThought(thought.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between px-4 py-2">
            <span className="text-xs font-medium uppercase text-sidebar-muted">Brains</span>
            <div className="flex items-center gap-0.5">
              {expandedBrains.size > 0 && (
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleCollapseAll}>
                  <ChevronsDownUp className="h-3.5 w-3.5" />
                </Button>
              )}
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleCreateBrain} data-testid="sidebar-create-brain-btn">
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          <ScrollArea className="flex-1">
            <div className="px-2 pb-4 space-y-0.5">
              {brains.map((brain) => (
                <BrainItem
                  key={brain.id}
                  brain={brain}
                  isExpanded={expandedBrains.has(brain.id)}
                  isActive={activeBrainId === brain.id}
                  activeClusterId={activeClusterId}
                  activeNeuronId={activeNeuronId}
                  expandedClusters={expandedClusters}
                  onToggle={() => toggleBrain(brain.id)}
                  onToggleCluster={toggleCluster}
                  onRename={() => handleRenameBrain(brain)}
                  onDelete={() => deleteBrain(brain.id)}
                  onCreateCluster={() => handleCreateCluster(brain.id)}
                  onRenameCluster={handleRenameCluster}
                  onDeleteCluster={async (cluster) => {
                    if (confirm(`Delete cluster "${cluster.name}"?`)) {
                      await api.delete(`/api/clusters/${cluster.id}`);
                      queryClient.invalidateQueries({ queryKey: ["clusters", brain.id] });
                    }
                  }}
                />
              ))}
            </div>
          </ScrollArea>

          <div className="border-t border-sidebar-border px-3 py-2 flex items-center gap-2">
            <Link href="/settings">
              <Button variant="ghost" size="sm" className="gap-2">
                <Settings className="h-4 w-4" />
                Settings
              </Button>
            </Link>
            <div className="flex-1" />
            <ThemeToggle />
          </div>
        </>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent data-testid="sidebar-dialog">
          <DialogHeader>
            <DialogTitle>
              {dialogMode === "create-brain" && "New Brain"}
              {dialogMode === "rename-brain" && "Rename Brain"}
              {dialogMode === "create-cluster" && "New Cluster"}
              {dialogMode === "rename-cluster" && "Rename Cluster"}
              {dialogMode === "create-thought" && "New Thought"}
            </DialogTitle>
          </DialogHeader>
          <Input
            placeholder="Name..."
            value={dialogValue}
            onChange={(e) => setDialogValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleDialogSubmit()}
            autoFocus
            data-testid="sidebar-dialog-input"
          />
          <DialogFooter>
            <Button onClick={handleDialogSubmit} data-testid="sidebar-dialog-submit">
              {dialogMode.startsWith("create") ? "Create" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );

  return (
    <>
      {/* Mobile overlay backdrop */}
      {open && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => onOpenChange(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        data-testid="sidebar"
        className={cn(
          "flex flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-200",
          // Desktop: static sidebar with collapse
          "hidden lg:flex lg:h-full",
          collapsed ? "lg:w-14" : "lg:w-64",
          // Mobile: fixed overlay
          open && "fixed inset-y-0 left-0 z-50 flex w-64 h-full lg:relative"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b px-3 py-3">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <Brain className="h-5 w-5 shrink-0" />
            {!collapsed && <span>BrainBook</span>}
          </Link>
          <div className="flex items-center gap-1">
            {/* Close button on mobile */}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0 lg:hidden"
              onClick={() => onOpenChange(false)}
            >
              <X className="h-4 w-4" />
            </Button>
            {/* Collapse button on desktop */}
            {!collapsed && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0 hidden lg:flex"
                onClick={() => setCollapsed(true)}
              >
                <PanelLeftClose className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {sidebarContent}
      </aside>
    </>
  );
}

function BrainItem({
  brain,
  isExpanded,
  isActive,
  activeClusterId,
  activeNeuronId,
  expandedClusters,
  onToggle,
  onToggleCluster,
  onRename,
  onDelete,
  onCreateCluster,
  onRenameCluster,
  onDeleteCluster,
}: {
  brain: BrainType;
  isExpanded: boolean;
  isActive: boolean;
  activeClusterId?: string;
  activeNeuronId?: string;
  expandedClusters: Set<string>;
  onToggle: () => void;
  onToggleCluster: (id: string) => void;
  onRename: () => void;
  onDelete: () => void;
  onCreateCluster: () => void;
  onRenameCluster: (cluster: ClusterType) => void;
  onDeleteCluster: (cluster: ClusterType) => void;
}) {
  const { clusters: rawClusters } = useClusters(isExpanded ? brain.id : null);
  // Sort: AI Research first, then by sortOrder
  const clusters = [...rawClusters].sort((a, b) => {
    if (a.type === "ai-research" && b.type !== "ai-research") return -1;
    if (a.type !== "ai-research" && b.type === "ai-research") return 1;
    return a.sortOrder - b.sortOrder;
  });

  return (
    <div>
      <div
        data-testid={`sidebar-brain-${brain.id}`}
        className={cn(
          "group flex items-center rounded-md py-1.5 text-sm",
          isActive && "bg-sidebar-accent"
        )}
      >
        <button onClick={onToggle} className="mr-1 p-0.5 hover:bg-sidebar-accent rounded" data-testid={`sidebar-brain-toggle-${brain.id}`}>
          <ChevronRight
            className={cn("h-3.5 w-3.5 transition-transform", isExpanded && "rotate-90")}
          />
        </button>
        <Link
          href={`/brain/${brain.id}`}
          className="flex-1 truncate"
          style={{ color: brain.color || undefined }}
        >
          {brain.icon && <span className="mr-1">{brain.icon}</span>}
          {brain.name}
        </Link>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="p-0.5 opacity-30 group-hover:opacity-100 hover:bg-sidebar-accent rounded shrink-0" data-testid={`sidebar-brain-menu-${brain.id}`}>
              <MoreHorizontal className="h-3.5 w-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onCreateCluster} data-testid={`sidebar-brain-new-cluster-${brain.id}`}>
              <Plus className="mr-2 h-3.5 w-3.5" /> New Cluster
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onRename} data-testid={`sidebar-brain-rename-${brain.id}`}>Rename</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onDelete} className="text-destructive" data-testid={`sidebar-brain-delete-${brain.id}`}>
              <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {isExpanded && (
        <div className="ml-4 space-y-0.5">
          {clusters.map((cluster) => (
              <ClusterItem
                key={cluster.id}
                cluster={cluster}
                brainId={brain.id}
                isExpanded={expandedClusters.has(cluster.id)}
                isActive={activeClusterId === cluster.id}
                activeNeuronId={activeNeuronId}
                onToggle={() => onToggleCluster(cluster.id)}
                onRenameCluster={onRenameCluster}
                onDeleteCluster={onDeleteCluster}
              />
            ))}
        </div>
      )}
    </div>
  );
}

function ClusterItem({
  cluster,
  brainId,
  isExpanded,
  isActive,
  activeNeuronId,
  onToggle,
  onRenameCluster,
  onDeleteCluster,
}: {
  cluster: ClusterType;
  brainId: string;
  isExpanded: boolean;
  isActive: boolean;
  activeNeuronId?: string;
  onToggle: () => void;
  onRenameCluster: (cluster: ClusterType) => void;
  onDeleteCluster: (cluster: ClusterType) => void;
}) {
  const isAiResearch = cluster.type === "ai-research";
  const canExpand = !isAiResearch;
  const { neurons } = useNeurons(isExpanded && canExpand ? cluster.id : null);
  const VIRTUAL_THRESHOLD = 20;
  const neuronListRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: neurons.length,
    getScrollElement: useCallback(() => neuronListRef.current, []),
    estimateSize: useCallback(() => 28, []),
    overscan: 5,
    enabled: neurons.length > VIRTUAL_THRESHOLD,
  });

  return (
    <div>
      <div
        data-testid={`sidebar-cluster-${cluster.id}`}
        className={cn(
          "group/cluster flex items-center rounded-md py-1 text-sm text-sidebar-foreground hover:bg-sidebar-accent",
          isActive && !activeNeuronId && "bg-sidebar-accent font-medium"
        )}
      >
        {canExpand ? (
          <button onClick={onToggle} className="mr-1 p-0.5 hover:bg-sidebar-accent rounded" data-testid={`sidebar-cluster-toggle-${cluster.id}`}>
            <ChevronRight
              className={cn("h-3 w-3 transition-transform", isExpanded && "rotate-90")}
            />
          </button>
        ) : (
          <span className="mr-1 w-4" />
        )}
        <Link
          href={`/brain/${brainId}/cluster/${cluster.id}`}
          className="flex items-center gap-1.5 flex-1 truncate"
        >
          {cluster.type === "ai-research" ? <Sparkles className="h-3.5 w-3.5 shrink-0" />
            : cluster.type === "project" ? <Code className="h-3.5 w-3.5 shrink-0" />
            : <FolderOpen className="h-3.5 w-3.5 shrink-0" />}
          <span className="truncate">{cluster.name}</span>
        </Link>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="p-0.5 opacity-30 group-hover/cluster:opacity-100 hover:bg-sidebar-accent rounded shrink-0">
              <MoreHorizontal className="h-3.5 w-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {!isAiResearch && (
              <DropdownMenuItem onClick={() => onRenameCluster(cluster)}>Rename</DropdownMenuItem>
            )}
            <DropdownMenuItem className="text-destructive" onClick={() => onDeleteCluster(cluster)}>Delete</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {isExpanded && canExpand && (
        <div className="ml-4 space-y-0.5">
          {neurons.length > VIRTUAL_THRESHOLD ? (
            <div
              ref={neuronListRef}
              className="overflow-auto"
              style={{ maxHeight: `${Math.min(neurons.length, 50) * 28}px` }}
            >
              <div style={{ height: `${virtualizer.getTotalSize()}px`, position: "relative" }}>
                {virtualizer.getVirtualItems().map((virtualRow) => {
                  const neuron = neurons[virtualRow.index];
                  return (
                    <Link
                      key={neuron.id}
                      href={`/brain/${brainId}/cluster/${cluster.id}/neuron/${neuron.id}`}
                      data-testid={`sidebar-neuron-${neuron.id}`}
                      className={cn(
                        "flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-sidebar-foreground hover:bg-sidebar-accent absolute left-0 right-0",
                        activeNeuronId === neuron.id && "bg-sidebar-accent font-medium"
                      )}
                      style={{
                        height: `${virtualRow.size}px`,
                        transform: `translateY(${virtualRow.start}px)`,
                      }}
                    >
                      <FileText className="h-3 w-3 shrink-0" />
                      <span className="truncate">{neuron.title || "Untitled"}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ) : (
            neurons.map((neuron) => (
              <Link
                key={neuron.id}
                href={`/brain/${brainId}/cluster/${cluster.id}/neuron/${neuron.id}`}
                data-testid={`sidebar-neuron-${neuron.id}`}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-sidebar-foreground hover:bg-sidebar-accent",
                  activeNeuronId === neuron.id && "bg-sidebar-accent font-medium"
                )}
              >
                <FileText className="h-3 w-3 shrink-0" />
                <span className="truncate">{neuron.title || "Untitled"}</span>
              </Link>
            ))
          )}
        </div>
      )}
    </div>
  );
}
