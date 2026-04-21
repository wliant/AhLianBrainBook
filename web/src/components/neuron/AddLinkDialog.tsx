"use client";

import { useState, useEffect } from "react";
import { Search } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import type { Neuron, NeuronLink } from "@/types";

interface SearchResponse {
  results: { neuron: Neuron }[];
  totalCount: number;
}

export function AddLinkDialog({
  open,
  onOpenChange,
  neuronId,
  brainId,
  onLinkCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  neuronId: string;
  brainId: string;
  onLinkCreated: (link: NeuronLink) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Neuron[]>([]);
  const [selected, setSelected] = useState<Neuron | null>(null);
  const [label, setLabel] = useState("");
  const [linkType, setLinkType] = useState("related-to");
  const [direction, setDirection] = useState<"outgoing" | "incoming">("outgoing");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const data = await api.get<SearchResponse>(
          `/api/search?q=${encodeURIComponent(query)}&brainId=${brainId}&size=10`
        );
        setResults(data.results.map((r) => r.neuron).filter((n) => n.id !== neuronId));
      } catch {
        setResults([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query, brainId, neuronId]);

  const handleCreate = async () => {
    if (!selected) return;
    setCreating(true);
    try {
      const sourceId = direction === "outgoing" ? neuronId : selected.id;
      const targetId = direction === "outgoing" ? selected.id : neuronId;
      const link = await api.neuronLinks.create<NeuronLink>({
        sourceNeuronId: sourceId,
        targetNeuronId: targetId,
        label: label || undefined,
        linkType: linkType || undefined,
      });
      onLinkCreated(link);
      onOpenChange(false);
      resetForm();
    } catch (err) {
      console.error("Failed to create link:", err);
    } finally {
      setCreating(false);
    }
  };

  const resetForm = () => {
    setQuery("");
    setResults([]);
    setSelected(null);
    setLabel("");
    setLinkType("related-to");
    setDirection("outgoing");
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) resetForm(); }}>
      <DialogContent className="sm:max-w-md" data-testid="add-link-dialog">
        <DialogHeader>
          <DialogTitle>Add Link</DialogTitle>
        </DialogHeader>

        {!selected ? (
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search neurons..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-9"
                autoFocus
                data-testid="link-search-input"
              />
            </div>
            <div className="max-h-60 overflow-y-auto space-y-1" data-testid="link-search-results">
              {results.map((neuron) => (
                <button
                  key={neuron.id}
                  onClick={() => setSelected(neuron)}
                  className="w-full text-left px-3 py-2 rounded-md hover:bg-accent text-sm truncate"
                >
                  {neuron.title || "Untitled"}
                </button>
              ))}
              {query && results.length === 0 && (
                <p className="text-sm text-muted-foreground px-3 py-2">No results</p>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2 p-2 rounded-md bg-accent text-sm">
              <span className="flex-1 truncate font-medium">{selected.title}</span>
              <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>
                Change
              </Button>
            </div>
            <div className="flex gap-2">
              <Button
                variant={direction === "outgoing" ? "default" : "outline"}
                size="sm"
                className="flex-1"
                onClick={() => setDirection("outgoing")}
                data-testid="link-direction-outgoing"
              >
                This → Selected
              </Button>
              <Button
                variant={direction === "incoming" ? "default" : "outline"}
                size="sm"
                className="flex-1"
                onClick={() => setDirection("incoming")}
                data-testid="link-direction-incoming"
              >
                Selected → This
              </Button>
            </div>
            <Input
              placeholder="Label (optional)"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
            <select
              value={linkType}
              onChange={(e) => setLinkType(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              data-testid="link-type-select"
            >
              <option value="related-to">Related to</option>
              <option value="references">References</option>
              <option value="depends-on">Depends on</option>
              <option value="imports">Imports</option>
              <option value="calls">Calls</option>
              <option value="contains">Contains</option>
              <option value="tested-by">Tested by</option>
            </select>
          </div>
        )}

        <DialogFooter>
          <Button onClick={handleCreate} disabled={!selected || creating} data-testid="create-link-btn">
            {creating ? "Creating..." : "Create Link"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
