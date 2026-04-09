# Section Assist Feature Analysis

Analysis of the per-section AI Assist feature — strengths, weaknesses, and improvement roadmap. Focused on content generation quality and context utilization.

## Current Architecture

```
User clicks sparkles (✨) icon on a section
    ↓
AiAssistDialog opens (side-by-side preview + chat)
    ↓
useAiAssist hook manages conversation state + content stack
    ↓
POST /api/neurons/{id}/sections/{sectionId}/ai-assist
    ↓
[Spring Boot] IntelligenceService.aiAssist()
  - Enriches with neuron title, brain name, cluster name, tags
  - Extracts sibling section summaries (type, order, 200-char preview)
    ↓
POST /api/agents/section-author
    ↓
[Intelligence] LangGraph: build_system_prompt → classify_intent → invoke_llm → validate_output
    ↓
Response: content | questions | reply | error message
    ↓
Frontend updates content preview + conversation history
```

**Supported section types:** code, math, diagram, callout, table, rich-text
**Unsupported (button hidden):** image, audio, divider

**Key files:**
- `web/src/components/sections/AiAssistDialog.tsx` — Dialog UI
- `web/src/lib/hooks/useAiAssist.ts` — State management hook
- `web/src/components/sections/SectionList.tsx` — Triggers dialog
- `app/src/main/java/com/wliant/brainbook/service/IntelligenceService.java` — Context enrichment + proxy
- `intelligence-service/src/agents/section_author.py` — LangGraph agent
- `intelligence-service/src/schemas/section_author.py` — Request/response schemas

---

## Strengths

### 1. Clean Layered Architecture
Three layers with clear responsibilities: frontend (UX + state), Spring Boot (context enrichment + proxy), intelligence service (LLM orchestration). Each can evolve independently.

### 2. Automatic Context Enrichment
The backend auto-injects neuron title, brain name, cluster name, tags, and sibling section summaries. The LLM understands where the user is without them having to explain it. This is the right approach — context assembly should be invisible to the user.

### 3. Side-by-Side Preview with Undo Stack
Original vs. AI-generated content displayed simultaneously. The content stack pattern (`useAiAssist.ts:19`) allows multi-level undo, not just revert-to-original. Users can explore several variations and step back.

### 4. Structured Question/Answer Flow
The AI can ask typed clarifying questions (single-select, multi-select, free-text) rather than relying on free-form chat. This is better than generic chatbots — it reduces ambiguity and guides users toward actionable answers.

### 5. Robust Validation with Graceful Defaults
`validate_output()` handles missing fields with sensible defaults (e.g., `language: "javascript"` for code sections, wrapping non-doc content in TipTap structure). Malformed LLM output falls back to user-friendly error messages rather than crashes. `strip_code_fences()` handles LLMs that ignore the "no markdown" instruction.

### 6. Type-Specific Content Previews
Each of the 6 section types has a dedicated renderer in the dialog: code gets syntax-highlighted `<pre>`, tables render as actual `<table>`, callouts get the styled border-left treatment. Users see meaningful output, not raw JSON.

---

## Weaknesses

### 1. Limited Context — Only Sees the Current Neuron

**Problem:** The LLM receives only the current neuron's metadata and sibling sections. It has no access to:
- Related neurons (via links or embedding similarity)
- Other neurons in the same cluster
- The broader knowledge base
- External sources (web, documentation)

This means the AI generates in a vacuum. If a user has extensive notes on "Spring Security" in other neurons and asks the AI to "write a code example for CSRF protection," the AI can't reference the user's own notes — it relies entirely on its training data.

**Impact:** Generated content feels generic rather than personalized. The user's existing knowledge base is the most valuable context source, and it's completely unused.

### 2. No Streaming — Blind Wait

**Problem:** `llm.invoke(messages)` at `section_author.py:216` blocks until full completion. The frontend shows "Thinking..." with a spinner for the entire duration. The 620,000ms (10+ minute) timeout in `api.ts` signals that long waits are expected.

**Impact:** Users have no sense of progress. They can't tell if the AI is generating something useful or stuck. For complex content (long code, detailed tables), this wait can be 30-60 seconds — an eternity in UI terms.

### 3. `classify_intent` Is Dead Code

**Problem:** `section_author.py:133-149` computes `has_answers`, `is_regenerate`, `has_prior_content`, `has_message` — then returns `{}` in every branch. The node exists in the graph but does nothing.

**Impact:** Adds confusion for developers. The graph is effectively 3 nodes, not 4.

### 4. Regenerate Produces Near-Identical Output

**Problem:** Regeneration sends "Please regenerate the content with a different approach" (`section_author.py:208-209`). There's no temperature increase, no explicit "avoid the previous output" instruction with the previous output included, and JSON mode often uses low/zero temperature.

**Impact:** Users click "Regenerate" expecting variety but get the same or very similar content. The feature promises variation but can't deliver it.

### 5. `explanation` Field Is Never Displayed

**Problem:** Every LLM response includes an `explanation` field. It flows through the entire stack — intelligence service → Spring Boot → frontend — but `AiAssistDialog.tsx` never renders it.

**Impact:** Wasted LLM tokens. More importantly, missed opportunity to help users understand what was generated and why, which builds trust and helps with refinement.

### 6. Rich-Text Preview Strips All Formatting

**Problem:** `AiAssistDialog.tsx:385-389` extracts plain text from TipTap JSON and displays it in a bare `<div>`. Headings, bold, lists, code blocks, links — all lost.

**Impact:** Users can't meaningfully preview AI-generated rich-text content. They must save it to see the actual formatting, which defeats the purpose of the preview pane.

### 7. No Request Cancellation

**Problem:** Once a request is sent, there's no way to cancel it. No `AbortController` in `api.ts`, no cancel button in the dialog. Users must wait or close the entire dialog (losing conversation history).

**Impact:** Frustrating when the user realizes they asked the wrong thing 2 seconds into a 30-second request.

### 8. Conversation History Dual Ownership

**Problem:** The frontend optimistically adds the user turn to `conversationHistory` (`useAiAssist.ts:47-53`), but the backend also constructs the full updated history including the user turn (`IntelligenceService.java:136-155`). The backend's version replaces the frontend's optimistic version via `handleResponse`.

**Impact:** Confusing dual-responsibility. If the response fails or is malformed, the frontend has an optimistic user message in the history but no server-side confirmation. The two copies can diverge.

### 9. Stale Closure in `useAiAssist` Callbacks

**Problem:** `sendMessage` and `regenerate` capture `currentContent` and `conversationHistory` via `useCallback` dependencies. If a user triggers an action between a state update and re-render, the callback uses stale values.

**Impact:** Rare but possible race condition — the wrong content version or conversation history could be sent to the backend.

### 10. Answers Display Lacks Question Context

**Problem:** When a user submits answers, the chat shows only the answer values (`AiAssistDialog.tsx:295-301`): e.g., "Python" as a standalone bubble, with no indication it was answering "Which programming language?"

**Impact:** Chat history becomes confusing in multi-turn conversations. Users lose track of what each answer was for.

---

## Implementation Status

All phases from the original improvement roadmap have been implemented on branch `claude/section-assist-improvements`. The roadmap text has been removed to avoid confusion with the current state.

| Phase | Item | Status |
|-------|------|--------|
| **Phase 1** | 1.1 Implement classify_intent | Done |
| | 1.2 Surface explanation field | Done |
| | 1.3 Show question context with answers | Done |
| | 1.4 Request cancellation (AbortController + Cancel button) | Done |
| | 1.5 Improve regenerate variation | Done |
| **Phase 2** | 2.1-2.2 Multi-source context assembly (embeddings + links + cluster) | Done |
| | 2.3 Updated system prompt with knowledge context | Done |
| | 2.4 Context-aware strategies by section type | Done |
| **Phase 3** | 3.1-3.2 LangGraph tool loop + KB search tools | Done |
| | 3.3 Web search tools (Tavily/DDG + Jina Reader) | Done |
| | 3.4-3.5 Tool safety (rate limits, max iterations, timeouts) | Done |
| | User toggle (aiToolsEnabled in AppSettings) | Done |
| | Internal API controller (/api/internal/*) | Done |
| **Phase 4** | 4.1 Streaming stage indicators (SSE across all layers) | Done |
| | 4.2 Rich-text preview (read-only TipTap) | Done |
| **Phase 5** | Unit/integration tests across all layers | Done |

### Key additions not in original spec
- `ContextAssemblyService` with 3-source parallel retrieval and 3s timeout
- `InternalApiController` with header-based auth for tool callbacks
- Two-graph architecture (linear vs tool-enabled) for Anthropic JSON mode compatibility
- Forced final LLM call when tool loop exceeds max iterations
- `LLM_MAX_TOKENS` configurable (fixed Anthropic 1024 default truncation)
- SSE relay through Spring Boot using java.net.http.HttpClient
- Frontend streaming with fallback to blocking invoke
