"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Star, FileText, AlertCircle } from "lucide-react";
import { api } from "@/lib/api";
import type { Neuron } from "@/types";

export default function FavoritesPage() {
  const [neurons, setNeurons] = useState<Neuron[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<Neuron[]>("/api/neurons/favorites").then(setNeurons).catch(() => {
      setError("Failed to load favorites");
    });
  }, []);

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
        <Star className="h-6 w-6" />
        Favorites
      </h1>

      {error && (
        <div className="mb-6 flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {neurons.length === 0 && !error ? (
        <p className="text-muted-foreground text-center py-12">No favorites yet</p>
      ) : (
        <div className="space-y-1">
          {neurons.map((neuron) => (
            <Link
              key={neuron.id}
              href={`/brain/${neuron.brainId}/cluster/${neuron.clusterId}/neuron/${neuron.id}`}
              className="flex items-center gap-3 rounded-md px-3 py-2.5 hover:bg-accent transition-colors"
            >
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="flex-1 truncate">{neuron.title || "Untitled"}</span>
              <span className="text-xs text-muted-foreground">
                {new Date(neuron.lastEditedAt).toLocaleDateString()}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
