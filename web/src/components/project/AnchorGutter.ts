import { gutter, GutterMarker } from "@codemirror/view";
import type { Extension } from "@codemirror/state";
import type { NeuronAnchor } from "@/types";

class AnchorMarker extends GutterMarker {
  private status: string;

  constructor(status: string) {
    super();
    this.status = status;
  }

  toDOM() {
    const dot = document.createElement("div");
    dot.style.width = "8px";
    dot.style.height = "8px";
    dot.style.borderRadius = "50%";
    dot.style.margin = "4px auto";
    dot.style.cursor = "pointer";

    switch (this.status) {
      case "active":
        dot.style.backgroundColor = "#22c55e"; // green-500
        break;
      case "drifted":
        dot.style.backgroundColor = "#eab308"; // yellow-500
        break;
      case "orphaned":
        dot.style.backgroundColor = "#ef4444"; // red-500
        break;
      default:
        dot.style.backgroundColor = "#22c55e";
    }

    return dot;
  }
}

export function anchorGutter(
  anchors: NeuronAnchor[],
  onAnchorClick?: (anchor: NeuronAnchor) => void
): Extension {
  // Build a map of line number -> anchor marker
  const lineMarkers = new Map<number, AnchorMarker>();

  for (const anchor of anchors) {
    // Only mark the start line of each anchor range
    const marker = new AnchorMarker(anchor.status);
    lineMarkers.set(anchor.startLine, marker);
  }

  return gutter({
    class: "cm-anchor-gutter",
    lineMarker(view, line) {
      const lineNumber = view.state.doc.lineAt(line.from).number;
      return lineMarkers.get(lineNumber) ?? null;
    },
    domEventHandlers: {
      click(view, line) {
        const lineNumber = view.state.doc.lineAt(line.from).number;
        const anchor = anchors.find(
          (a) => lineNumber >= a.startLine && lineNumber <= a.endLine
        );
        if (anchor && onAnchorClick) {
          onAnchorClick(anchor);
        }
        return false;
      },
    },
  });
}
