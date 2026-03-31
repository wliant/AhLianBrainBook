"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import type { AppSettings } from "@/types";

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.settings.get().then((data) => {
      setSettings(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const updateDisplayName = useCallback(async (displayName: string) => {
    const updated = await api.settings.update({ displayName });
    setSettings(updated);
    return updated;
  }, []);

  return { settings, loading, updateDisplayName };
}
