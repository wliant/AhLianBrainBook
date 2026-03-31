"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Brain, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sidebar } from "./Sidebar";
import { NotificationBell } from "@/components/notifications/NotificationBell";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleToggleSidebar = useCallback(() => {
    setSidebarOpen((prev) => !prev);
  }, []);

  useEffect(() => {
    window.addEventListener("toggle-sidebar", handleToggleSidebar);
    return () => window.removeEventListener("toggle-sidebar", handleToggleSidebar);
  }, [handleToggleSidebar]);

  return (
    <div className="flex h-[100dvh]">
      <Sidebar open={sidebarOpen} onOpenChange={setSidebarOpen} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex items-center gap-2 border-b px-3 py-2 lg:hidden">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <Brain className="h-5 w-5" />
            <span>BrainBook</span>
          </Link>
          <div className="flex-1" />
          <NotificationBell />
        </div>
        <div className="hidden lg:flex items-center justify-end px-4 py-1 border-b">
          <NotificationBell />
        </div>
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
