"use client";

import { useRef, useEffect, useCallback } from "react";
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightSpecialChars, drawSelection } from "@codemirror/view";
import { EditorState, Compartment } from "@codemirror/state";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { syntaxHighlighting, defaultHighlightStyle, bracketMatching, foldGutter, indentOnInput, LanguageSupport } from "@codemirror/language";
import { closeBrackets, closeBracketsKeymap } from "@codemirror/autocomplete";
import { highlightSelectionMatches, searchKeymap } from "@codemirror/search";
import { oneDark } from "@codemirror/theme-one-dark";

// Lazy-load language support
const languageLoaders: Record<string, () => Promise<LanguageSupport>> = {
  javascript: () => import("@codemirror/lang-javascript").then(m => m.javascript()),
  typescript: () => import("@codemirror/lang-javascript").then(m => m.javascript({ typescript: true })),
  python: () => import("@codemirror/lang-python").then(m => m.python()),
  java: () => import("@codemirror/lang-java").then(m => m.java()),
  cpp: () => import("@codemirror/lang-cpp").then(m => m.cpp()),
  c: () => import("@codemirror/lang-cpp").then(m => m.cpp()),
  rust: () => import("@codemirror/lang-rust").then(m => m.rust()),
  go: () => import("@codemirror/lang-go").then(m => m.go()),
  html: () => import("@codemirror/lang-html").then(m => m.html()),
  css: () => import("@codemirror/lang-css").then(m => m.css()),
  json: () => import("@codemirror/lang-json").then(m => m.json()),
  markdown: () => import("@codemirror/lang-markdown").then(m => m.markdown()),
  sql: () => import("@codemirror/lang-sql").then(m => m.sql()),
  xml: () => import("@codemirror/lang-xml").then(m => m.xml()),
  yaml: () => import("@codemirror/lang-yaml").then(m => m.yaml()),
  // Languages using StreamLanguage from legacy modes
  csharp: () => import("@codemirror/legacy-modes/mode/clike").then(async (m) => {
    const { StreamLanguage } = await import("@codemirror/language");
    return new LanguageSupport(StreamLanguage.define(m.csharp));
  }),
  bash: () => import("@codemirror/legacy-modes/mode/shell").then(async (m) => {
    const { StreamLanguage } = await import("@codemirror/language");
    return new LanguageSupport(StreamLanguage.define(m.shell));
  }),
};

interface CodeMirrorEditorProps {
  value: string;
  onChange?: (value: string) => void;
  language: string;
  readOnly?: boolean;
  height: string;
  darkMode?: boolean;
}

export function CodeMirrorEditor({ value, onChange, language, readOnly = false, height, darkMode = true }: CodeMirrorEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const languageCompartment = useRef(new Compartment());
  const readOnlyCompartment = useRef(new Compartment());
  const themeCompartment = useRef(new Compartment());
  const isExternalUpdate = useRef(false);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Initialize editor
  useEffect(() => {
    if (!containerRef.current) return;

    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged && !isExternalUpdate.current) {
        onChangeRef.current?.(update.state.doc.toString());
      }
    });

    const state = EditorState.create({
      doc: value,
      extensions: [
        lineNumbers(),
        highlightActiveLine(),
        highlightSpecialChars(),
        drawSelection(),
        history(),
        bracketMatching(),
        closeBrackets(),
        indentOnInput(),
        foldGutter(),
        highlightSelectionMatches(),
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
        keymap.of([
          ...defaultKeymap,
          ...historyKeymap,
          ...closeBracketsKeymap,
          ...searchKeymap,
          indentWithTab,
        ]),
        languageCompartment.current.of([]),
        readOnlyCompartment.current.of(EditorState.readOnly.of(readOnly)),
        themeCompartment.current.of(darkMode ? oneDark : []),
        updateListener,
        EditorView.theme({
          "&": { fontSize: "13px" },
          ".cm-content": { padding: "8px 0" },
          ".cm-gutters": { border: "none" },
        }),
      ],
    });

    const view = new EditorView({
      state,
      parent: containerRef.current,
    });

    viewRef.current = view;

    // Load language support
    loadLanguage(language);

    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadLanguage = useCallback(async (lang: string) => {
    const view = viewRef.current;
    if (!view) return;

    const loader = languageLoaders[lang];
    if (loader) {
      try {
        const langSupport = await loader();
        view.dispatch({
          effects: languageCompartment.current.reconfigure(langSupport),
        });
      } catch {
        // Fall back to no language support
        view.dispatch({
          effects: languageCompartment.current.reconfigure([]),
        });
      }
    } else {
      view.dispatch({
        effects: languageCompartment.current.reconfigure([]),
      });
    }
  }, []);

  // Update language when prop changes
  useEffect(() => {
    loadLanguage(language);
  }, [language, loadLanguage]);

  // Update value when prop changes
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const currentValue = view.state.doc.toString();
    if (value !== currentValue) {
      isExternalUpdate.current = true;
      view.dispatch({
        changes: { from: 0, to: currentValue.length, insert: value },
      });
      isExternalUpdate.current = false;
    }
  }, [value]);

  // Update readOnly when prop changes
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: readOnlyCompartment.current.reconfigure(EditorState.readOnly.of(readOnly)),
    });
  }, [readOnly]);

  // Update theme when prop changes
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: themeCompartment.current.reconfigure(darkMode ? oneDark : []),
    });
  }, [darkMode]);

  return (
    <div
      ref={containerRef}
      style={{ height }}
      className="overflow-auto"
      data-testid="codemirror-editor"
    />
  );
}
