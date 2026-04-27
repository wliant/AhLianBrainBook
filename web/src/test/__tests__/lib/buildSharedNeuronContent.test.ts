import { describe, it, expect } from "vitest";
import { buildSharedNeuronContent, resolveSharedTitle, type SharedFile } from "@/lib/share/buildSharedNeuronContent";
import type { SectionsDocument } from "@/types";

function parse(json: string): SectionsDocument {
  return JSON.parse(json) as SectionsDocument;
}

describe("buildSharedNeuronContent", () => {
  it("URL only -> single rich-text section with linked URL", () => {
    const out = buildSharedNeuronContent({ url: "https://example.com" });
    const doc = parse(out.contentJson);

    expect(doc.version).toBe(2);
    expect(doc.sections).toHaveLength(1);
    expect(doc.sections[0].type).toBe("rich-text");
    const para = (doc.sections[0].content as { content: unknown[] }).content[0] as {
      content: Array<{ marks: Array<{ type: string; attrs: { href: string } }>; text: string }>;
    };
    expect(para.content[0].text).toBe("https://example.com");
    expect(para.content[0].marks[0].type).toBe("link");
    expect(para.content[0].marks[0].attrs.href).toBe("https://example.com");
    expect(out.contentText).toBe("https://example.com");
  });

  it("URL + text -> link paragraph followed by text paragraph", () => {
    const out = buildSharedNeuronContent({ url: "https://example.com", text: "interesting article" });
    const doc = parse(out.contentJson);
    const tipTapDoc = doc.sections[0].content as { content: unknown[] };
    expect(tipTapDoc.content).toHaveLength(2);
    expect(out.contentText).toBe("https://example.com\ninteresting article");
  });

  it("URL == text dedupes", () => {
    const out = buildSharedNeuronContent({ url: "https://example.com", text: "https://example.com" });
    const doc = parse(out.contentJson);
    const tipTapDoc = doc.sections[0].content as { content: unknown[] };
    expect(tipTapDoc.content).toHaveLength(1);
  });

  it("image file produces image section with attachmentId + sourceType=upload", () => {
    const file: SharedFile = {
      attachmentId: "att-1",
      downloadUrl: "http://api/download/att-1",
      fileName: "photo.png",
      contentType: "image/png",
    };
    const out = buildSharedNeuronContent({ files: [file] });
    const doc = parse(out.contentJson);
    expect(doc.sections).toHaveLength(1);
    expect(doc.sections[0].type).toBe("image");
    expect(doc.sections[0].content).toMatchObject({
      src: "http://api/download/att-1",
      caption: "photo.png",
      sourceType: "upload",
      attachmentId: "att-1",
    });
    expect(out.contentText).toBe("photo.png");
  });

  it("audio file produces audio section", () => {
    const file: SharedFile = {
      attachmentId: "att-2",
      downloadUrl: "http://api/download/att-2",
      fileName: "memo.m4a",
      contentType: "audio/mp4",
    };
    const out = buildSharedNeuronContent({ files: [file] });
    const doc = parse(out.contentJson);
    expect(doc.sections[0].type).toBe("audio");
    expect(doc.sections[0].content).toMatchObject({
      src: "http://api/download/att-2",
      label: "memo.m4a",
      sourceType: "upload",
      attachmentId: "att-2",
    });
  });

  it("PDF (non-media) becomes a linked-text rich-text section", () => {
    const file: SharedFile = {
      attachmentId: "att-3",
      downloadUrl: "http://api/download/att-3",
      fileName: "spec.pdf",
      contentType: "application/pdf",
    };
    const out = buildSharedNeuronContent({ files: [file] });
    const doc = parse(out.contentJson);
    expect(doc.sections).toHaveLength(1);
    expect(doc.sections[0].type).toBe("rich-text");
    const tipTapDoc = doc.sections[0].content as { content: Array<{ content: Array<{ marks: Array<{ attrs: { href: string } }>; text: string }> }> };
    expect(tipTapDoc.content[0].content[0].text).toBe("spec.pdf");
    expect(tipTapDoc.content[0].content[0].marks[0].attrs.href).toBe("http://api/download/att-3");
  });

  it("mixed: URL + image + PDF orders intro, image, link-files", () => {
    const out = buildSharedNeuronContent({
      url: "https://example.com",
      files: [
        { attachmentId: "i", downloadUrl: "http://api/i", fileName: "img.jpg", contentType: "image/jpeg" },
        { attachmentId: "p", downloadUrl: "http://api/p", fileName: "doc.pdf", contentType: "application/pdf" },
      ],
    });
    const doc = parse(out.contentJson);
    expect(doc.sections.map((s) => s.type)).toEqual(["rich-text", "image", "rich-text"]);
    expect(doc.sections.map((s) => s.order)).toEqual([0, 1, 2]);
    expect(out.contentText).toBe("https://example.com\nimg.jpg\ndoc.pdf");
  });

  it("empty input falls back to a blank rich-text section", () => {
    const out = buildSharedNeuronContent({});
    const doc = parse(out.contentJson);
    expect(doc.sections).toHaveLength(1);
    expect(doc.sections[0].type).toBe("rich-text");
    expect(out.contentText).toBe("");
  });
});

describe("resolveSharedTitle", () => {
  it("uses explicit title when provided", () => {
    expect(resolveSharedTitle({ title: "My Article", url: "https://x.com" })).toBe("My Article");
  });

  it("falls back to URL hostname", () => {
    expect(resolveSharedTitle({ url: "https://example.com/path" })).toBe("example.com");
  });

  it("falls back to text first 80 chars when no title/url", () => {
    expect(resolveSharedTitle({ text: "hello world" })).toBe("hello world");
  });

  it("falls back to first filename when only files are present", () => {
    expect(resolveSharedTitle({ files: [{ attachmentId: "a", downloadUrl: "u", fileName: "report.pdf", contentType: "application/pdf" }] })).toBe("report.pdf");
  });

  it("falls back to a date stamp when nothing is shared", () => {
    expect(resolveSharedTitle({})).toMatch(/^Shared \d{4}-\d{2}-\d{2}$/);
  });

  it("trims and caps at 500 chars", () => {
    const long = "x".repeat(600);
    expect(resolveSharedTitle({ title: long })).toHaveLength(500);
  });
});
