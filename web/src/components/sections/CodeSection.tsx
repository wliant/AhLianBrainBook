"use client";

import { useState, useCallback, useRef } from "react";
import type { Section } from "@/types";
import Editor from "@monaco-editor/react";
import { GripHorizontal } from "lucide-react";

const LANGUAGES = [
  "javascript",
  "typescript",
  "python",
  "java",
  "go",
  "rust",
  "c",
  "cpp",
  "csharp",
  "html",
  "css",
  "json",
  "yaml",
  "sql",
  "bash",
  "markdown",
  "xml",
  "plaintext",
];

interface CodeSectionProps {
  section: Section;
  onUpdate: (content: Record<string, unknown>) => void;
  editing?: boolean;
}

export function CodeSection({ section, onUpdate, editing = true }: CodeSectionProps) {
  const code = (section.content.code as string) || "";
  const language = (section.content.language as string) || "javascript";
  const title = (section.content.title as string) || "";
  const [lang, setLang] = useState(language);
  const [editorHeight, setEditorHeight] = useState(200);
  const dragRef = useRef<{ startY: number; startHeight: number } | null>(null);

  const handleCodeChange = useCallback(
    (value: string | undefined) => {
      onUpdate({ code: value || "", language: lang, title });
    },
    [onUpdate, lang, title]
  );

  const handleLanguageChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const newLang = e.target.value;
      setLang(newLang);
      onUpdate({ code, language: newLang, title });
    },
    [onUpdate, code, title]
  );

  const handleTitleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onUpdate({ code, language: lang, title: e.target.value });
    },
    [onUpdate, code, lang]
  );

  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      dragRef.current = { startY: e.clientY, startHeight: editorHeight };
      const onMouseMove = (ev: MouseEvent) => {
        if (!dragRef.current) return;
        const newHeight = Math.max(80, dragRef.current.startHeight + ev.clientY - dragRef.current.startY);
        setEditorHeight(newHeight);
      };
      const onMouseUp = () => {
        dragRef.current = null;
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
      };
      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    },
    [editorHeight]
  );

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 border-b">
        {editing ? (
          <>
            <select
              value={lang}
              onChange={handleLanguageChange}
              className="text-xs bg-transparent border rounded px-1.5 py-0.5 outline-none"
            >
              {LANGUAGES.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={title}
              onChange={handleTitleChange}
              placeholder="Section title..."
              className="flex-1 text-xs bg-transparent outline-none text-muted-foreground placeholder:text-muted-foreground/50"
            />
          </>
        ) : (
          <>
            <span className="text-xs text-muted-foreground font-medium">{lang}</span>
            {title && <span className="text-xs text-muted-foreground ml-1">{title}</span>}
          </>
        )}
      </div>
      <Editor
        height={editing ? `${editorHeight}px` : `${Math.max(40, (code.split("\n").length) * 20 + 16)}px`}
        language={lang}
        value={code}
        onChange={handleCodeChange}
        theme="vs-dark"
        options={{
          minimap: { enabled: false },
          fontSize: 13,
          lineNumbers: "on",
          scrollBeyondLastLine: false,
          padding: { top: 8 },
          automaticLayout: true,
          readOnly: !editing,
          domReadOnly: !editing,
          ...(editing ? {} : { scrollbar: { vertical: "hidden", horizontal: "hidden" } }),
        }}
      />
      {editing && (
        <div
          onMouseDown={handleResizeStart}
          className="flex items-center justify-center h-3 bg-muted/50 cursor-row-resize hover:bg-muted transition-colors border-t"
        >
          <GripHorizontal className="h-3 w-3 text-muted-foreground" />
        </div>
      )}
    </div>
  );
}
