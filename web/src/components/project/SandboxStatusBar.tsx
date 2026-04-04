"use client";

import { GitBranch, RefreshCw, Trash2, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Sandbox } from "@/types";

interface SandboxStatusBarProps {
  sandbox: Sandbox;
  onPull: () => void;
  onTerminate: () => void;
  pulling: boolean;
  terminating: boolean;
}

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-500",
  cloning: "bg-yellow-500",
  indexing: "bg-yellow-500",
  error: "bg-red-500",
  terminating: "bg-gray-500",
};

export function SandboxStatusBar({
  sandbox,
  onPull,
  onTerminate,
  pulling,
  terminating,
}: SandboxStatusBarProps) {
  const isActive = sandbox.status === "active";
  const isLoading = sandbox.status === "cloning" || sandbox.status === "indexing";

  return (
    <div className="flex items-center gap-3 px-3 py-1.5 border-t text-xs text-muted-foreground bg-muted/30">
      {/* Status indicator */}
      <div className="flex items-center gap-1.5">
        {isLoading ? (
          <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
        ) : (
          <span
            className={`h-2 w-2 rounded-full ${STATUS_COLORS[sandbox.status] || "bg-gray-500"}`}
            aria-hidden="true"
          />
        )}
        <span className="capitalize">{sandbox.status}</span>
      </div>

      {/* Branch */}
      <div className="flex items-center gap-1">
        <GitBranch className="h-3 w-3" />
        <span>{sandbox.currentBranch}</span>
      </div>

      {/* Commit */}
      {sandbox.currentCommit && (
        <span className="font-mono text-[10px] opacity-70">
          {sandbox.currentCommit.substring(0, 7)}
        </span>
      )}

      {/* Error message */}
      {sandbox.status === "error" && sandbox.errorMessage && (
        <div className="flex items-center gap-1 text-red-400 truncate flex-1">
          <AlertCircle className="h-3 w-3 shrink-0" />
          <span className="truncate">{sandbox.errorMessage}</span>
        </div>
      )}

      <div className="flex-1" />

      {/* Actions */}
      {isActive && (
        <Button
          size="sm"
          variant="ghost"
          className="h-6 text-xs px-2"
          onClick={onPull}
          disabled={pulling || terminating}
        >
          <RefreshCw className={`h-3 w-3 mr-1 ${pulling ? "animate-spin" : ""}`} />
          {pulling ? "Pulling..." : "Pull"}
        </Button>
      )}
      {(isActive || sandbox.status === "error") && (
        <Button
          size="sm"
          variant="ghost"
          className="h-6 text-xs px-2 text-destructive"
          onClick={onTerminate}
          disabled={terminating || pulling}
        >
          <Trash2 className="h-3 w-3 mr-1" />
          {terminating ? "Terminating..." : "Terminate"}
        </Button>
      )}
    </div>
  );
}
