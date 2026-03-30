"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
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
} from "lucide-react";
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
import { useNeurons } from "@/lib/hooks/useNeurons";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import type { Brain as BrainType, Cluster as ClusterType } from "@/types";

export function Sidebar() {
  const params = useParams();
  const activeBrainId = params?.brainId as string | undefined;
  const activeClusterId = params?.clusterId as string | undefined;
  const activeNeuronId = params?.neuronId as string | undefined;

  const { brains, createBrain, updateBrain, deleteBrain } = useBrains();
  const [collapsed, setCollapsed] = useState(false);
  const [expandedBrains, setExpandedBrains] = useState<Set<string>>(new Set());
  const [expandedClusters, setExpandedClusters] = useState<Set<string>>(new Set());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create-brain" | "rename-brain" | "create-cluster">("create-brain");
  const [dialogValue, setDialogValue] = useState("");
  const [editingBrainId, setEditingBrainId] = useState<string | null>(null);

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

  const handleDialogSubmit = async () => {
    if (!dialogValue.trim()) return;
    if (dialogMode === "create-brain") {
      await createBrain(dialogValue.trim());
    } else if (dialogMode === "rename-brain" && editingBrainId) {
      await updateBrain(editingBrainId, dialogValue.trim());
    }
    setDialogOpen(false);
  };

  return (
    <aside
      className={cn(
        "flex h-full flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-200",
        collapsed ? "w-14" : "w-64"
      )}
    >
      <div className="flex items-center justify-between border-b px-3 py-3">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <Brain className="h-5 w-5 shrink-0" />
          {!collapsed && <span>BrainBook</span>}
        </Link>
        {!collapsed && (
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => setCollapsed(true)}>
            <PanelLeftClose className="h-4 w-4" />
          </Button>
        )}
      </div>

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
          </nav>
          <div className="flex-1" />
          <div className="flex flex-col items-center gap-1 border-t border-sidebar-border px-2 py-2">
            <ThemeToggle />
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
          </nav>

          <div className="flex items-center justify-between px-4 py-2">
            <span className="text-xs font-medium uppercase text-sidebar-muted">Brains</span>
            <div className="flex items-center gap-0.5">
              {expandedBrains.size > 0 && (
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleCollapseAll}>
                  <ChevronsDownUp className="h-3.5 w-3.5" />
                </Button>
              )}
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleCreateBrain}>
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
                />
              ))}
            </div>
          </ScrollArea>

          <div className="border-t border-sidebar-border px-3 py-2">
            <ThemeToggle />
          </div>
        </>
      )

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialogMode === "create-brain" && "New Brain"}
              {dialogMode === "rename-brain" && "Rename Brain"}
              {dialogMode === "create-cluster" && "New Cluster"}
            </DialogTitle>
          </DialogHeader>
          <Input
            placeholder="Name..."
            value={dialogValue}
            onChange={(e) => setDialogValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleDialogSubmit()}
            autoFocus
          />
          <DialogFooter>
            <Button onClick={handleDialogSubmit}>
              {dialogMode.startsWith("create") ? "Create" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </aside>
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
}) {
  const { clusters } = useClusters(isExpanded ? brain.id : null);

  return (
    <div>
      <div
        className={cn(
          "group flex items-center rounded-md px-2 py-1.5 text-sm",
          isActive && "bg-sidebar-accent"
        )}
      >
        <button onClick={onToggle} className="mr-1 p-0.5 hover:bg-sidebar-accent rounded">
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
            <button className="p-0.5 opacity-0 group-hover:opacity-100 hover:bg-sidebar-accent rounded">
              <MoreHorizontal className="h-3.5 w-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onCreateCluster}>
              <Plus className="mr-2 h-3.5 w-3.5" /> New Cluster
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onRename}>Rename</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onDelete} className="text-destructive">
              <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {isExpanded && (
        <div className="ml-4 space-y-0.5">
          {clusters
            .filter((c) => !c.parentClusterId)
            .map((cluster) => (
              <ClusterItem
                key={cluster.id}
                cluster={cluster}
                brainId={brain.id}
                allClusters={clusters}
                isExpanded={expandedClusters.has(cluster.id)}
                isActive={activeClusterId === cluster.id}
                activeClusterId={activeClusterId}
                activeNeuronId={activeNeuronId}
                expandedClusters={expandedClusters}
                onToggle={() => onToggleCluster(cluster.id)}
                onToggleCluster={onToggleCluster}
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
  allClusters,
  isExpanded,
  isActive,
  activeClusterId,
  activeNeuronId,
  expandedClusters,
  onToggle,
  onToggleCluster,
}: {
  cluster: ClusterType;
  brainId: string;
  allClusters: ClusterType[];
  isExpanded: boolean;
  isActive: boolean;
  activeClusterId?: string;
  activeNeuronId?: string;
  expandedClusters: Set<string>;
  onToggle: () => void;
  onToggleCluster: (id: string) => void;
}) {
  const { neurons } = useNeurons(isExpanded ? cluster.id : null);
  const childClusters = allClusters.filter((c) => c.parentClusterId === cluster.id);

  return (
    <div>
      <div
        className={cn(
          "flex items-center rounded-md px-2 py-1 text-sm text-sidebar-foreground hover:bg-sidebar-accent",
          isActive && !activeNeuronId && "bg-sidebar-accent font-medium"
        )}
      >
        <button onClick={onToggle} className="mr-1 p-0.5 hover:bg-sidebar-accent rounded">
          <ChevronRight
            className={cn("h-3 w-3 transition-transform", isExpanded && "rotate-90")}
          />
        </button>
        <Link
          href={`/brain/${brainId}/cluster/${cluster.id}`}
          className="flex items-center gap-1.5 flex-1 truncate"
        >
          <FolderOpen className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{cluster.name}</span>
        </Link>
      </div>

      {isExpanded && (
        <div className="ml-4 space-y-0.5">
          {childClusters.map((child) => (
            <ClusterItem
              key={child.id}
              cluster={child}
              brainId={brainId}
              allClusters={allClusters}
              isExpanded={expandedClusters.has(child.id)}
              isActive={activeClusterId === child.id}
              activeClusterId={activeClusterId}
              activeNeuronId={activeNeuronId}
              expandedClusters={expandedClusters}
              onToggle={() => onToggleCluster(child.id)}
              onToggleCluster={onToggleCluster}
            />
          ))}
          {neurons.map((neuron) => (
            <Link
              key={neuron.id}
              href={`/brain/${brainId}/cluster/${cluster.id}/neuron/${neuron.id}`}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-sidebar-foreground hover:bg-sidebar-accent",
                activeNeuronId === neuron.id && "bg-sidebar-accent font-medium"
              )}
            >
              <FileText className="h-3 w-3 shrink-0" />
              <span className="truncate">{neuron.title || "Untitled"}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
