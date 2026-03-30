"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";

interface BreadcrumbItem {
  label: string;
  href: string;
}

export function Breadcrumb({ items }: { items: BreadcrumbItem[] }) {
  if (items.length === 0) return null;

  return (
    <nav className="flex items-center gap-1 text-sm text-muted-foreground px-6 py-2 border-b overflow-x-auto">
      {items.map((item, i) => (
        <span key={item.href} className="flex items-center gap-1 shrink-0">
          {i > 0 && <ChevronRight className="h-3 w-3" />}
          {i < items.length - 1 ? (
            <Link href={item.href} className="hover:text-foreground transition-colors truncate max-w-[200px]">
              {item.label}
            </Link>
          ) : (
            <span className="text-foreground font-medium truncate max-w-[200px]">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
