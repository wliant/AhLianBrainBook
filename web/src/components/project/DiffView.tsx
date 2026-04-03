"use client";

import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface DiffViewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clusterId: string;
  from: string;
  to: string;
}

function classForLine(line: string): string {
  if (line.startsWith("+++") || line.startsWith("---")) return "text-muted-foreground";
  if (line.startsWith("@@")) return "text-blue-400";
  if (line.startsWith("diff ")) return "text-muted-foreground font-bold";
  if (line.startsWith("+")) return "bg-green-900/30 text-green-300";
  if (line.startsWith("-")) return "bg-red-900/30 text-red-300";
  return "";
}

export function DiffView({ open, onOpenChange, clusterId, from, to }: DiffViewProps) {
  const { data: diff, isLoading } = useQuery({
    queryKey: ["sandbox-diff", clusterId, from, to],
    queryFn: () => api.sandbox.diff(clusterId, from, to),
    enabled: open,
  });

  const lines = diff ? diff.split("\n") : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col p-0 gap-0" aria-describedby={undefined}>
        <DialogHeader className="px-4 py-3 border-b shrink-0">
          <DialogTitle className="text-sm font-mono">
            Diff: {from.substring(0, 7)} → {to.substring(0, 7)}
          </DialogTitle>
        </DialogHeader>
        <div className="overflow-auto flex-1 font-mono text-xs leading-5">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : lines.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              No changes
            </div>
          ) : (
            <pre className="p-4">
              {lines.map((line, i) => (
                <div key={i} className={`px-2 ${classForLine(line)}`}>
                  {line || "\u00A0"}
                </div>
              ))}
            </pre>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
