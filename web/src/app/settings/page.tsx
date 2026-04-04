"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSettings } from "@/lib/hooks/useSettings";
import { CheckCircle, Loader2 } from "lucide-react";

export default function SettingsPage() {
  const { settings, loading, updateDisplayName, updateMaxReminders, updateTimezone } = useSettings();
  const [displayName, setDisplayName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [maxReminders, setMaxReminders] = useState(10);
  const [maxRemindersSaving, setMaxRemindersSaving] = useState(false);
  const [maxRemindersSaved, setMaxRemindersSaved] = useState(false);
  const [timezone, setTimezone] = useState("Asia/Singapore");
  const [timezoneSaving, setTimezoneSaving] = useState(false);
  const [timezoneSaved, setTimezoneSaved] = useState(false);

  useEffect(() => {
    if (settings) {
      setDisplayName(settings.displayName);
      setMaxReminders(settings.maxRemindersPerNeuron);
      setTimezone(settings.timezone);
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
      </div>
    </div>
  );
}
