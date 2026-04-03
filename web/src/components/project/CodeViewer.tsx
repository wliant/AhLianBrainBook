"use client";

import { useRef, useEffect, useCallback, useState } from "react";
import {
  EditorView,
  lineNumbers,
  highlightSpecialChars,
  drawSelection,
} from "@codemirror/view";
import { EditorState, Compartment } from "@codemirror/state";
import {
  syntaxHighlighting,
  defaultHighlightStyle,
  bracketMatching,
  foldGutter,
  LanguageSupport,
} from "@codemirror/language";
import { highlightSelectionMatches } from "@codemirror/search";
import { oneDark } from "@codemirror/theme-one-dark";
import { anchorGutter } from "./AnchorGutter";
import { CreateAnchorDialog } from "./CreateAnchorDialog";
import type { FileContent, NeuronAnchor } from "@/types";

const languageLoaders: Record<string, () => Promise<LanguageSupport>> = {
  javascript: () =>
    import("@codemirror/lang-javascript").then((m) => m.javascript()),
  typescript: () =>
    import("@codemirror/lang-javascript").then((m) =>
      m.javascript({ typescript: true })
    ),
  python: () => import("@codemirror/lang-python").then((m) => m.python()),
  java: () => import("@codemirror/lang-java").then((m) => m.java()),
  cpp: () => import("@codemirror/lang-cpp").then((m) => m.cpp()),
  c: () => import("@codemirror/lang-cpp").then((m) => m.cpp()),
  rust: () => import("@codemirror/lang-rust").then((m) => m.rust()),
  go: () => import("@codemirror/lang-go").then((m) => m.go()),
  html: () => import("@codemirror/lang-html").then((m) => m.html()),
  css: () => import("@codemirror/lang-css").then((m) => m.css()),
  json: () => import("@codemirror/lang-json").then((m) => m.json()),
  markdown: () =>
    import("@codemirror/lang-markdown").then((m) => m.markdown()),
  sql: () => import("@codemirror/lang-sql").then((m) => m.sql()),
  xml: () => import("@codemirror/lang-xml").then((m) => m.xml()),
  yaml: () => import("@codemirror/lang-yaml").then((m) => m.yaml()),
  csharp: () =>
    import("@codemirror/legacy-modes/mode/clike").then(async (m) => {
      const { StreamLanguage } = await import("@codemirror/language");
      return new LanguageSupport(StreamLanguage.define(m.csharp));
    }),
  bash: () =>
    import("@codemirror/legacy-modes/mode/shell").then(async (m) => {
      const { StreamLanguage } = await import("@codemirror/language");
      return new LanguageSupport(StreamLanguage.define(m.shell));
    }),
};

interface CodeViewerProps {
  fileContent: FileContent;
  loading: boolean;
  anchors: NeuronAnchor[];
  scrollToLine: number | null;
  clusterId: string;
  brainId: string;
}

export function CodeViewer({
  fileContent,
  loading,
  anchors,
  scrollToLine,
  clusterId,
  brainId,
}: CodeViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const languageCompartment = useRef(new Compartment());
  const gutterCompartment = useRef(new Compartment());

  const [anchorSelection, setAnchorSelection] = useState<{
    startLine: number;
    endLine: number;
  } | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Initialize editor
  useEffect(() => {
    if (!containerRef.current) return;

    const state = EditorState.create({
      doc: fileContent.content,
      extensions: [
        lineNumbers(),
        highlightSpecialChars(),
        drawSelection(),
        bracketMatching(),
        foldGutter(),
        highlightSelectionMatches(),
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
        EditorState.readOnly.of(true),
        languageCompartment.current.of([]),
        gutterCompartment.current.of(anchorGutter(anchors)),
        oneDark,
        EditorView.theme({
          "&": { fontSize: "13px", height: "100%" },
          ".cm-content": { padding: "8px 0" },
          ".cm-gutters": { border: "none" },
          ".cm-scroller": { overflow: "auto" },
          ".cm-anchor-gutter": { width: "16px" },
        }),
      ],
    });

    const view = new EditorView({
      state,
      parent: containerRef.current,
    });

    viewRef.current = view;

    // Load language
    if (fileContent.language) {
      const loader = languageLoaders[fileContent.language];
      if (loader) {
        loader().then((langSupport) => {
          view.dispatch({
            effects: languageCompartment.current.reconfigure(langSupport),
          });
        }).catch(() => {});
      }
    }

    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // Re-create editor when file content changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileContent.path, fileContent.content]);

  // Update anchor gutter when anchors change
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: gutterCompartment.current.reconfigure(anchorGutter(anchors)),
    });
  }, [anchors]);

  // Scroll to line
  useEffect(() => {
    const view = viewRef.current;
    if (!view || scrollToLine === null) return;

    const line = view.state.doc.line(
      Math.min(scrollToLine, view.state.doc.lines)
    );
    view.dispatch({
      effects: EditorView.scrollIntoView(line.from, { y: "center" }),
    });
  }, [scrollToLine]);

  // Handle line gutter click for anchor selection
  const handleContainerClick = useCallback(
    (e: React.MouseEvent) => {
      const view = viewRef.current;
      if (!view) return;

      // Check if click is on the line number gutter
      const target = e.target as HTMLElement;
      if (!target.closest(".cm-lineNumbers")) return;

      const pos = view.posAtCoords({ x: e.clientX, y: e.clientY });
      if (pos === null) return;

      const lineNumber = view.state.doc.lineAt(pos).number;

      if (e.shiftKey && anchorSelection) {
        // Shift+click: extend selection
        const start = Math.min(anchorSelection.startLine, lineNumber);
        const end = Math.max(anchorSelection.startLine, lineNumber);
        if (end - start <= 100) {
          setAnchorSelection({ startLine: start, endLine: end });
          setDialogOpen(true);
        }
      } else {
        // Single click: start selection
        setAnchorSelection({ startLine: lineNumber, endLine: lineNumber });
      }
    },
    [anchorSelection]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
        Loading file...
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* File path header */}
      <div className="px-3 py-1.5 border-b text-xs text-muted-foreground bg-muted/30 flex items-center justify-between">
        <span className="truncate">{fileContent.path}</span>
        {anchorSelection && !dialogOpen && (
          <button
            className="text-xs px-2 py-0.5 bg-primary text-primary-foreground rounded hover:bg-primary/90 ml-2 shrink-0"
            onClick={() => setDialogOpen(true)}
          >
            Create Anchor (L{anchorSelection.startLine}
            {anchorSelection.endLine !== anchorSelection.startLine
              ? `-${anchorSelection.endLine}`
              : ""}
            )
          </button>
        )}
      </div>

      {/* Editor */}
      <div
        ref={containerRef}
        className="flex-1 overflow-hidden"
        onClick={handleContainerClick}
        data-testid="code-viewer"
      />

      {/* Create Anchor Dialog */}
      {anchorSelection && (
        <CreateAnchorDialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) setAnchorSelection(null);
          }}
          clusterId={clusterId}
          brainId={brainId}
          filePath={fileContent.path}
          startLine={anchorSelection.startLine}
          endLine={anchorSelection.endLine}
        />
      )}
    </div>
  );
}
