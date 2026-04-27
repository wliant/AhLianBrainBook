import type { Section, SectionsDocument } from "@/types";

export interface SharedFile {
  attachmentId: string;
  downloadUrl: string;
  fileName: string;
  contentType: string;
}

export interface BuildSharedNeuronInput {
  url?: string;
  text?: string;
  files?: SharedFile[];
}

export interface BuildSharedNeuronOutput {
  contentJson: string;
  contentText: string;
}

function uuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function richTextSection(order: number, content: Record<string, unknown>): Section {
  return { id: uuid(), type: "rich-text", order, content, meta: {} };
}

function imageSection(order: number, file: SharedFile): Section {
  return {
    id: uuid(),
    type: "image",
    order,
    content: {
      src: file.downloadUrl,
      caption: file.fileName,
      sourceType: "upload",
      attachmentId: file.attachmentId,
    },
    meta: {},
  };
}

function audioSection(order: number, file: SharedFile): Section {
  return {
    id: uuid(),
    type: "audio",
    order,
    content: {
      src: file.downloadUrl,
      label: file.fileName,
      sourceType: "upload",
      attachmentId: file.attachmentId,
    },
    meta: {},
  };
}

function linkParagraph(href: string, label: string): Record<string, unknown> {
  return {
    type: "paragraph",
    content: [
      {
        type: "text",
        text: label,
        marks: [{ type: "link", attrs: { href, target: "_blank" } }],
      },
    ],
  };
}

function plainParagraph(text: string): Record<string, unknown> {
  return { type: "paragraph", content: [{ type: "text", text }] };
}

export function buildSharedNeuronContent({
  url,
  text,
  files = [],
}: BuildSharedNeuronInput): BuildSharedNeuronOutput {
  const sections: Section[] = [];
  const introNodes: Record<string, unknown>[] = [];

  if (url) {
    introNodes.push(linkParagraph(url, url));
  }
  if (text && text !== url) {
    introNodes.push(plainParagraph(text));
  }
  // Files that aren't image/audio become a linked paragraph appended to the intro section.
  const linkFiles: SharedFile[] = [];

  let order = 0;
  if (introNodes.length > 0) {
    sections.push(richTextSection(order++, { type: "doc", content: introNodes }));
  }

  for (const file of files) {
    const ct = (file.contentType || "").toLowerCase();
    if (ct.startsWith("image/")) {
      sections.push(imageSection(order++, file));
    } else if (ct.startsWith("audio/")) {
      sections.push(audioSection(order++, file));
    } else {
      linkFiles.push(file);
    }
  }

  if (linkFiles.length > 0) {
    const nodes = linkFiles.map((f) => linkParagraph(f.downloadUrl, f.fileName));
    sections.push(richTextSection(order++, { type: "doc", content: nodes }));
  }

  if (sections.length === 0) {
    sections.push(richTextSection(0, { type: "doc", content: [{ type: "paragraph" }] }));
  }

  const doc: SectionsDocument = { version: 2, sections };
  const contentText = [url, text, ...files.map((f) => f.fileName)].filter(Boolean).join("\n");
  return { contentJson: JSON.stringify(doc), contentText };
}

export function resolveSharedTitle({
  title,
  url,
  text,
  files = [],
}: {
  title?: string;
  url?: string;
  text?: string;
  files?: SharedFile[];
}): string {
  if (title && title.trim()) return title.trim().slice(0, 500);
  if (url) {
    try {
      return new URL(url).hostname || url;
    } catch {
      return url.slice(0, 500);
    }
  }
  if (text && text.trim()) return text.trim().slice(0, 80);
  if (files.length > 0) return files[0].fileName.slice(0, 500);
  return `Shared ${new Date().toISOString().slice(0, 10)}`;
}
