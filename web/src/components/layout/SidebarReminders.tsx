"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SidebarReminders() {
  return (
    <Link href="/reminders">
      <Button variant="ghost" size="sm" className="w-full justify-start gap-2">
        <Bell className="h-4 w-4" />
        Reminders
      </Button>
    </Link>
  );
}
