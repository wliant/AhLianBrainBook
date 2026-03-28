"use client";

import { useState } from "react";
import Link from "next/link";
import { Search, FileText } from "lucide-react";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import type { Neuron } from "@/types";

interface SearchResult {
  results: Neuron[];
  totalCount: number;
}

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Neuron[]>([]);
  const [searched, setSearched] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    try {
      const data = await api.get<SearchResult>(`/api/search?q=${encodeURIComponent(query)}`);
      setResults(data.results);
      setSearched(true);
    } catch {
      setResults([]);
      setSearched(true);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
        <Search className="h-6 w-6" />
        Search
      </h1>

      <form onSubmit={handleSearch} className="mb-6">
        <Input
          placeholder="Search neurons..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="text-lg"
          autoFocus
        />
      </form>

      {searched && results.length === 0 && (
        <p className="text-gray-400 text-center py-8">No results found</p>
      )}

      <div className="space-y-1">
        {results.map((neuron) => (
          <Link
            key={neuron.id}
            href={`/brain/${neuron.brainId}/cluster/${neuron.clusterId}/neuron/${neuron.id}`}
            className="flex items-center gap-3 rounded-md px-3 py-2.5 hover:bg-gray-100 transition-colors"
          >
            <FileText className="h-4 w-4 text-gray-400" />
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{neuron.title || "Untitled"}</p>
              <p className="text-xs text-gray-400 truncate">
                {neuron.contentText?.slice(0, 150) || "Empty note"}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
