"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Brain, Neuron } from "@/types";

const SHORTCUTS = [
  { keys: "Ctrl+K", description: "Open search" },
  { keys: "Ctrl+N", description: "New neuron (on cluster page)" },
  { keys: "Ctrl+\\", description: "Toggle sidebar" },
  { keys: "Ctrl+Shift+F", description: "Global search (focus)" },
  { keys: "Ctrl+S", description: "Force save / snapshot" },
  { keys: "Ctrl+[", description: "Previous neuron" },
  { keys: "Ctrl+]", description: "Next neuron" },
  { keys: "Alt+1-9", description: "Switch brain" },
  { keys: "Ctrl+Shift+P", description: "Command palette" },
  { keys: "Ctrl+Shift+O", description: "Toggle table of contents" },
  { keys: "Escape", description: "Go back / close panel" },
  { keys: "?", description: "Show keyboard shortcuts" },
];

export function KeyboardShortcuts() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const params = useParams();
  const queryClient = useQueryClient();

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === "INPUT" || target.tagName === "TEXTAREA" ||
        target.getAttribute("contenteditable") === "true" ||
        target.closest("[contenteditable]");

      const ctrlOrMeta = e.ctrlKey || e.metaKey;

      // ? for help (only when not in input)
      if (e.key === "?" && !isInput && !ctrlOrMeta) {
        e.preventDefault();
        setOpen(true);
        return;
      }

      // Ctrl+K for search
      if (ctrlOrMeta && e.key === "k") {
        e.preventDefault();
        router.push("/search");
        return;
      }

      // Ctrl+\ to toggle sidebar
      if (ctrlOrMeta && e.key === "\\") {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("toggle-sidebar"));
        return;
      }

      // Ctrl+Shift+F for global search
      if (ctrlOrMeta && e.shiftKey && e.key === "F") {
        e.preventDefault();
        router.push("/search");
        return;
      }

      // Ctrl+Shift+P for command palette
      if (ctrlOrMeta && e.shiftKey && e.key === "P") {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("toggle-command-palette"));
        return;
      }

      // Ctrl+Shift+O for table of contents
      if (ctrlOrMeta && e.shiftKey && e.key === "O") {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("toggle-toc"));
        return;
      }

      // Ctrl+S for force save
      if (ctrlOrMeta && e.key === "s" && !e.shiftKey) {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("force-save"));
        return;
      }

      // Ctrl+[ / Ctrl+] for prev/next neuron
      if (ctrlOrMeta && (e.key === "[" || e.key === "]") && !isInput) {
        const clusterId = params?.clusterId as string | undefined;
        const neuronId = params?.neuronId as string | undefined;
        const brainId = params?.brainId as string | undefined;
        if (!clusterId || !neuronId || !brainId) return;

        const neurons = queryClient.getQueryData<Neuron[]>(["neurons", clusterId]);
        if (!neurons || neurons.length < 2) return;

        const currentIndex = neurons.findIndex((n) => n.id === neuronId);
        if (currentIndex === -1) return;

        const nextIndex = e.key === "]"
          ? Math.min(currentIndex + 1, neurons.length - 1)
          : Math.max(currentIndex - 1, 0);

        if (nextIndex !== currentIndex) {
          e.preventDefault();
          router.push(`/brain/${brainId}/cluster/${clusterId}/neuron/${neurons[nextIndex].id}`);
        }
        return;
      }

      // Alt+1-9 for brain switching
      if (e.altKey && !ctrlOrMeta && e.key >= "1" && e.key <= "9") {
        const brains = queryClient.getQueryData<Brain[]>(["brains"]);
        if (!brains) return;
        const index = parseInt(e.key) - 1;
        if (index < brains.length) {
          e.preventDefault();
          router.push(`/brain/${brains[index].id}`);
        }
        return;
      }

      // Escape to close dialog or go back
      if (e.key === "Escape") {
        if (open) {
          setOpen(false);
        }
      }
    },
    [router, open, params, queryClient]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          {SHORTCUTS.map((s) => (
            <div key={s.keys} className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{s.description}</span>
              <kbd className="px-2 py-0.5 rounded bg-muted text-xs font-mono">
                {s.keys}
              </kbd>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
