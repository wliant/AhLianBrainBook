import { Node, mergeAttributes } from "@tiptap/core";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    inlineCheckbox: {
      insertCheckbox: () => ReturnType;
    };
  }
}

export const InlineCheckbox = Node.create({
  name: "inlineCheckbox",
  group: "inline",
  inline: true,
  atom: true,

  addAttributes() {
    return {
      checked: {
        default: false,
        parseHTML: (element) => (element as HTMLInputElement).checked,
        renderHTML: (attributes) => ({
          checked: attributes.checked ? "" : undefined,
        }),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'input[type="checkbox"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "input",
      mergeAttributes(HTMLAttributes, {
        type: "checkbox",
        class: "inline-checkbox",
      }),
    ];
  },

  addNodeView() {
    return ({ node, getPos, editor }) => {
      const input = document.createElement("input");
      input.type = "checkbox";
      input.checked = node.attrs.checked;
      input.classList.add("inline-checkbox");

      input.addEventListener("change", () => {
        if (typeof getPos === "function") {
          const pos = getPos();
          if (pos == null) return;
          editor
            .chain()
            .focus()
            .command(({ tr }) => {
              tr.setNodeMarkup(pos, undefined, {
                ...node.attrs,
                checked: input.checked,
              });
              return true;
            })
            .run();
        }
      });

      return {
        dom: input,
        update(updatedNode) {
          if (updatedNode.type.name !== "inlineCheckbox") return false;
          input.checked = updatedNode.attrs.checked;
          return true;
        },
      };
    };
  },

  addCommands() {
    return {
      insertCheckbox:
        () =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: { checked: false },
          });
        },
    };
  },
});
