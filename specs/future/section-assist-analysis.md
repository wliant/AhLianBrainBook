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

## Improvement Roadmap

### Phase 1: Quick Wins (Low Effort, Immediate Quality Improvement)

#### 1.1 Remove or Implement `classify_intent`
**Option A (remove):** Delete the node from the graph. 3 nodes is clearer than 4 with one being a no-op.
**Option B (implement):** Use it to inject intent-specific instructions into the system prompt. For example:
- If `has_answers`: Append "The user has answered your questions. Generate content now, do not ask more questions."
- If `is_regenerate` and prior content exists: Append "Previous output: {previous_output}. Generate a substantially different version."
- If `has_prior_content` and `has_message`: Append "The user wants to refine the existing content. Make targeted modifications rather than rewriting from scratch."

**Files:** `intelligence-service/src/agents/section_author.py`

#### 1.2 Surface the `explanation` Field
Display the explanation as a subtle annotation below assistant messages in the chat, or as a collapsible "Why?" link below the AI preview.

**Files:** `web/src/components/sections/AiAssistDialog.tsx`

#### 1.3 Show Question Context with Answers
When rendering user answers in the chat, include the original question text. Change from just "Python" to "Programming language: Python".

**Files:** `web/src/components/sections/AiAssistDialog.tsx`

#### 1.4 Add Request Cancellation
Use `AbortController` in the API call. Show a "Cancel" button while loading (replacing or alongside the spinner). On cancel, abort the fetch and keep the conversation history intact.

**Files:** `web/src/lib/api.ts`, `web/src/lib/hooks/useAiAssist.ts`, `web/src/components/sections/AiAssistDialog.tsx`

#### 1.5 Improve Regenerate Variation
Include the previous output in the regeneration prompt: "Here is what you previously generated: {previous_output}. Now generate a substantially different version with a different approach, structure, or perspective."

**Files:** `intelligence-service/src/agents/section_author.py`

---

### Phase 2: Context Enrichment — RAG Pipeline (Medium Effort, Biggest Quality Leap)

The single most impactful improvement is giving the LLM access to the user's own knowledge base. The retrieval infrastructure already exists — vector search, full-text search, neuron links — but none of it is wired into section assist. Today the LLM generates in a vacuum; with context enrichment it generates from the user's notes.

#### 2.1 Existing Retrieval Infrastructure (Already Built, Unused by Section Assist)

| Capability | Repository / Service | Method | How It Works |
|-----------|---------------------|--------|-------------|
| **Vector similarity** | `NeuronEmbeddingRepository` | `findMostSimilar(neuronId, embedding, brainId, limit)` | pgvector cosine distance (`<=>` operator). Returns `(neuronId, similarity)` pairs scored 0-1. Excludes deleted/archived. Scoped to brain. |
| **Full-text search** | `NeuronSearchRepository` | `search(query, brainId, clusterId, tagIds, page, size)` | PostgreSQL `tsvector`/`tsquery`. Searches `content_text` + `title` (2x weight). Returns highlighted snippets + rank scores. |
| **Embedding generation** | `IntelligenceService` | `computeEmbedding(text)` | Calls Ollama `nomic-embed-text` model via `intelligence-service/src/embedding.py`. Returns float array for pgvector storage. |
| **Neuron links** | `NeuronLinkRepository` | `findAllByNeuronId(neuronId)` | Bidirectional graph query. Returns `NeuronLink` with `sourceNeuronId`, `targetNeuronId`, `linkType`, `label`, `weight`. |
| **Link suggestions** | `LinkSuggestionService` | `getSuggestionsForNeuron(neuronId)` | Pre-computed related neurons (embedding similarity) + reference suggestions (wiki-link extraction). Already uses `findMostSimilar()` internally. |

**Key data fields on Neuron model:**
- `contentText` — plain-text extraction of all content, ideal for search and context windows
- `contentJson` — full TipTap structured content (heavy, not suitable for context injection)
- `title`, `brainId`, `clusterId`, `tags` — metadata for filtering and scoping

#### 2.2 Multi-Source Context Assembly

Build a retrieval step in `IntelligenceService.aiAssist()` that assembles context from three sources in parallel, then merges and deduplicates before sending to the LLM.

**Source A: Embedding Similarity (Semantic Retrieval)**
```
User message (or current section contentText if message is short)
    ↓
IntelligenceService.computeEmbedding(text)
    ↓ Returns: float[] vector
NeuronEmbeddingRepository.findMostSimilar(currentNeuronId, vector, brainId, 5)
    ↓ Returns: [(neuronId, similarity_score), ...]
    ↓ Filter: similarity > 0.3 threshold
Fetch neurons → extract { title, contentText[0:500], tags }
```

**Source B: Explicit Neuron Links (Graph Retrieval)**
```
NeuronLinkRepository.findAllByNeuronId(currentNeuronId)
    ↓ Returns: [NeuronLink(source, target, linkType, label, weight), ...]
For each linked neuron:
    Fetch → extract { title, contentText[0:500], linkType, label }
```

**Source C: Cluster Siblings (Neighborhood Retrieval)**
```
NeuronRepository.findByClusterIdAndIsDeletedFalse(clusterId)
    ↓ Returns: all neurons in same cluster (excluding current)
    ↓ Limit: top 10 by lastEditedAt (most recently active)
Extract { title, contentText[0:200] }
```

**Merge & Deduplicate:**
```
all_context_neurons = deduplicate_by_id(source_A + source_B + source_C)
    ↓
Score: linked neurons get weight bonus (user explicitly connected them)
    Linked: base_score = 0.8 + link.weight * 0.2
    Similar: base_score = similarity_score
    Cluster sibling: base_score = 0.3
    ↓
Sort by score descending, take top 8
    ↓
Add to context dict as:
    "knowledge_context": [
        { "title", "content_preview", "tags", "relationship", "score" }
    ]
```

**Token budget:** ~8 neurons × 500 chars avg ≈ 4,000 chars. Roughly 1,000 tokens — well within budget even for smaller models.

#### 2.3 Updated System Prompt

Add a new section to `build_system_prompt()` in `section_author.py`:

```
## Related Knowledge from User's Notes
The user has the following related notes in their knowledge base.
Use these to make your output consistent with their existing content,
reference their terminology, and build on what they already know.
Do NOT simply repeat their existing notes — add value beyond what's already written.

{for each context neuron:}
- [{relationship}] "{title}" ({tags})
  {content_preview}
```

**Relationship labels:** "linked (references)", "linked (depends-on)", "semantically similar", "same cluster"

This makes the AI aware of the user's vocabulary, existing examples, and conceptual framework. A request to "write a code example for CSRF protection" when the user has a linked "Spring Security Config" neuron will produce output that references their specific setup rather than a generic tutorial.

#### 2.4 Context-Aware Generation Strategies by Section Type

Different section types benefit from different context strategies:

| Section Type | Best Context Strategy | Why |
|-------------|----------------------|-----|
| **code** | Linked neurons + similar neurons with code sections | Reuse the user's coding patterns, import conventions, variable naming |
| **math** | Similar neurons with math sections | Maintain consistent notation (e.g., if user uses θ vs. alpha) |
| **diagram** | Cluster siblings | Diagrams often visualize relationships between cluster-level concepts |
| **callout** | Current neuron's other sections | Callouts summarize or warn about adjacent content |
| **table** | Similar neurons with table sections | Match column naming conventions and data formatting |
| **rich-text** | All sources equally weighted | General content benefits from broad context |

Implementation: In `classify_intent` (currently a no-op), detect the section type and adjust retrieval weights before context assembly. This gives `classify_intent` a real purpose.

**Files to modify:**
- `app/src/main/java/com/wliant/brainbook/service/IntelligenceService.java` — Add retrieval pipeline
- `app/src/main/java/com/wliant/brainbook/repository/NeuronRepository.java` — Add `findByClusterId` if not present
- `intelligence-service/src/agents/section_author.py` — Update prompt template, implement `classify_intent`

---

### Phase 3: Tool Use — Dynamic Retrieval & Web Search (Higher Effort, Transformative)

Phase 2 pre-assembles context before the LLM runs. Phase 3 gives the LLM the ability to fetch additional context during generation — searching the knowledge base or the web when it needs more information. This is the difference between a librarian who hands you a stack of books vs. one who sits beside you and fetches more when you ask.

#### 3.1 LangGraph Tool Architecture

**Current graph (linear, no tools):**
```
build_system_prompt → classify_intent → invoke_llm → validate_output → END
```

**Proposed graph (with tool loop):**
```
build_system_prompt → classify_intent → invoke_llm → route_output
    ↓                                                    ↓
    (tool_calls present)                          (final JSON response)
    ↓                                                    ↓
execute_tools → invoke_llm → route_output         validate_output → END
    ↑_________________________|
         (loop until no more tool calls, max 3 iterations)
```

The `route_output` node inspects the LLM response:
- If the response contains tool calls → execute them, feed results back to LLM
- If the response is final JSON (content/questions/reply) → route to `validate_output`
- Max 3 tool-call iterations to prevent runaway loops

**LangChain tool binding:** Use `llm.bind_tools([...])` to register tools. Both Anthropic (via `ChatAnthropic`) and Ollama (via `ChatOllama`) support tool calling in LangChain.

#### 3.2 Knowledge Base Search Tools

Three tools that call back to the Spring Boot API to search the user's notes:

**Tool 1: `search_notes`**
```python
@tool
def search_notes(query: str, limit: int = 5) -> str:
    """Search the user's knowledge base by keyword. Returns matching
    note titles and content excerpts. Use this when you need to find
    specific information the user may have written about."""
    # Calls: GET {brainbook_api_url}/api/internal/search
    #   ?q={query}&brainId={brain_id}&size={limit}
    # Returns: formatted list of (title, highlight_snippet, rank)
```

**Tool 2: `find_related_notes`**
```python
@tool
def find_related_notes(topic: str, limit: int = 5) -> str:
    """Find notes semantically related to a topic using vector similarity.
    Use this when keyword search is too narrow and you need conceptually
    related content."""
    # Calls: POST {brainbook_api_url}/api/internal/similar
    #   body: { text: topic, brainId: brain_id, limit: limit }
    # Returns: formatted list of (title, content_preview, similarity_score)
```

**Tool 3: `read_note`**
```python
@tool
def read_note(neuron_id: str) -> str:
    """Read the full content of a specific note. Use this after search_notes
    or find_related_notes returns a relevant note you want to read in detail."""
    # Calls: GET {brainbook_api_url}/api/internal/neurons/{neuron_id}/content
    # Returns: title + full contentText (truncated to 2000 chars)
```

**Backend internal API** (new controller, not exposed publicly):

```java
// InternalApiController.java — only accessible from intelligence service
@RestController
@RequestMapping("/api/internal")
class InternalApiController {
    @GetMapping("/search")        // proxies to NeuronSearchRepository
    @PostMapping("/similar")      // embeds text + calls NeuronEmbeddingRepository
    @GetMapping("/neurons/{id}/content")  // returns contentText only
}
```

**Security:** These endpoints should only be accessible from the intelligence service container (IP allowlist or shared secret header), not from the public frontend.

#### 3.3 Web Search & Page Fetch Tools

Two tools that allow the LLM to access external information:

**Tool 4: `web_search`**
```python
@tool
def web_search(query: str) -> str:
    """Search the web for current information. Use this for:
    - Latest API documentation or version-specific syntax
    - Current best practices that may have changed recently
    - Facts, statistics, or references that need to be accurate
    Returns top 5 search results with titles, URLs, and snippets."""
```

**Tool 5: `fetch_webpage`**
```python
@tool
def fetch_webpage(url: str) -> str:
    """Fetch and extract the main text content from a webpage.
    Use this after web_search returns a relevant URL you want to read
    in detail. Returns cleaned text content (no HTML/JS), truncated
    to 3000 characters."""
```

**Provider evaluation:**

| Provider | Cost | Quality | API Key Required | Structured Output | Recommendation |
|----------|------|---------|-----------------|-------------------|----------------|
| **Tavily** | $0.01/search | High — AI-optimized snippets | Yes | Yes (title, content, url, score) | Best for LLM consumption. Purpose-built for AI agents. |
| **Brave Search API** | 2000 free/mo, then $0.003/search | High | Yes | Yes | Good free tier for small-scale use. |
| **SerpAPI** | $50/mo for 5000 searches | Very High | Yes | Yes | Overkill unless you need Google-quality results. |
| **DuckDuckGo** | Free | Medium — limited snippets | No | Minimal | Good fallback. No API key friction. |
| **Jina Reader** | Free (rate-limited) | High for page extraction | No | Clean markdown | Best for `fetch_webpage`, not search. |

**Recommended setup:**
- Primary search: **Tavily** (best quality for AI agents, reasonable cost)
- Page fetch: **Jina Reader** (`https://r.jina.ai/{url}` — returns clean markdown)
- Fallback search: **DuckDuckGo** (no API key, works in air-gapped fallback mode)

**Implementation details:**

```python
# intelligence-service/src/tools/web_search.py

import httpx
from functools import lru_cache
from src.config import settings

class WebSearchProvider:
    """Abstraction over search providers with caching and rate limiting."""

    def __init__(self):
        self._cache: dict[str, list[dict]] = {}  # query → results
        self._request_count = 0
        self._max_requests_per_session = 10  # safety limit

    async def search(self, query: str, num_results: int = 5) -> list[dict]:
        if query in self._cache:
            return self._cache[query]
        if self._request_count >= self._max_requests_per_session:
            return [{"error": "Search limit reached for this session"}]

        results = await self._search_tavily(query, num_results)
        self._cache[query] = results
        self._request_count += 1
        return results

    async def fetch_page(self, url: str) -> str:
        """Fetch via Jina Reader for clean text extraction."""
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(f"https://r.jina.ai/{url}")
            return resp.text[:3000]
```

**Per-section-type web search use cases:**

| Section Type | When Web Search Adds Value | Example Query |
|-------------|---------------------------|--------------|
| **code** | Latest API syntax, library versions, deprecation notices | "Spring Security 6.2 CSRF configuration example" |
| **math** | Verifying formulas, finding standard notation | "Bayes theorem posterior probability formula" |
| **diagram** | Reference architectures, standard topologies | "microservices architecture mermaid diagram" |
| **callout** | Verifying warnings about security, compatibility | "PostgreSQL 16 breaking changes migration" |
| **table** | Comparison data, specifications, benchmarks | "React vs Vue vs Svelte 2025 comparison" |
| **rich-text** | Definitions, explanations, citations | "CAP theorem explanation distributed systems" |

#### 3.4 Tool Orchestration & Safety

**Max tool iterations:** 3 per request. After 3 rounds of tool calls, force the LLM to produce a final answer. This prevents runaway loops and keeps latency bounded.

**Tool call budget per iteration:**
- Max 2 tool calls per LLM turn (parallel execution)
- Total max: 6 tool calls per request (3 iterations × 2 calls)

**Timeout per tool:**
- Knowledge base search: 5s (local network, should be fast)
- Web search: 10s (external API)
- Page fetch: 15s (external URL, variable latency)
- Total tool timeout budget: 30s (fail fast if tools are slow)

**Caching:**
- Cache web search results by query string within the conversation session
- Cache page fetches by URL within the conversation session
- Knowledge base search results are not cached (content may change between turns)

**Error handling:**
- Tool failure → return error message to LLM ("Search failed: connection timeout. Try generating without this information.")
- The LLM should gracefully degrade to generating from its training data if tools fail

**Rate limiting:**
- Max 10 web searches per AI assist session (prevent abuse)
- Max 5 page fetches per session
- No limit on knowledge base searches (local, cheap)

#### 3.5 Context Window Management

With pre-assembled context (Phase 2) plus tool results (Phase 3), the context can grow large. Need a token budget strategy.

**Token budget allocation (for ~8K context window on Ollama llama3.2):**

| Component | Budget | Notes |
|-----------|--------|-------|
| System prompt (template) | ~800 tokens | Fixed overhead |
| Current section content | ~500 tokens | User's existing content |
| Sibling section summaries | ~400 tokens | Already implemented |
| Pre-assembled context (Phase 2) | ~1,000 tokens | 8 neurons × 500 chars |
| Conversation history | ~1,500 tokens | Multi-turn chat |
| Tool results (Phase 3) | ~2,000 tokens | Search results + page excerpts |
| **LLM output budget** | **~2,000 tokens** | Generated content |
| **Total** | **~8,200 tokens** | Fits 8K context |

**For larger models (Anthropic Claude, 200K context):** Increase pre-assembled context to 20 neurons × 1,000 chars, and tool result budget to 5,000 tokens. The extra context window directly translates to better generation quality.

**Adaptive truncation:** If total context exceeds the budget:
1. Truncate tool results first (least reliable)
2. Then truncate pre-assembled context (drop lowest-scored neurons)
3. Then truncate conversation history (keep first + last 2 turns)
4. Never truncate the system prompt or current section content

**Files to modify:**
- `intelligence-service/src/agents/section_author.py` — Tool loop, tool binding, route_output node
- `intelligence-service/src/tools/__init__.py` — New tools package
- `intelligence-service/src/tools/knowledge_search.py` — KB search tools
- `intelligence-service/src/tools/web_search.py` — Web search + page fetch tools
- `intelligence-service/src/routers/agents.py` — Pass brain_id to agent for tool scoping
- `intelligence-service/src/config.py` — Add `web_search_enabled`, `web_search_provider`, `tavily_api_key`, `max_tool_iterations`
- `app/src/main/java/com/wliant/brainbook/controller/InternalApiController.java` — Internal search/similar/content endpoints
- `app/src/main/java/com/wliant/brainbook/config/InternalApiSecurityConfig.java` — Secure internal endpoints
- `.env.example` — Document `TAVILY_API_KEY`, `WEB_SEARCH_ENABLED`, `WEB_SEARCH_PROVIDER`

---

### Phase 4: Streaming & UX (Higher Effort, Best Perceived Performance)

#### 4.1 Streaming Responses

Replace the synchronous `llm.invoke()` with streaming. Show content as it generates rather than after completion.

**Intelligence service:**
- Use `llm.astream()` instead of `llm.invoke()` in `invoke_llm()`
- Stream via SSE (Server-Sent Events) from the FastAPI endpoint
- Buffer and validate JSON incrementally (tricky — may need to stream the `explanation` separately from `section_content`)

**Spring Boot:**
- Proxy the SSE stream from intelligence service to frontend
- Or use WebFlux `Flux<ServerSentEvent>` for reactive streaming

**Frontend:**
- Use `EventSource` or `fetch` with `ReadableStream` in `api.ts`
- Update `useAiAssist` to handle incremental content updates
- Show partial content in the preview pane as it arrives

**Simpler alternative:** Don't stream the structured JSON. Instead, stream just a "progress" indicator showing what stage the agent is at (e.g., "Searching related notes...", "Generating code...", "Validating output..."). This avoids the complexity of incremental JSON parsing.

**Files:** All layers — `section_author.py`, `agents.py`, `IntelligenceService.java`, `NeuronController.java`, `api.ts`, `useAiAssist.ts`, `AiAssistDialog.tsx`

#### 4.2 Rich-Text Preview Rendering

Replace the plain-text extractor with a read-only TipTap instance for previewing AI-generated rich-text content.

**Files:** `web/src/components/sections/AiAssistDialog.tsx`

---

### Phase 5: Testing (Ongoing)

| Gap | What to Add |
|-----|-------------|
| Section type coverage | E2E tests for math, diagram, callout, table, rich-text (currently only code tested) |
| Question/answer cycle | E2E test for: ask question → user answers → content generated |
| Content persistence | E2E test: save from dialog → verify section content updated via API |
| Regenerate variation | Test that regenerated content differs from original |
| Cancel flow | Test request cancellation doesn't corrupt state |
| Context enrichment | Unit tests for related neuron injection (once Phase 2 is implemented) |

---

## Prioritization Summary

| Priority | Item | Impact | Effort |
|----------|------|--------|--------|
| **P0** | 2.2 Multi-source context assembly (embeddings + links + cluster) | Very High — biggest quality leap, uses existing infra | Medium |
| **P0** | 1.5 Improve regenerate variation | High — currently broken | Low |
| **P0** | 2.3 Updated system prompt with knowledge context | High — makes context usable | Low |
| **P1** | 2.4 Context-aware strategies by section type + fix classify_intent | High — tailored retrieval | Medium |
| **P1** | 1.4 Request cancellation | Medium — UX quality of life | Low |
| **P1** | 3.1-3.2 LangGraph tool loop + KB search tools | Very High — adaptive retrieval | High |
| **P2** | 3.3 Web search tools (Tavily + Jina Reader) | High — current information, latest APIs | Medium-High |
| **P2** | 3.4-3.5 Tool safety (rate limits, caching, context window mgmt) | Medium — required for Phase 3 to be production-ready | Medium |
| **P2** | 4.1 Streaming responses | High — perceived performance | High |
| **P3** | 1.2 Surface explanation field | Low-Medium | Low |
| **P3** | 1.3 Answer context in chat | Low | Low |
| **P3** | 4.2 Rich-text preview | Medium | Medium |
| **P3** | Phase 5 testing | Medium — prevents regression | Medium |
