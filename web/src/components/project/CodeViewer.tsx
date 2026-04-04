"use client";

import { useRef, useEffect } from "react";
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
import { blameGutter } from "./BlameGutter";
import { goToDefinitionExtension, type GoToDefinitionHandler } from "./GoToDefinition";
import type { FileContent, BlameLine } from "@/types";

export interface CodeSelection {
  code: string;
  startLine: number;
  endLine: number;
}

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
  scrollToLine: number | null;
  scrollKey: number;
  onGoToDefinition?: GoToDefinitionHandler;
  blameData?: BlameLine[] | null;
  onCodeSelection?: (selection: CodeSelection | null) => void;
}

export function CodeViewer({
  fileContent,
  scrollToLine,
  scrollKey,
  onGoToDefinition,
  blameData,
  onCodeSelection,
}: CodeViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const languageCompartment = useRef(new Compartment());
  const gutterCompartment = useRef(new Compartment());
  const blameCompartment = useRef(new Compartment());
  const goToDefCompartment = useRef(new Compartment());
  const selectionHighlightCompartment = useRef(new Compartment());
  const onGoToDefinitionRef = useRef(onGoToDefinition);
  onGoToDefinitionRef.current = onGoToDefinition;

  const onCodeSelectionRef = useRef(onCodeSelection);
  onCodeSelectionRef.current = onCodeSelection;

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
        gutterCompartment.current.of([]),
        blameCompartment.current.of(blameData ? blameGutter(blameData) : []),
        goToDefCompartment.current.of(
          onGoToDefinitionRef.current
            ? goToDefinitionExtension((line, col) => onGoToDefinitionRef.current?.(line, col))
            : []
        ),
        selectionHighlightCompartment.current.of([]),
        oneDark,
        EditorView.theme({
          "&": { fontSize: "13px", height: "100%" },
          ".cm-content": { padding: "8px 0" },
          ".cm-gutters": { border: "none" },
          ".cm-scroller": { overflow: "auto" },
          ".cm-anchor-gutter": { width: "16px" },
          ".cm-blame-gutter": { width: "180px", fontSize: "11px" },
          ".cm-anchor-selection": { backgroundColor: "rgba(59, 130, 246, 0.15)" },
        }),
      ],
    });

    const view = new EditorView({
      state,
      parent: containerRef.current,
    });

    viewRef.current = view;
    let destroyed = false;

    // Load language
    if (fileContent.language) {
      const loader = languageLoaders[fileContent.language];
      if (loader) {
        loader().then((langSupport) => {
          if (!destroyed) {
            view.dispatch({
              effects: languageCompartment.current.reconfigure(langSupport),
            });
          }
        }).catch(() => {});
      }
    }

    return () => {
      destroyed = true;
      view.destroy();
      viewRef.current = null;
    };
    // Re-create editor when file content changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileContent.path, fileContent.content]);

  // Update blame gutter when blame data changes
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: blameCompartment.current.reconfigure(blameData ? blameGutter(blameData) : []),
    });
  }, [blameData]);

  // Update go-to-definition extension when handler availability changes
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: goToDefCompartment.current.reconfigure(
        onGoToDefinition
          ? goToDefinitionExtension((line, col) => onGoToDefinitionRef.current?.(line, col))
          : []
      ),
    });
  }, [onGoToDefinition]);

  // Scroll to line (scrollKey ensures re-trigger for same line)
  useEffect(() => {
    const view = viewRef.current;
    if (!view || scrollToLine === null) return;

    const line = view.state.doc.line(
      Math.min(scrollToLine, view.state.doc.lines)
    );
    view.dispatch({
      effects: EditorView.scrollIntoView(line.from, { y: "center" }),
    });
  }, [scrollToLine, scrollKey]);

  // Notify parent of text selection changes
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    const listener = EditorView.updateListener.of((update) => {
      if (!update.selectionSet) return;
      const sel = update.state.selection.main;
      if (sel.empty) {
        onCodeSelectionRef.current?.(null);
        return;
      }
      const startLine = update.state.doc.lineAt(sel.from);
      const endLine = update.state.doc.lineAt(sel.to);
      // Extract full lines
      const lines: string[] = [];
      for (let i = startLine.number; i <= endLine.number; i++) {
        lines.push(update.state.doc.line(i).text);
      }
      onCodeSelectionRef.current?.({
        code: lines.join("\n"),
        startLine: startLine.number,
        endLine: endLine.number,
      });
    });

    view.dispatch({
      effects: selectionHighlightCompartment.current.reconfigure(listener),
    });

    return () => {
      if (viewRef.current) {
        viewRef.current.dispatch({
          effects: selectionHighlightCompartment.current.reconfigure([]),
        });
      }
    };
  }, [fileContent.path]);

  return (
    <div className="flex flex-col h-full">
      {/* File path header */}
      <div className="px-3 py-1.5 border-b text-xs text-muted-foreground bg-muted/30">
        <span className="truncate">{fileContent.path}</span>
      </div>

      {/* Editor */}
      <div
        ref={containerRef}
        className="flex-1 overflow-hidden"
        data-testid="code-viewer"
      />
    </div>
  );
}
