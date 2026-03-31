"use client";

import {
  useState,
  useEffect,
  useCallback,
  useRef,
  forwardRef,
  useImperativeHandle,
} from "react";
import type { SuggestionKeyDownProps } from "@tiptap/suggestion";

export interface SuggestionDropdownRef {
  onKeyDown: (props: SuggestionKeyDownProps) => boolean;
}

interface SuggestionDropdownProps<T> {
  items: T[];
  onSelect: (item: T) => void;
  renderItem: (item: T, isSelected: boolean) => React.ReactNode;
  getKey: (item: T) => string;
  emptyMessage: string;
  width?: string;
}

function SuggestionDropdownInner<T>(
  props: SuggestionDropdownProps<T>,
  ref: React.ForwardedRef<SuggestionDropdownRef>
) {
  const { items, onSelect, renderItem, getKey, emptyMessage, width = "w-64" } = props;
  const [selectedIndex, setSelectedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectItem = useCallback(
    (index: number) => {
      const item = items[index];
      if (item) onSelect(item);
    },
    [items, onSelect]
  );

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }: SuggestionKeyDownProps) => {
      if (event.key === "ArrowUp") {
        setSelectedIndex((i) => (i <= 0 ? items.length - 1 : i - 1));
        return true;
      }
      if (event.key === "ArrowDown") {
        setSelectedIndex((i) => (i >= items.length - 1 ? 0 : i + 1));
        return true;
      }
      if (event.key === "Enter") {
        selectItem(selectedIndex);
        return true;
      }
      return false;
    },
  }));

  useEffect(() => {
    setSelectedIndex(0);
  }, [items]);

  useEffect(() => {
    const selected = containerRef.current?.querySelector("[aria-selected='true']");
    selected?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  if (items.length === 0) {
    return (
      <div
        className="z-50 rounded-md border bg-popover p-2 text-sm text-muted-foreground shadow-md"
        role="status"
      >
        {emptyMessage}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`z-50 max-h-64 overflow-y-auto rounded-md border bg-popover shadow-md ${width}`}
      role="listbox"
      aria-label="Suggestions"
    >
      {items.map((item, index) => (
        <div
          key={getKey(item)}
          role="option"
          aria-selected={index === selectedIndex}
          className={`cursor-pointer px-3 py-2 text-sm transition-colors ${
            index === selectedIndex ? "bg-accent text-accent-foreground" : "hover:bg-accent/50"
          }`}
          onClick={() => selectItem(index)}
          onMouseEnter={() => setSelectedIndex(index)}
        >
          {renderItem(item, index === selectedIndex)}
        </div>
      ))}
    </div>
  );
}

// forwardRef wrapper that preserves generics
export const SuggestionDropdown = forwardRef(SuggestionDropdownInner) as <T>(
  props: SuggestionDropdownProps<T> & { ref?: React.Ref<SuggestionDropdownRef> }
) => React.ReactElement | null;
