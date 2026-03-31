"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSettings } from "@/lib/hooks/useSettings";
import { CheckCircle, Loader2 } from "lucide-react";

export default function SettingsPage() {
  const { settings, loading, updateDisplayName, updateEditorMode } = useSettings();
  const [displayName, setDisplayName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [editorModeSaving, setEditorModeSaving] = useState(false);
  const [editorModeSaved, setEditorModeSaved] = useState(false);

  useEffect(() => {
    if (settings) setDisplayName(settings.displayName);
  }, [settings]);

  const handleSave = async () => {
    if (!displayName.trim()) return;
    setSaving(true);
    setSaved(false);
    await updateDisplayName(displayName.trim());
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleEditorModeChange = async (mode: string) => {
    setEditorModeSaving(true);
    setEditorModeSaved(false);
    await updateEditorMode(mode);
    setEditorModeSaving(false);
    setEditorModeSaved(true);
    setTimeout(() => setEditorModeSaved(false), 2000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Settings</h1>

      <div className="space-y-6">
        <div>
          <label htmlFor="displayName" className="block text-sm font-medium mb-1.5">
            Display Name
          </label>
          <p className="text-xs text-muted-foreground mb-2">
            This name appears as the author on brains, clusters, and neurons you create or edit.
          </p>
          <div className="flex gap-2">
            <Input
              id="displayName"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
              placeholder="Your name"
              maxLength={100}
              className="max-w-xs"
            />
            <Button onClick={handleSave} disabled={saving || !displayName.trim()}>
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : saved ? (
                <>
                  <CheckCircle className="h-4 w-4 mr-1" />
                  Saved
                </>
              ) : (
                "Save"
              )}
            </Button>
          </div>
        </div>

        <div className="border-t pt-6">
          <label className="block text-sm font-medium mb-1.5">
            Editor Mode
          </label>
          <p className="text-xs text-muted-foreground mb-3">
            Choose your preferred editing style. Vim mode adds hjkl navigation, modal editing (Normal/Insert), and common Vim keybindings.
          </p>
          <div className="flex gap-2 items-center">
            <div className="flex rounded-md border overflow-hidden">
              <button
                onClick={() => handleEditorModeChange("normal")}
                disabled={editorModeSaving}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  settings?.editorMode === "normal"
                    ? "bg-primary text-primary-foreground"
                    : "bg-background hover:bg-accent"
                }`}
                data-testid="editor-mode-normal"
              >
                Normal
              </button>
              <button
                onClick={() => handleEditorModeChange("vim")}
                disabled={editorModeSaving}
                className={`px-4 py-2 text-sm font-medium border-l transition-colors ${
                  settings?.editorMode === "vim"
                    ? "bg-primary text-primary-foreground"
                    : "bg-background hover:bg-accent"
                }`}
                data-testid="editor-mode-vim"
              >
                Vim
              </button>
            </div>
            {editorModeSaving && <Loader2 className="h-4 w-4 animate-spin" />}
            {editorModeSaved && <CheckCircle className="h-4 w-4 text-green-500" />}
          </div>
        </div>
      </div>
    </div>
  );
}
