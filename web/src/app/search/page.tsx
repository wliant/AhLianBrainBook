"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Search, FileText } from "lucide-react";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { useTags } from "@/lib/hooks/useTags";
import { TagFilterSelect } from "@/components/tags/TagFilterSelect";
import type { SearchResultItem, Tag } from "@/types";

interface SearchResponse {
  results: SearchResultItem[];
  totalCount: number;
}

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedBrainTags, setSelectedBrainTags] = useState<Tag[]>([]);
  const [selectedNeuronTags, setSelectedNeuronTags] = useState<Tag[]>([]);
  const { tags: allTags } = useTags();
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const doSearch = async (q: string, brainTags: Tag[], neuronTags: Tag[]) => {
    if (!q.trim() || q.trim().length < 2) {
      if (!q.trim()) {
        setResults([]);
        setSearched(false);
      }
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("q", q);
      if (brainTags.length > 0) {
        brainTags.forEach((t) => params.append("brainTagIds", t.id));
      }
      if (neuronTags.length > 0) {
        neuronTags.forEach((t) => params.append("neuronTagIds", t.id));
      }
      const data = await api.get<SearchResponse>(`/api/search?${params.toString()}`);
      setResults(data.results);
      setSearched(true);
    } catch {
      setResults([]);
      setSearched(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      doSearch(query, selectedBrainTags, selectedNeuronTags);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, selectedBrainTags, selectedNeuronTags]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
        <Search className="h-6 w-6" />
        Search
      </h1>

      <div className="mb-4">
        <Input
          placeholder="Search neurons..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="text-lg"
          autoFocus
        />
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        <TagFilterSelect
          label="Brain Tags"
          allTags={allTags}
          selectedTags={selectedBrainTags}
          onSelectionChange={setSelectedBrainTags}
        />
        <TagFilterSelect
          label="Neuron Tags"
          allTags={allTags}
          selectedTags={selectedNeuronTags}
          onSelectionChange={setSelectedNeuronTags}
        />
      </div>

      {loading && (
        <p className="text-muted-foreground text-center py-4 text-sm">Searching...</p>
      )}

      {!loading && searched && results.length === 0 && (
        <p className="text-muted-foreground text-center py-8">No results found</p>
      )}

      <div className="space-y-1">
        {results.map((item) => (
          <Link
            key={item.neuron.id}
            href={`/brain/${item.neuron.brainId}/cluster/${item.neuron.clusterId}/neuron/${item.neuron.id}`}
            className="flex items-center gap-3 rounded-md px-3 py-2.5 hover:bg-accent transition-colors"
          >
            <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{item.neuron.title || "Untitled"}</p>
              {item.highlight ? (
                <p
                  className="text-xs text-muted-foreground line-clamp-2 [&_mark]:bg-yellow-200 [&_mark]:dark:bg-yellow-800 [&_mark]:rounded-sm [&_mark]:px-0.5"
                  dangerouslySetInnerHTML={{ __html: item.highlight }}
                />
              ) : (
                <p className="text-xs text-muted-foreground truncate">
                  {item.neuron.contentText?.slice(0, 150) || "Empty note"}
                </p>
              )}
            </div>
          </Link>
        ))}
      </div>

      {!loading && searched && results.length > 0 && (
        <p className="text-xs text-muted-foreground text-center mt-4">
          {results.length} result{results.length !== 1 ? "s" : ""}
        </p>
      )}
    </div>
  );
}
