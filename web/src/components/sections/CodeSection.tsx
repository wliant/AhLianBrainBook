"use client";

import { useState, useCallback } from "react";
import type { Section } from "@/types";
import Editor from "@monaco-editor/react";

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
  const [lang, setLang] = useState(language);

  const handleCodeChange = useCallback(
    (value: string | undefined) => {
      onUpdate({ code: value || "", language: lang });
    },
    [onUpdate, lang]
  );

  const handleLanguageChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const newLang = e.target.value;
      setLang(newLang);
      onUpdate({ code, language: newLang });
    },
    [onUpdate, code]
  );

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 border-b">
        {editing ? (
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
        ) : (
          <span className="text-xs text-muted-foreground font-medium">{lang}</span>
        )}
      </div>
      <Editor
        height={editing ? "200px" : `${Math.max(40, (code.split("\n").length) * 20 + 16)}px`}
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
    </div>
  );
}
