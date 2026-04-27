"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSettings } from "@/lib/hooks/useSettings";
import { useBrains } from "@/lib/hooks/useBrains";
import { useClusters } from "@/lib/hooks/useClusters";
import { CheckCircle, Loader2 } from "lucide-react";

function SettingsPageInner() {
  const { settings, loading, updateDisplayName, updateMaxReminders, updateTimezone, updateAiToolsEnabled, updateDefaultShareCluster } = useSettings();
  const searchParams = useSearchParams();
  const fromShare = searchParams.get("from") === "share";
  const [displayName, setDisplayName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [maxReminders, setMaxReminders] = useState(10);
  const [maxRemindersSaving, setMaxRemindersSaving] = useState(false);
  const [maxRemindersSaved, setMaxRemindersSaved] = useState(false);
  const [timezone, setTimezone] = useState("Asia/Singapore");
  const [timezoneSaving, setTimezoneSaving] = useState(false);
  const [timezoneSaved, setTimezoneSaved] = useState(false);
  const [aiToolsEnabled, setAiToolsEnabled] = useState(false);
  const [aiToolsSaving, setAiToolsSaving] = useState(false);
  const [aiToolsSaved, setAiToolsSaved] = useState(false);

  useEffect(() => {
    if (settings) {
      setDisplayName(settings.displayName);
      setMaxReminders(settings.maxRemindersPerNeuron);
      setTimezone(settings.timezone);
      setAiToolsEnabled(settings.aiToolsEnabled);
    }
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

  const handleMaxRemindersChange = async (value: number) => {
    const clamped = Math.max(1, Math.min(100, value));
    setMaxReminders(clamped);
    setMaxRemindersSaving(true);
    setMaxRemindersSaved(false);
    await updateMaxReminders(clamped);
    setMaxRemindersSaving(false);
    setMaxRemindersSaved(true);
    setTimeout(() => setMaxRemindersSaved(false), 2000);
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

      {fromShare && !settings?.defaultShareClusterId && (
        <div className="mb-6 rounded-md border border-yellow-300 bg-yellow-50 px-4 py-3 text-sm text-yellow-900 dark:border-yellow-700 dark:bg-yellow-950 dark:text-yellow-200" data-testid="share-banner">
          Pick a default cluster below to enable mobile sharing.
        </div>
      )}

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
          <label htmlFor="maxReminders" className="block text-sm font-medium mb-1.5">
            Max Reminders per Neuron
          </label>
          <p className="text-xs text-muted-foreground mb-2">
            Maximum number of reminders that can be created for each neuron (1-100).
          </p>
          <div className="flex gap-2 items-center">
            <Input
              id="maxReminders"
              type="number"
              min={1}
              max={100}
              value={maxReminders}
              onChange={(e) => setMaxReminders(parseInt(e.target.value) || 1)}
              onBlur={() => handleMaxRemindersChange(maxReminders)}
              onKeyDown={(e) => e.key === "Enter" && handleMaxRemindersChange(maxReminders)}
              className="w-24"
              data-testid="max-reminders-input"
            />
            {maxRemindersSaving && <Loader2 className="h-4 w-4 animate-spin" />}
            {maxRemindersSaved && <CheckCircle className="h-4 w-4 text-green-500" />}
          </div>
        </div>

        <div className="border-t pt-6">
          <label htmlFor="timezone" className="block text-sm font-medium mb-1.5">
            Timezone
          </label>
          <p className="text-xs text-muted-foreground mb-2">
            Used for scheduling todo task reminders at 7 PM local time.
          </p>
          <div className="flex gap-2 items-center">
            <select
              id="timezone"
              value={timezone}
              onChange={async (e) => {
                const tz = e.target.value;
                setTimezone(tz);
                setTimezoneSaving(true);
                setTimezoneSaved(false);
                await updateTimezone(tz);
                setTimezoneSaving(false);
                setTimezoneSaved(true);
                setTimeout(() => setTimezoneSaved(false), 2000);
              }}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm max-w-xs"
              data-testid="timezone-select"
            >
              {typeof Intl !== "undefined" && typeof Intl.supportedValuesOf === "function"
                ? Intl.supportedValuesOf("timeZone").map((tz) => (
                    <option key={tz} value={tz}>{tz.replace(/_/g, " ")}</option>
                  ))
                : ["UTC", "Asia/Singapore", "America/New_York", "America/Los_Angeles", "Europe/London", "Europe/Berlin", "Asia/Tokyo"].map((tz) => (
                    <option key={tz} value={tz}>{tz.replace(/_/g, " ")}</option>
                  ))
              }
            </select>
            {timezoneSaving && <Loader2 className="h-4 w-4 animate-spin" />}
            {timezoneSaved && <CheckCircle className="h-4 w-4 text-green-500" />}
          </div>
        </div>

        <div className="border-t pt-6">
          <DefaultShareClusterSection
            currentClusterId={settings?.defaultShareClusterId ?? null}
            currentBrainId={settings?.defaultShareBrainId ?? null}
            onSave={updateDefaultShareCluster}
          />
        </div>

        <div className="border-t pt-6">
          <label htmlFor="aiToolsEnabled" className="block text-sm font-medium mb-1.5">
            AI Tools (Search &amp; Retrieval)
          </label>
          <p className="text-xs text-muted-foreground mb-2">
            When enabled, the AI assistant can search your notes and the web for relevant
            information while generating content. This may increase response time.
          </p>
          <div className="flex gap-2 items-center">
            <button
              id="aiToolsEnabled"
              role="switch"
              aria-checked={aiToolsEnabled}
              onClick={async () => {
                const next = !aiToolsEnabled;
                setAiToolsEnabled(next);
                setAiToolsSaving(true);
                setAiToolsSaved(false);
                await updateAiToolsEnabled(next);
                setAiToolsSaving(false);
                setAiToolsSaved(true);
                setTimeout(() => setAiToolsSaved(false), 2000);
              }}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                aiToolsEnabled ? "bg-primary" : "bg-muted"
              }`}
              data-testid="ai-tools-toggle"
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  aiToolsEnabled ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
            <span className="text-sm">{aiToolsEnabled ? "Enabled" : "Disabled"}</span>
            {aiToolsSaving && <Loader2 className="h-4 w-4 animate-spin" />}
            {aiToolsSaved && <CheckCircle className="h-4 w-4 text-green-500" />}
          </div>
        </div>
      </div>
    </div>
  );
}

function DefaultShareClusterSection({
  currentClusterId,
  currentBrainId,
  onSave,
}: {
  currentClusterId: string | null;
  currentBrainId: string | null;
  onSave: (clusterId: string | null) => Promise<void>;
}) {
  const { brains, loading: brainsLoading } = useBrains();
  const [selectedBrainId, setSelectedBrainId] = useState<string>("");
  const [selectedClusterId, setSelectedClusterId] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const { clusters, loading: clustersLoading } = useClusters(selectedBrainId || null);

  useEffect(() => {
    setSelectedBrainId(currentBrainId ?? "");
    setSelectedClusterId(currentClusterId ?? "");
  }, [currentBrainId, currentClusterId]);

  const dirty =
    (selectedBrainId !== (currentBrainId ?? "")) ||
    (selectedClusterId !== (currentClusterId ?? ""));
  const canSave = dirty && (selectedClusterId !== "" || currentClusterId !== null);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    await onSave(selectedClusterId || null);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div data-testid="default-share-cluster">
      <label className="block text-sm font-medium mb-1.5">Default Share Cluster</label>
      <p className="text-xs text-muted-foreground mb-2">
        When you share a link, image, or file to BrainBook from your phone, the new neuron is
        created in this cluster. iOS does not support PWA share targets.
      </p>
      <div className="flex flex-wrap gap-2 items-center">
        <select
          aria-label="Brain"
          value={selectedBrainId}
          onChange={(e) => {
            setSelectedBrainId(e.target.value);
            setSelectedClusterId("");
          }}
          disabled={brainsLoading}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm max-w-[14rem]"
          data-testid="share-brain-select"
        >
          <option value="">— None —</option>
          {brains.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
        <select
          aria-label="Cluster"
          value={selectedClusterId}
          onChange={(e) => setSelectedClusterId(e.target.value)}
          disabled={!selectedBrainId || clustersLoading}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm max-w-[14rem]"
          data-testid="share-cluster-select"
        >
          <option value="">{selectedBrainId ? "— Select cluster —" : "— Pick a brain first —"}</option>
          {clusters.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <Button onClick={handleSave} disabled={saving || !canSave} data-testid="share-cluster-save">
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
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-full"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}>
      <SettingsPageInner />
    </Suspense>
  );
}
