import { EditorView } from "@codemirror/view";
import type { Extension } from "@codemirror/state";

export type GoToDefinitionHandler = (line: number, col: number) => void;

export function goToDefinitionExtension(
  handler: GoToDefinitionHandler
): Extension {
  return EditorView.domEventHandlers({
    mousedown(event, view) {
      if (!(event.ctrlKey || event.metaKey)) return false;

      const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
      if (pos === null) return false;

      const line = view.state.doc.lineAt(pos);
      const lineNumber = line.number;
      const col = pos - line.from;

      event.preventDefault();
      handler(lineNumber, col);
      return true;
    },
  });
}
