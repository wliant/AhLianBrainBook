"use client";

import { useState } from "react";
import type { Editor } from "@tiptap/react";
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Code,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  ListChecks,
  Quote,
  Minus,
  Link as LinkIcon,
  Highlighter,
  Undo2,
  Redo2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import type { Neuron } from "@/types";

interface SearchResponse {
  results: Neuron[];
  totalCount: number;
}

interface ToolbarProps {
  editor: Editor | null;
}

export function Toolbar({ editor }: ToolbarProps) {
  if (!editor) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-0.5 gap-y-1 border-b pb-2 mb-4">
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBold().run()}
        active={editor.isActive("bold")}
        title="Bold"
      >
        <Bold className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleItalic().run()}
        active={editor.isActive("italic")}
        title="Italic"
      >
        <Italic className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        active={editor.isActive("underline")}
        title="Underline"
      >
        <Underline className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleStrike().run()}
        active={editor.isActive("strike")}
        title="Strikethrough"
      >
        <Strikethrough className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleCode().run()}
        active={editor.isActive("code")}
        title="Inline Code"
      >
        <Code className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHighlight().run()}
        active={editor.isActive("highlight")}
        title="Highlight"
      >
        <Highlighter className="h-4 w-4" />
      </ToolbarButton>

      <div className="hidden sm:block w-px h-6 bg-border mx-1" />

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        active={editor.isActive("heading", { level: 1 })}
        title="Heading 1"
      >
        <Heading1 className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        active={editor.isActive("heading", { level: 2 })}
        title="Heading 2"
      >
        <Heading2 className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        active={editor.isActive("heading", { level: 3 })}
        title="Heading 3"
      >
        <Heading3 className="h-4 w-4" />
      </ToolbarButton>

      <div className="hidden sm:block w-px h-6 bg-border mx-1" />

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        active={editor.isActive("bulletList")}
        title="Bullet List"
      >
        <List className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        active={editor.isActive("orderedList")}
        title="Numbered List"
      >
        <ListOrdered className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleTaskList().run()}
        active={editor.isActive("taskList")}
        title="Checklist"
      >
        <ListChecks className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        active={editor.isActive("blockquote")}
        title="Quote"
      >
        <Quote className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
        title="Divider"
      >
        <Minus className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        active={editor.isActive("codeBlock")}
        title="Code Block"
      >
        <Code className="h-4 w-4" />
      </ToolbarButton>

      <div className="hidden sm:block w-px h-6 bg-border mx-1" />

      <LinkPopover editor={editor} />

      <div className="hidden sm:block w-px h-6 bg-border mx-1" />

      <ToolbarButton
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().undo()}
        title="Undo"
      >
        <Undo2 className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().redo()}
        title="Redo"
      >
        <Redo2 className="h-4 w-4" />
      </ToolbarButton>
    </div>
  );
}

function LinkPopover({ editor }: { editor: Editor }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"url" | "neuron">("url");
  const [url, setUrl] = useState("");
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<Neuron[]>([]);
  const [searching, setSearching] = useState(false);

  const handleOpen = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) {
      const currentUrl = editor.getAttributes("link").href || "";
      setUrl(currentUrl);
      setSearch("");
      setResults([]);
      setTab(currentUrl.startsWith("/") ? "neuron" : "url");
    }
  };

  const applyLink = (href: string) => {
    editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
    setOpen(false);
  };

  const removeLink = () => {
    editor.chain().focus().extendMarkRange("link").unsetLink().run();
    setOpen(false);
  };

  const handleUrlSubmit = () => {
    if (url.trim()) applyLink(url.trim());
  };

  const handleNeuronSearch = async (query: string) => {
    setSearch(query);
    if (!query.trim()) {
      setResults([]);
      return;
    }
    setSearching(true);
    try {
      const res = await api.get<SearchResponse>(`/api/search?q=${encodeURIComponent(query)}&size=10`);
      setResults(res.results);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handleNeuronSelect = (neuron: Neuron) => {
    const href = `/brain/${neuron.brainId}/cluster/${neuron.clusterId}/neuron/${neuron.id}`;
    applyLink(href);
  };

  return (
    <Popover open={open} onOpenChange={handleOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          title="Link"
          className={cn(
            "p-2 sm:p-1.5 rounded hover:bg-accent transition-colors",
            editor.isActive("link") && "bg-accent text-primary"
          )}
        >
          <LinkIcon className="h-4 w-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[calc(100vw-2rem)] sm:w-80 p-0" align="start">
        <div className="flex border-b">
          <button
            className={cn(
              "flex-1 px-3 py-2 text-sm font-medium transition-colors",
              tab === "url" ? "border-b-2 border-primary text-primary" : "text-muted-foreground hover:text-foreground"
            )}
            onClick={() => setTab("url")}
          >
            URL
          </button>
          <button
            className={cn(
              "flex-1 px-3 py-2 text-sm font-medium transition-colors",
              tab === "neuron" ? "border-b-2 border-primary text-primary" : "text-muted-foreground hover:text-foreground"
            )}
            onClick={() => setTab("neuron")}
          >
            Neuron
          </button>
        </div>

        <div className="p-3">
          {tab === "url" ? (
            <div className="space-y-2">
              <Input
                placeholder="https://..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleUrlSubmit()}
                autoFocus
                className="h-8 text-sm"
              />
              <div className="flex gap-2">
                <Button size="sm" className="h-7 text-xs" onClick={handleUrlSubmit}>
                  Apply
                </Button>
                {editor.isActive("link") && (
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={removeLink}>
                    Remove
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <Input
                placeholder="Search neurons..."
                value={search}
                onChange={(e) => handleNeuronSearch(e.target.value)}
                autoFocus
                className="h-8 text-sm"
              />
              <div className="max-h-48 overflow-y-auto space-y-0.5">
                {searching && (
                  <p className="text-xs text-muted-foreground text-center py-2">Searching...</p>
                )}
                {!searching && results.length === 0 && search.trim() && (
                  <p className="text-xs text-muted-foreground text-center py-2">No neurons found</p>
                )}
                {results.map((neuron) => (
                  <button
                    key={neuron.id}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent transition-colors text-left"
                    onClick={() => handleNeuronSelect(neuron)}
                  >
                    <span className="truncate">{neuron.title || "Untitled"}</span>
                  </button>
                ))}
              </div>
              {editor.isActive("link") && (
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={removeLink}>
                  Remove Link
                </Button>
              )}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function ToolbarButton({
  children,
  onClick,
  active,
  disabled,
  title,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  active?: boolean;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        "p-2 sm:p-1.5 rounded hover:bg-accent transition-colors",
        active && "bg-accent text-primary",
        disabled && "opacity-30 cursor-not-allowed"
      )}
    >
      {children}
    </button>
  );
}
