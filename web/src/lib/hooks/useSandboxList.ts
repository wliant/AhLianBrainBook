"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Sandbox } from "@/types";

export function useSandboxList() {
  const { data: sandboxes = [], isLoading: loading } = useQuery({
    queryKey: ["sandboxes"],
    queryFn: () => api.sandbox.list(),
  });

  return { sandboxes, loading };
}
