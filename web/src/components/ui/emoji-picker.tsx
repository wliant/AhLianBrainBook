"use client";

import { useState } from "react";
import { Smile, X } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const EMOJI_DATA: Record<string, string[]> = {
  Smileys: [
    "😀", "😃", "😄", "😁", "😆", "😅", "🤣", "😂", "🙂", "😊",
    "😇", "🥰", "😍", "🤩", "😎", "🤓", "🧐", "🤔", "🤗", "😤",
  ],
  Nature: [
    "🌸", "🌺", "🌻", "🌹", "🌷", "🌱", "🌿", "🍀", "🌳", "🌴",
    "🐶", "🐱", "🐻", "🦊", "🐸",
  ],
  Food: [
    "🍎", "🍊", "🍋", "🍇", "🍓", "🍕", "🍔", "🌮", "🍣", "🍰",
    "☕", "🍵", "🧃", "🍺",
  ],
  Objects: [
    "📚", "📖", "📝", "✏️", "📌", "📎", "🔑", "🔒", "💡", "🔬",
    "💻", "🖥️", "📱", "🎮", "🎯",
  ],
  Travel: [
    "🏠", "🏢", "🏫", "🏥", "⛪", "🗼", "🌍", "🌎", "🌏", "✈️",
    "🚀", "🛸", "⭐", "🌙", "☀️",
  ],
  Symbols: [
    "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "💯", "✅",
    "❌", "⚡", "🔥", "💎", "🏆",
  ],
};

const CATEGORIES = Object.keys(EMOJI_DATA);

interface EmojiPickerProps {
  value: string | null;
  onChange: (emoji: string | null) => void;
  className?: string;
}

export function EmojiPicker({ value, onChange, className }: EmojiPickerProps) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState(CATEGORIES[0]);

  const handleSelect = (emoji: string) => {
    onChange(emoji);
    setOpen(false);
  };

  const handleClear = () => {
    onChange(null);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "h-8 w-8 rounded-md border flex items-center justify-center text-lg hover:bg-accent transition-colors shrink-0",
            className
          )}
          aria-label="Pick icon"
        >
          {value || <Smile className="h-4 w-4 text-muted-foreground" />}
        </button>
      </PopoverTrigger>
      <PopoverContent
        className={cn("w-64 p-2", className)}
        onOpenAutoFocus={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-muted-foreground">Icon</span>
          {value && (
            <button
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-0.5"
              onClick={handleClear}
            >
              <X className="h-3 w-3" /> Remove
            </button>
          )}
        </div>
        <div className="flex gap-1 mb-2 overflow-x-auto">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              className={cn(
                "px-2 py-0.5 text-xs rounded-md whitespace-nowrap transition-colors",
                cat === category
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent"
              )}
              onClick={() => setCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-6 gap-0.5 max-h-40 overflow-y-auto">
          {EMOJI_DATA[category].map((emoji) => (
            <button
              key={emoji}
              type="button"
              className={cn(
                "h-8 w-8 flex items-center justify-center text-lg rounded hover:bg-accent transition-colors",
                value === emoji && "ring-2 ring-primary ring-offset-1"
              )}
              onClick={() => handleSelect(emoji)}
            >
              {emoji}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
