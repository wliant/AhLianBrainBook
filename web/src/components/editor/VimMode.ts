import { Extension } from "@tiptap/core";
import { Plugin, PluginKey, TextSelection, type EditorState } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

type VimModeState = "NORMAL" | "INSERT";

const vimPluginKey = new PluginKey("vimMode");

function resolvePos(state: EditorState, pos: number) {
  return Math.max(0, Math.min(pos, state.doc.content.size));
}

function moveCursor(state: EditorState, offset: number) {
  const { from } = state.selection;
  const newPos = resolvePos(state, from + offset);
  return TextSelection.create(state.doc, newPos);
}

function moveToLineStart(state: EditorState) {
  const { $from } = state.selection;
  return TextSelection.create(state.doc, $from.start());
}

function moveToLineEnd(state: EditorState) {
  const { $from } = state.selection;
  return TextSelection.create(state.doc, $from.end());
}

function moveByWord(state: EditorState, forward: boolean) {
  const { from } = state.selection;
  const text = state.doc.textBetween(0, state.doc.content.size, "\n", "\0");

  if (forward) {
    const afterCursor = text.slice(from);
    const match = afterCursor.match(/^\S*\s+\S?/);
    const offset = match ? match[0].length - (match[0].endsWith(" ") ? 0 : 1) : 1;
    return TextSelection.create(state.doc, resolvePos(state, from + Math.max(offset, 1)));
  } else {
    const beforeCursor = text.slice(0, from);
    const match = beforeCursor.match(/\S+\s*$/);
    const offset = match ? match[0].length : 1;
    return TextSelection.create(state.doc, resolvePos(state, from - offset));
  }
}

/**
 * Move cursor to the next or previous block node (simulates j/k vertical movement).
 * In ProseMirror, vertical movement is done by traversing block boundaries.
 */
function moveToAdjacentBlock(state: EditorState, direction: "down" | "up") {
  const { $from } = state.selection;

  if (direction === "down") {
    const after = $from.after();
    if (after < state.doc.content.size) {
      const resolved = state.doc.resolve(Math.min(after + 1, state.doc.content.size));
      return TextSelection.near(resolved);
    }
  } else {
    const before = $from.before();
    if (before > 0) {
      const resolved = state.doc.resolve(Math.max(before - 1, 0));
      return TextSelection.near(resolved);
    }
  }
  return null;
}

export const VimMode = Extension.create({
  name: "vimMode",

  addProseMirrorPlugins() {
    // Closure state for multi-key commands and yank buffer.
    // These reset when the editor is destroyed/recreated (acceptable behavior).
    let pendingKey: string | null = null;
    let yankBuffer = "";

    return [
      new Plugin({
        key: vimPluginKey,

        state: {
          init(): VimModeState {
            return "NORMAL";
          },
          apply(tr, value): VimModeState {
            const newMode = tr.getMeta(vimPluginKey);
            return newMode !== undefined ? newMode : value;
          },
        },

        props: {
          decorations(state) {
            const mode = vimPluginKey.getState(state) as VimModeState;
            if (!mode || mode === "INSERT") return DecorationSet.empty;

            const widget = Decoration.widget(0, () => {
              const el = document.createElement("div");
              el.className = "vim-mode-indicator";
              el.style.cssText =
                "position:fixed;bottom:8px;left:50%;transform:translateX(-50%);z-index:50;" +
                "padding:2px 12px;border-radius:4px;font-size:11px;font-family:monospace;font-weight:600;" +
                "pointer-events:none;letter-spacing:0.05em;background:#3b82f6;color:white;";
              el.textContent = "-- NORMAL --";
              return el;
            }, { side: -1, key: "vim-mode-widget" });

            return DecorationSet.create(state.doc, [widget]);
          },

          handleKeyDown(view, event) {
            const mode = vimPluginKey.getState(view.state) as VimModeState;

            // INSERT mode: only intercept Escape
            if (mode === "INSERT") {
              if (event.key === "Escape") {
                event.preventDefault();
                view.dispatch(view.state.tr.setMeta(vimPluginKey, "NORMAL"));
                return true;
              }
              return false;
            }

            // NORMAL mode
            if (mode === "NORMAL") {
              const { state } = view;
              const { dispatch } = view;

              // Handle pending two-key commands (dd, yy)
              if (pendingKey) {
                const combo = pendingKey + event.key;
                pendingKey = null;

                if (combo === "dd") {
                  event.preventDefault();
                  const { $from } = state.selection;
                  const lineStart = $from.start();
                  const lineEnd = $from.end();
                  const from = Math.max(lineStart - 1, 0);
                  const to = Math.min(lineEnd + 1, state.doc.content.size);
                  yankBuffer = state.doc.textBetween(lineStart, lineEnd);
                  dispatch(state.tr.delete(from, to));
                  return true;
                }

                if (combo === "yy") {
                  event.preventDefault();
                  const { $from } = state.selection;
                  yankBuffer = state.doc.textBetween($from.start(), $from.end());
                  return true;
                }

                return false;
              }

              // Single-key commands
              switch (event.key) {
                case "h": {
                  event.preventDefault();
                  dispatch(state.tr.setSelection(moveCursor(state, -1)));
                  return true;
                }
                case "l": {
                  event.preventDefault();
                  dispatch(state.tr.setSelection(moveCursor(state, 1)));
                  return true;
                }
                case "j": {
                  event.preventDefault();
                  const sel = moveToAdjacentBlock(state, "down");
                  if (sel) dispatch(state.tr.setSelection(sel));
                  return true;
                }
                case "k": {
                  event.preventDefault();
                  const sel = moveToAdjacentBlock(state, "up");
                  if (sel) dispatch(state.tr.setSelection(sel));
                  return true;
                }
                case "w": {
                  event.preventDefault();
                  dispatch(state.tr.setSelection(moveByWord(state, true)));
                  return true;
                }
                case "b": {
                  event.preventDefault();
                  dispatch(state.tr.setSelection(moveByWord(state, false)));
                  return true;
                }
                case "e": {
                  event.preventDefault();
                  dispatch(state.tr.setSelection(moveByWord(state, true)));
                  return true;
                }
                case "0": {
                  event.preventDefault();
                  dispatch(state.tr.setSelection(moveToLineStart(state)));
                  return true;
                }
                case "$": {
                  event.preventDefault();
                  dispatch(state.tr.setSelection(moveToLineEnd(state)));
                  return true;
                }
                case "i": {
                  event.preventDefault();
                  dispatch(state.tr.setMeta(vimPluginKey, "INSERT"));
                  return true;
                }
                case "a": {
                  event.preventDefault();
                  dispatch(
                    state.tr
                      .setSelection(moveCursor(state, 1))
                      .setMeta(vimPluginKey, "INSERT")
                  );
                  return true;
                }
                case "A": {
                  event.preventDefault();
                  dispatch(
                    state.tr
                      .setSelection(moveToLineEnd(state))
                      .setMeta(vimPluginKey, "INSERT")
                  );
                  return true;
                }
                case "o": {
                  event.preventDefault();
                  const { $from: $o } = state.selection;
                  const endOfLine = $o.end();
                  const tr = state.tr.split(endOfLine);
                  tr.setMeta(vimPluginKey, "INSERT");
                  dispatch(tr);
                  return true;
                }
                case "O": {
                  event.preventDefault();
                  const { $from: $O } = state.selection;
                  const startOfLine = $O.start();
                  const tr = state.tr.split(startOfLine);
                  tr.setSelection(TextSelection.create(tr.doc, startOfLine));
                  tr.setMeta(vimPluginKey, "INSERT");
                  dispatch(tr);
                  return true;
                }
                case "d": {
                  pendingKey = "d";
                  event.preventDefault();
                  return true;
                }
                case "y": {
                  pendingKey = "y";
                  event.preventDefault();
                  return true;
                }
                case "p": {
                  event.preventDefault();
                  if (yankBuffer) {
                    const { $from } = state.selection;
                    const insertPos = $from.end();
                    const tr = state.tr.split(insertPos);
                    tr.insertText(yankBuffer, insertPos + 1);
                    dispatch(tr);
                  }
                  return true;
                }
                case "Escape": {
                  event.preventDefault();
                  return true;
                }
                default:
                  // Block typing in NORMAL mode (allow Ctrl/Meta/Alt combos through)
                  if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
                    event.preventDefault();
                    return true;
                  }
                  return false;
              }
            }

            return false;
          },
        },
      }),
    ];
  },
});
