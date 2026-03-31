import type { Section, SectionsDocument, SectionType } from "@/types";

function generateUUID(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Fallback for non-secure contexts using crypto.getRandomValues
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
    bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 1
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
  // Last resort fallback
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

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
          id: generateUUID(),
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
    image: { src: "", caption: "", sourceType: "url" },
    table: { headers: ["Column 1", "Column 2", "Column 3"], rows: [["", "", ""]] },
    audio: { src: "", label: "", sourceType: "upload" },
  };
  return {
    id: generateUUID(),
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
    case "audio":
      return (section.content.label as string) || "";
    case "table": {
      const headers = (section.content.headers as string[]) || [];
      const rows = (section.content.rows as string[][]) || [];
      return [...headers, ...rows.flat()].filter(Boolean).join(" ");
    }
    default:
      return "";
  }
}

export function extractTiptapText(content: Record<string, unknown>): string {
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
