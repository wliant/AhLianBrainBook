import { createRoot } from "react-dom/client";
import type { SuggestionProps, SuggestionKeyDownProps } from "@tiptap/suggestion";
import { SuggestionDropdown, type SuggestionDropdownRef } from "./SuggestionDropdown";

interface RendererConfig<T> {
  renderItem: (item: T, isSelected: boolean) => React.ReactNode;
  getKey: (item: T) => string;
  emptyMessage: string;
  width?: string;
}

export function createSuggestionRenderer<T>(config: RendererConfig<T>) {
  return () => {
    let root: ReturnType<typeof createRoot> | null = null;
    let container: HTMLDivElement | null = null;
    let componentRef: SuggestionDropdownRef | null = null;
    let isCleanedUp = false;

    const cleanup = () => {
      if (isCleanedUp) return;
      isCleanedUp = true;
      if (root) {
        root.unmount();
        root = null;
      }
      if (container) {
        container.remove();
        container = null;
      }
      componentRef = null;
    };

    const updatePosition = (clientRect: (() => DOMRect | null) | null | undefined) => {
      if (!clientRect || !container) return;
      const rect = clientRect();
      if (rect) {
        container.style.left = `${rect.left}px`;
        container.style.top = `${rect.bottom + 4}px`;
      }
    };

    const renderDropdown = (props: SuggestionProps<T>) => {
      if (!root || !container) return;
      root.render(
        <SuggestionDropdown
          items={props.items}
          onSelect={(item: T) => props.command(item)}
          renderItem={config.renderItem}
          getKey={config.getKey}
          emptyMessage={config.emptyMessage}
          width={config.width}
          ref={(ref: SuggestionDropdownRef | null) => {
            componentRef = ref;
          }}
        />
      );
    };

    return {
      onStart: (props: SuggestionProps<T>) => {
        isCleanedUp = false;
        container = document.createElement("div");
        container.style.position = "absolute";
        container.style.zIndex = "50";
        document.body.appendChild(container);
        root = createRoot(container);
        renderDropdown(props);
        updatePosition(props.clientRect);
      },
      onUpdate: (props: SuggestionProps<T>) => {
        renderDropdown(props);
        updatePosition(props.clientRect);
      },
      onKeyDown: (props: SuggestionKeyDownProps) => {
        if (props.event.key === "Escape") {
          cleanup();
          return true;
        }
        return componentRef?.onKeyDown(props) ?? false;
      },
      onExit: cleanup,
    };
  };
}
