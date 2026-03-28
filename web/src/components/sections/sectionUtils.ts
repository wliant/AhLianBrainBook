import type { Section, SectionsDocument, SectionType } from "@/types";

export function normalizeContent(
  raw: Record<string, unknown> | null
): SectionsDocument {
  if (!raw) {
    return {
      version: 2,
      sections: [createSection("rich-text", 0)],
    };
  }
  if (raw.version === 2 && Array.isArray(raw.sections)) {
    return raw as unknown as SectionsDocument;
  }
  // Legacy TipTap format: top-level { type: "doc", content: [...] }
  if (raw.type === "doc") {
    return {
      version: 2,
      sections: [
        {
          id: crypto.randomUUID(),
          type: "rich-text",
          order: 0,
          content: raw,
          meta: {},
        },
      ],
    };
  }
  return { version: 2, sections: [] };
}

export function createSection(type: SectionType, order: number): Section {
  const defaults: Record<SectionType, Record<string, unknown>> = {
    "rich-text": { type: "doc", content: [{ type: "paragraph" }] },
    code: { code: "", language: "javascript" },
    math: { latex: "", displayMode: true },
    diagram: { source: "", diagramType: "mermaid" },
    callout: { variant: "info", text: "" },
    divider: {},
    image: { src: "", caption: "" },
    table: { headers: ["Column 1", "Column 2", "Column 3"], rows: [["", "", ""]] },
  };
  return {
    id: crypto.randomUUID(),
    type,
    order,
    content: defaults[type],
    meta: {},
  };
}

export function extractPlainText(sections: Section[]): string {
  return sections
    .map((s) => extractSectionText(s))
    .filter(Boolean)
    .join("\n");
}

function extractSectionText(section: Section): string {
  switch (section.type) {
    case "rich-text":
      // Text is extracted by the TipTap editor via onUpdate callback
      // This fallback extracts from the JSON structure
      return extractTiptapText(section.content);
    case "code":
      return (section.content.code as string) || "";
    case "math":
      return (section.content.latex as string) || "";
    case "diagram":
      return (section.content.source as string) || "";
    case "callout":
      return (section.content.text as string) || "";
    case "divider":
      return "";
    case "image":
      return (section.content.caption as string) || "";
    case "table": {
      const headers = (section.content.headers as string[]) || [];
      const rows = (section.content.rows as string[][]) || [];
      return [...headers, ...rows.flat()].filter(Boolean).join(" ");
    }
    default:
      return "";
  }
}

function extractTiptapText(content: Record<string, unknown>): string {
  if (!content) return "";
  const items = content.content as Array<Record<string, unknown>> | undefined;
  if (!items) return "";
  return items
    .map((node) => {
      if (node.text) return node.text as string;
      if (node.content) return extractTiptapText(node as Record<string, unknown>);
      return "";
    })
    .join(" ");
}
