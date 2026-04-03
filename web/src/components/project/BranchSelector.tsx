"use client";

import { useState } from "react";
import { GitBranch, ChevronDown, Loader2, Check } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

interface BranchSelectorProps {
  clusterId: string;
  currentBranch: string;
  onCheckout: (branch: string) => Promise<unknown>;
}

export function BranchSelector({ clusterId, currentBranch, onCheckout }: BranchSelectorProps) {
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState(false);

  const { data: branches = [], isLoading } = useQuery({
    queryKey: ["sandbox-branches", clusterId],
    queryFn: () => api.sandbox.branches(clusterId),
    enabled: open,
  });

  const handleSelect = async (branch: string) => {
    if (branch === currentBranch) {
      setOpen(false);
      return;
    }
    setSwitching(true);
    try {
      await onCheckout(branch);
      setOpen(false);
    } finally {
      setSwitching(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-muted-foreground">
          <GitBranch className="h-3.5 w-3.5" />
          <span>{currentBranch}</span>
          <ChevronDown className="h-3 w-3" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-1 w-56 max-h-[300px] overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : (
          branches.map((branch) => (
            <button
              key={branch}
              className={`flex items-center gap-2 w-full text-left px-2 py-1.5 text-sm rounded-sm transition-colors ${
                branch === currentBranch
                  ? "bg-accent text-accent-foreground"
                  : "hover:bg-accent/50"
              }`}
              onClick={() => handleSelect(branch)}
              disabled={switching}
            >
              {branch === currentBranch ? (
                <Check className="h-3.5 w-3.5 shrink-0" />
              ) : (
                <span className="w-3.5 shrink-0" />
              )}
              <span className="truncate">{branch}</span>
            </button>
          ))
        )}
      </PopoverContent>
    </Popover>
  );
}
