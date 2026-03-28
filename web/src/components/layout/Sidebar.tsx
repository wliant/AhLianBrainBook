"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  Brain,
  ChevronRight,
  FolderOpen,
  Plus,
  MoreHorizontal,
  Trash2,
  Star,
  Pin,
  Search,
  Home,
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
import { ThemeToggle } from "@/components/ui/theme-toggle";
import type { Brain as BrainType } from "@/types";

export function Sidebar() {
  const params = useParams();
  const activeBrainId = params?.brainId as string | undefined;
  const activeClusterId = params?.clusterId as string | undefined;

  const { brains, createBrain, updateBrain, deleteBrain } = useBrains();
  const [expandedBrains, setExpandedBrains] = useState<Set<string>>(new Set());
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
    <aside className="flex h-full w-64 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <Brain className="h-5 w-5" />
          BrainBook
        </Link>
      </div>

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
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleCreateBrain}>
          <Plus className="h-3.5 w-3.5" />
        </Button>
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
              onToggle={() => toggleBrain(brain.id)}
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
  onToggle,
  onRename,
  onDelete,
  onCreateCluster,
}: {
  brain: BrainType;
  isExpanded: boolean;
  isActive: boolean;
  activeClusterId?: string;
  onToggle: () => void;
  onRename: () => void;
  onDelete: () => void;
  onCreateCluster: () => void;
}) {
  const { clusters, createCluster, deleteCluster } = useClusters(
    isExpanded ? brain.id : null
  );

  const handleCreateCluster = async () => {
    onCreateCluster();
  };

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
            <DropdownMenuItem onClick={handleCreateCluster}>
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
          {clusters.map((cluster) => (
            <Link
              key={cluster.id}
              href={`/brain/${brain.id}/cluster/${cluster.id}`}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-sidebar-foreground hover:bg-sidebar-accent",
                activeClusterId === cluster.id && "bg-sidebar-accent font-medium"
              )}
            >
              <FolderOpen className="h-3.5 w-3.5" />
              <span className="truncate">{cluster.name}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
