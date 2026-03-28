"use client";

import { useState, useEffect } from "react";
import { Trash2, RotateCcw, X, FileText, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import type { Neuron } from "@/types";

export default function TrashPage() {
  const [neurons, setNeurons] = useState<Neuron[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<Neuron[]>("/api/neurons/trash").then(setNeurons).catch(() => {
      setError("Failed to load trash");
    });
  }, []);

  const handleRestore = async (id: string) => {
    await api.post(`/api/neurons/${id}/restore-from-trash`);
    setNeurons((prev) => prev.filter((n) => n.id !== id));
  };

  const handlePermanentDelete = async (id: string) => {
    if (!confirm("Permanently delete this neuron? This cannot be undone.")) return;
    await api.delete(`/api/neurons/${id}/permanent`);
    setNeurons((prev) => prev.filter((n) => n.id !== id));
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
        <Trash2 className="h-6 w-6" />
        Trash
      </h1>

      {error && (
        <div className="mb-6 flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {neurons.length === 0 && !error ? (
        <p className="text-muted-foreground text-center py-12">Trash is empty</p>
      ) : (
        <div className="space-y-1">
          {neurons.map((neuron) => (
            <div
              key={neuron.id}
              className="flex items-center gap-3 rounded-md px-3 py-2.5 hover:bg-accent"
            >
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="flex-1 truncate">{neuron.title || "Untitled"}</span>
              <Button size="sm" variant="ghost" onClick={() => handleRestore(neuron.id)}>
                <RotateCcw className="h-3.5 w-3.5 mr-1" /> Restore
              </Button>
              <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handlePermanentDelete(neuron.id)}>
                <X className="h-3.5 w-3.5 mr-1" /> Delete
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
