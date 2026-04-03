"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export function useSandboxList() {
  const { data: sandboxes = [], isLoading: loading } = useQuery({
    queryKey: ["sandboxes"],
    queryFn: () => api.sandbox.list(),
  });

  return { sandboxes, loading };
}
