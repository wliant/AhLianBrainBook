# BrainBook Feature Gaps

**Origin:** Exploratory testing (2026-04-02) with 3 brains, 33 clusters, 165 neurons. 12 gaps were identified. This file retains the 7 that remain open after auditing the current codebase.

**Closed gaps (implemented):** Knowledge graph layout (#4 — dagre hierarchical layout in `GraphCanvas.tsx`), cross-brain search (#5 — results show `brainName › clusterName`), neuron titles in favorites/dashboard (#2 — fixed), wiki-link autocomplete (#9 — `WikiLink.tsx` with `[[` trigger), sidebar brain expansion (#11 — expandable brain→cluster→neuron tree).

---

## Open Gaps

### P0 — Archive UI Missing

**What was observed:** Archiving a neuron via the API (`POST /api/neurons/{id}/archive`) sets `isArchived: true` but nothing in the UI reflects this. The Trash page shows soft-deleted neurons only. There is no Archive section, no archive option in neuron menus, and archived neurons silently disappear from all views with no way to retrieve them.

**What's already built:** Backend supports `isArchived` flag; archive/unarchive endpoints exist.

**What remains:**
- Archive option in neuron context menu (next to "Move to Trash")
- Dedicated Archive page listing archived neurons with restore/delete actions
- Archived neurons excluded from default views but included in search (filterable)
- Clear lifecycle: Active → Archived → Trashed → Permanently Deleted

---

### P1 — Bulk Import UI and Brain Templates

**What was observed:** Creating a comprehensive brain requires clicking through dozens of forms one-by-one. There is no import flow and no template to start from.

**What's already built:** `POST /api/brains/import` accepts a structured JSON payload (`{ name, description?, clusters?, tags?, links? }`). The round-trip data model exists.

**What remains:**
- Import UI — file picker or paste JSON, preview before import, conflict handling
- Markdown folder import adapter (folder = cluster, `.md` file = neuron)
- Pre-built brain templates selectable at brain creation ("Data Structures & Algorithms", "System Design Interview Prep", etc.)
- Custom user-defined templates (save current brain structure as template)

---

### P1 — Cluster Description and Metadata

**What was observed:** Clusters have no description field. On the brain overview page, clusters appear as plain links with no context, neuron count, or visual differentiation. Brains with 10+ clusters become hard to navigate at a glance.

**What's already built:** Nothing — no `description` column in the clusters table, no neuron count in cluster responses.

**What remains:**
- Schema migration: add `description TEXT` and `icon VARCHAR` to clusters table
- Cluster edit dialog with description textarea
- Neuron count badge on cluster cards (cheap: aggregate in `ClusterService.getByBrainId()`)
- Optional: icon/color picker for visual differentiation
- Cluster card preview showing first 2–3 neuron titles on hover

---

### P2 — Batch Operations on Neurons

**What was observed:** Every neuron operation (tag, move, archive, delete) must be performed one at a time. Organizing a cluster of 30 neurons is prohibitively slow.

**What's already built:** Nothing.

**What remains:**
- Multi-select mode on neuron lists (checkbox per row, "Select all in cluster")
- Bulk actions toolbar: tag, move to cluster, archive, delete, export
- Confirmation dialog for destructive bulk actions

> **Future integration point:** Once `intelligence-features.md` Auto-Tagging is built, bulk operations could expose an "AI tag selected neurons" action in the same toolbar.

---

### P2 — Neuron Content Templates

**What was observed:** Every new neuron opens a blank editor. Users creating many similar neurons (algorithm analyses, system design notes) rebuild the same structure from scratch each time.

**What's already built:** Nothing.

**What remains:**
- Template data model: name, description, `contentJson` skeleton
- Built-in templates: Algorithm Analysis (Problem / Approach / Complexity / Code), System Design (Requirements / High-Level Design / Deep Dive / Trade-offs), Concept, Comparison
- Custom user templates: save current neuron content as a template
- Template picker at neuron creation (or "Apply template" to existing empty neurons)

> **Boundary with intelligence-features.md:** Templates here are static, manually authored skeletons. The "Organization Suggestions" feature in `intelligence-features.md` is AI-driven restructuring of existing content — complementary, not overlapping.

---

### P3 — Dashboard Analytics and Progress Tracking

**What was observed:** The Dashboard shows only Favorites and Recent neurons — effectively a landing page. Users maintaining multiple brains have no visibility into their overall knowledge portfolio or study progress.

**What's already built:** Nothing.

**What remains:**
- Brain cards with cluster/neuron counts and last activity date
- "Neurons needing content" list (neurons with empty `contentText`)
- Review queue count and study streak (integrate with existing Reminders and Review features)
- Weekly activity chart (neurons created/edited per day)

---

### P3 — Brain and Cluster Export UI

**What was observed:** Export and Share buttons exist only at the individual neuron level. There is no way to export an entire brain or cluster as a document.

**What's already built:** `exportBrain()` API call exists in `web/src/lib/api.ts` but is used only internally (graph page); no user-facing download UI.

**What remains:**
- Export button on brain overview page → download as Markdown folder (zip) or single JSON
- Export button on cluster page → download cluster as Markdown or PDF
- Selective export dialog (choose which clusters/neurons to include)
- Round-trip with import (Gap #1) — exported JSON should be importable

---

## Relationship to intelligence-features.md

`specs/future/intelligence-features.md` covers AI-powered capabilities (cluster Q&A, link suggestion, auto-tagging, brain health report, etc.) that operate on top of existing content. This file covers foundational UX and data model gaps that exist regardless of AI.

The two specs are complementary with no direct overlap. Two future integration points worth tracking:
- **Batch Ops + Auto-Tagging:** The batch operations toolbar (this spec) and AI auto-tagging (`intelligence-features.md`) should share a tag-application path so both manual and AI-suggested tags flow through the same mechanism.
- **Templates + Organization Suggestions:** Manual templates (this spec) and AI organization suggestions (`intelligence-features.md`) address the same underlying need (structured, consistent neurons) through different mechanisms — manual scaffolding up-front vs. AI restructuring after the fact.
