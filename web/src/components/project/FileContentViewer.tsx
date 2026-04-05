"use client";

import { useState, useEffect } from "react";
import { Eye, Code } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { CodeViewer } from "./CodeViewer";
import { ImageViewer } from "./ImageViewer";
import type { GoToDefinitionHandler } from "./GoToDefinition";
import type { CodeSelection } from "./CodeViewer";
import type { FileContent, BlameLine } from "@/types";

interface FileContentViewerProps {
  fileContent: FileContent;
  scrollToLine: number | null;
  scrollKey: number;
  onGoToDefinition?: GoToDefinitionHandler;
  blameData?: BlameLine[] | null;
  onCodeSelection?: (selection: CodeSelection | null) => void;
}

function isMarkdown(fc: FileContent): boolean {
  return fc.language === "markdown" || fc.path.endsWith(".md");
}

function isImage(fc: FileContent): boolean {
  return fc.language === "image";
}

export function FileContentViewer({
  fileContent,
  scrollToLine,
  scrollKey,
  onGoToDefinition,
  blameData,
  onCodeSelection,
}: FileContentViewerProps) {
  const [viewMode, setViewMode] = useState<"rendered" | "source">("rendered");

  // Reset to rendered when switching files
  useEffect(() => {
    setViewMode("rendered");
  }, [fileContent.path]);

  // Image files
  if (isImage(fileContent)) {
    return <ImageViewer fileContent={fileContent} />;
  }

  // Markdown files — show toggle header
  if (isMarkdown(fileContent)) {
    return (
      <div className="flex flex-col h-full">
        {/* Header with view mode toggle */}
        <div className="flex items-center px-3 py-1 border-b bg-muted/30 gap-1">
          <span className="text-xs text-muted-foreground truncate flex-1">
            {fileContent.path}
          </span>
          <button
            className={`p-1 rounded-sm transition-colors ${
              viewMode === "rendered"
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-accent/50"
            }`}
            onClick={() => setViewMode("rendered")}
            title="Rendered view"
          >
            <Eye className="h-3.5 w-3.5" />
          </button>
          <button
            className={`p-1 rounded-sm transition-colors ${
              viewMode === "source"
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-accent/50"
            }`}
            onClick={() => setViewMode("source")}
            title="Source view"
          >
            <Code className="h-3.5 w-3.5" />
          </button>
        </div>

        {viewMode === "rendered" ? (
          <div className="flex-1 overflow-auto p-6">
            <div className="prose prose-invert max-w-none prose-headings:border-b prose-headings:pb-2 prose-img:rounded-md prose-pre:bg-[#282c34]">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {fileContent.content}
              </ReactMarkdown>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-hidden">
            <CodeViewer
              fileContent={fileContent}
              scrollToLine={scrollToLine}
              scrollKey={scrollKey}
              onGoToDefinition={onGoToDefinition}
              blameData={blameData}
              onCodeSelection={onCodeSelection}
              hideHeader
            />
          </div>
        )}
      </div>
    );
  }

  // Default: CodeViewer for all other files
  return (
    <CodeViewer
      fileContent={fileContent}
      scrollToLine={scrollToLine}
      scrollKey={scrollKey}
      onGoToDefinition={onGoToDefinition}
      blameData={blameData}
      onCodeSelection={onCodeSelection}
    />
  );
}
