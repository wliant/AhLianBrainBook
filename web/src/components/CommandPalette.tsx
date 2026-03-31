"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useTheme } from "next-themes";
import { Command } from "cmdk";
import {
  Home,
  Search,
  Star,
  Trash2,
  Settings,
  Lightbulb,
  Brain,
  Plus,
  Sun,
  Moon,
  PanelLeftClose,
  Network,
  List,
} from "lucide-react";
import type { Brain as BrainType } from "@/types";

const PAGES = [
  { label: "Dashboard", href: "/", icon: Home },
  { label: "Search", href: "/search", icon: Search },
  { label: "Favorites", href: "/favorites", icon: Star },
  { label: "Trash", href: "/trash", icon: Trash2 },
  { label: "Thoughts", href: "/thoughts", icon: Lightbulb },
  { label: "Settings", href: "/settings", icon: Settings },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { setTheme, theme } = useTheme();

  useEffect(() => {
    const handler = () => setOpen((prev) => !prev);
    window.addEventListener("toggle-command-palette", handler);
    return () => window.removeEventListener("toggle-command-palette", handler);
  }, []);

  const brains = queryClient.getQueryData<BrainType[]>(["brains"]) || [];

  const runAction = (fn: () => void) => {
    fn();
    setOpen(false);
  };

  return (
    <Command.Dialog
      open={open}
      onOpenChange={setOpen}
      label="Command Palette"
      className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]"
      overlayClassName="fixed inset-0 bg-black/50"
      contentClassName="w-full max-w-lg rounded-lg border bg-background shadow-lg overflow-hidden"
    >
      <Command.Input
        placeholder="Type a command or search..."
        className="w-full border-b px-4 py-3 text-sm outline-none bg-transparent placeholder:text-muted-foreground"
        data-testid="command-palette-input"
      />
      <Command.List className="max-h-80 overflow-y-auto p-2">
        <Command.Empty className="py-6 text-center text-sm text-muted-foreground">
          No results found.
        </Command.Empty>

        <Command.Group heading="Navigation" className="text-xs font-medium text-muted-foreground px-2 py-1.5">
          {PAGES.map((page) => (
            <Command.Item
              key={page.href}
              value={page.label}
              onSelect={() => runAction(() => router.push(page.href))}
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm cursor-pointer aria-selected:bg-accent"
              data-testid={`cmd-nav-${page.label.toLowerCase()}`}
            >
              <page.icon className="h-4 w-4 text-muted-foreground" />
              {page.label}
            </Command.Item>
          ))}
        </Command.Group>

        {brains.length > 0 && (
          <Command.Group heading="Brains" className="text-xs font-medium text-muted-foreground px-2 py-1.5">
            {brains.map((brain) => (
              <Command.Item
                key={brain.id}
                value={`brain ${brain.name}`}
                onSelect={() => runAction(() => router.push(`/brain/${brain.id}`))}
                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm cursor-pointer aria-selected:bg-accent"
                data-testid={`cmd-brain-${brain.id}`}
              >
                <Brain className="h-4 w-4 text-muted-foreground" />
                {brain.icon && <span>{brain.icon}</span>}
                {brain.name}
              </Command.Item>
            ))}
            {brains.map((brain) => (
              <Command.Item
                key={`graph-${brain.id}`}
                value={`graph ${brain.name}`}
                onSelect={() => runAction(() => router.push(`/brain/${brain.id}/graph`))}
                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm cursor-pointer aria-selected:bg-accent"
              >
                <Network className="h-4 w-4 text-muted-foreground" />
                {brain.name} — Knowledge Graph
              </Command.Item>
            ))}
          </Command.Group>
        )}

        <Command.Group heading="Actions" className="text-xs font-medium text-muted-foreground px-2 py-1.5">
          <Command.Item
            value="toggle sidebar"
            onSelect={() => runAction(() => window.dispatchEvent(new CustomEvent("toggle-sidebar")))}
            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm cursor-pointer aria-selected:bg-accent"
          >
            <PanelLeftClose className="h-4 w-4 text-muted-foreground" />
            Toggle Sidebar
          </Command.Item>
          <Command.Item
            value="toggle table of contents"
            onSelect={() => runAction(() => window.dispatchEvent(new CustomEvent("toggle-toc")))}
            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm cursor-pointer aria-selected:bg-accent"
          >
            <List className="h-4 w-4 text-muted-foreground" />
            Toggle Table of Contents
          </Command.Item>
          <Command.Item
            value="switch to light theme"
            onSelect={() => runAction(() => setTheme("light"))}
            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm cursor-pointer aria-selected:bg-accent"
          >
            <Sun className="h-4 w-4 text-muted-foreground" />
            Switch to Light Theme
          </Command.Item>
          <Command.Item
            value="switch to dark theme"
            onSelect={() => runAction(() => setTheme("dark"))}
            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm cursor-pointer aria-selected:bg-accent"
          >
            <Moon className="h-4 w-4 text-muted-foreground" />
            Switch to Dark Theme
          </Command.Item>
          <Command.Item
            value="new brain"
            onSelect={() => runAction(() => router.push("/"))}
            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm cursor-pointer aria-selected:bg-accent"
          >
            <Plus className="h-4 w-4 text-muted-foreground" />
            New Brain
          </Command.Item>
        </Command.Group>
      </Command.List>
    </Command.Dialog>
  );
}
