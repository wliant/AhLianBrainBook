"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import DOMPurify from "dompurify";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Search, FileText } from "lucide-react";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { useTags } from "@/lib/hooks/useTags";
import { useDebounce } from "@/lib/hooks/useDebounce";
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
  const [error, setError] = useState<string | null>(null);
  const [selectedBrainTags, setSelectedBrainTags] = useState<Tag[]>([]);
  const [selectedNeuronTags, setSelectedNeuronTags] = useState<Tag[]>([]);
  const { tags: allTags } = useTags();

  const doSearch = useDebounce(
    async (q: string, brainTags: Tag[], neuronTags: Tag[]) => {
      if (!q.trim() || q.trim().length < 2) {
        if (!q.trim()) {
          setResults([]);
          setSearched(false);
          setError(null);
        }
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        params.set("q", q);
        brainTags.forEach((t) => params.append("brainTagIds", t.id));
        neuronTags.forEach((t) => params.append("neuronTagIds", t.id));
        const data = await api.get<SearchResponse>(`/api/search?${params.toString()}`);
        setResults(data.results);
        setSearched(true);
      } catch {
        setError("Search failed. Please try again.");
        setResults([]);
        setSearched(true);
      } finally {
        setLoading(false);
      }
    },
    300
  );

  useEffect(() => {
    doSearch(query, selectedBrainTags, selectedNeuronTags);
  }, [query, selectedBrainTags, selectedNeuronTags, doSearch]);

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
          aria-label="Search neurons"
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
        <p className="text-muted-foreground text-center py-4 text-sm" role="status" aria-live="polite">
          Searching...
        </p>
      )}

      {error && (
        <p className="text-destructive text-center py-4 text-sm" role="alert">
          {error}
        </p>
      )}

      {!loading && !error && searched && results.length === 0 && (
        <p className="text-muted-foreground text-center py-8">No results found</p>
      )}

      <SearchResults results={results} />

      {!loading && searched && results.length > 0 && (
        <p className="text-xs text-muted-foreground text-center mt-4" aria-live="polite">
          {results.length} result{results.length !== 1 ? "s" : ""}
        </p>
      )}
    </div>
  );
}

const SEARCH_VIRTUAL_THRESHOLD = 30;
const SEARCH_ITEM_HEIGHT = 60;

function SearchResults({ results }: { results: SearchResultItem[] }) {
  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: results.length,
    getScrollElement: useCallback(() => parentRef.current, []),
    estimateSize: useCallback(() => SEARCH_ITEM_HEIGHT, []),
    overscan: 5,
    enabled: results.length > SEARCH_VIRTUAL_THRESHOLD,
  });

  if (results.length === 0) return null;

  if (results.length <= SEARCH_VIRTUAL_THRESHOLD) {
    return (
      <div className="space-y-1" role="list" aria-label="Search results">
        {results.map((item) => (
          <SearchResultRow key={item.neuron.id} item={item} />
        ))}
      </div>
    );
  }

  return (
    <div
      ref={parentRef}
      className="overflow-auto"
      style={{ maxHeight: `${Math.min(results.length, 15) * SEARCH_ITEM_HEIGHT}px` }}
      role="list"
      aria-label="Search results"
    >
      <div style={{ height: `${virtualizer.getTotalSize()}px`, position: "relative" }}>
        {virtualizer.getVirtualItems().map((virtualRow) => (
          <div
            key={virtualRow.key}
            role="listitem"
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: `${virtualRow.size}px`,
              transform: `translateY(${virtualRow.start}px)`,
            }}
          >
            <SearchResultRow item={results[virtualRow.index]} />
          </div>
        ))}
      </div>
    </div>
  );
}

function SearchResultRow({ item }: { item: SearchResultItem }) {
  return (
    <Link
      href={`/brain/${item.neuron.brainId}/cluster/${item.neuron.clusterId}/neuron/${item.neuron.id}`}
      className="flex items-center gap-3 rounded-md px-3 py-2.5 hover:bg-accent transition-colors"
    >
      <FileText className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden="true" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="font-medium truncate">{item.neuron.title || "Untitled"}</p>
        </div>
        {(item.brainName || item.clusterName) && (
          <p className="text-[11px] text-muted-foreground/70 truncate">
            {[item.brainName, item.clusterName].filter(Boolean).join(" \u203A ")}
          </p>
        )}
        {item.highlight ? (
          <p
            className="text-xs text-muted-foreground line-clamp-2 [&_mark]:bg-yellow-200 [&_mark]:dark:bg-yellow-800 [&_mark]:rounded-sm [&_mark]:px-0.5"
            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(item.highlight, { ALLOWED_TAGS: ["mark"] }) }}
          />
        ) : (
          <p className="text-xs text-muted-foreground truncate">
            {item.neuron.contentText?.slice(0, 150) || "Empty note"}
          </p>
        )}
      </div>
    </Link>
  );
}
