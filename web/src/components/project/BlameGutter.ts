import { gutter, GutterMarker } from "@codemirror/view";
import type { Extension } from "@codemirror/state";
import type { BlameLine } from "@/types";

function relativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const diffMs = Date.now() - date.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d`;
  const months = Math.floor(days / 30);
  return `${months}mo`;
}

class BlameMarker extends GutterMarker {
  private sha: string;
  private author: string;
  private date: string;

  constructor(sha: string, author: string, date: string) {
    super();
    this.sha = sha;
    this.author = author;
    this.date = date;
  }

  toDOM() {
    const el = document.createElement("div");
    el.style.display = "flex";
    el.style.gap = "6px";
    el.style.paddingRight = "8px";
    el.style.whiteSpace = "nowrap";
    el.style.overflow = "hidden";

    const shaSpan = document.createElement("span");
    shaSpan.textContent = this.sha.substring(0, 7);
    shaSpan.style.color = "#6b7280";
    shaSpan.style.fontFamily = "monospace";

    const authorSpan = document.createElement("span");
    const authorText = this.author.length > 12 ? this.author.substring(0, 11) + "\u2026" : this.author;
    authorSpan.textContent = authorText;
    authorSpan.style.color = "#9ca3af";

    const dateSpan = document.createElement("span");
    dateSpan.textContent = relativeDate(this.date);
    dateSpan.style.color = "#6b7280";
    dateSpan.style.marginLeft = "auto";

    el.appendChild(shaSpan);
    el.appendChild(authorSpan);
    el.appendChild(dateSpan);

    return el;
  }
}

export function blameGutter(blameData: BlameLine[]): Extension {
  const lineMarkers = new Map<number, BlameMarker>();

  for (const blame of blameData) {
    lineMarkers.set(blame.line, new BlameMarker(blame.commitSha, blame.author, blame.date));
  }

  return gutter({
    class: "cm-blame-gutter",
    lineMarker(view, line) {
      const lineNumber = view.state.doc.lineAt(line.from).number;
      return lineMarkers.get(lineNumber) ?? null;
    },
  });
}
