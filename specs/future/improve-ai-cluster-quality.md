# Improve AI Research Cluster Generation Quality

The AI Research cluster generates structured learning maps through four LangGraph agents. While the pipeline works end-to-end, the quality of generated content is limited by generic prompts, thin context, no LLM tuning, and absent quality validation. This spec identifies the gaps and proposes targeted improvements.

---

## Current State

### Agent Inventory

| Agent | File | Purpose | LLM Calls |
|-------|------|---------|-----------|
| Research Goal Generator | `intelligence-service/src/agents/research_goal_generator.py` | Generate 1-2 sentence learning goal from brain name/description | 1 |
| Research Topic Generator | `intelligence-service/src/agents/research_topic_generator.py` | Generate 4-8 bullet learning map for a topic | 1 |
| Research Topic Scorer | `intelligence-service/src/agents/research_topic_scorer.py` | Re-evaluate completeness of bullets against current neurons | 1 |
| Research Bullet Expander | `intelligence-service/src/agents/research_bullet_expander.py` | Expand a single bullet into 3-5 sub-points | 1 |

### Quality Gaps

**1. Generic Prompts with No Quality Criteria**

All four agents use a bare "You are an AI learning advisor" persona. The prompts specify structural requirements (JSON format, field names) but say nothing about what makes the *content* good. There are no few-shot examples, no anti-patterns to avoid, and no quality rubric.

Current topic generator prompt (abbreviated):
```
"Generate a structured learning map for the given topic.
Break the topic into 4-8 key concepts. Each concept can have 0-4 sub-points."
```

Problems:
- "4-8 key concepts" is fixed regardless of topic breadth (a narrow topic like "mutex" doesn't need 8 items; a broad one like "distributed systems" needs more)
- No guidance on what makes a good `explanation` field — outputs tend to be vague ("Learn about X")
- No instruction to make bullets actionable or testable
- No deduplication against existing topics in the same cluster

**2. No LLM Tuning Parameters**

`get_llm()` in `intelligence-service/src/llm.py` passes zero generation parameters — no `temperature`, `max_tokens`, `top_p`, or `frequency_penalty`. All four agents use identical default LLM settings despite having different requirements:

- Goal generation needs creativity (higher temperature)
- Topic structuring needs precision (lower temperature)
- Scoring needs determinism (lowest temperature)

**3. Shallow Context Pipeline**

The backend (`app/src/main/java/com/wliant/brainbook/service/ResearchAsyncService.java`) builds neuron summaries with:
- 500-character content preview (`CONTENT_PREVIEW_LENGTH = 500`) — often cuts mid-sentence
- All neurons in the brain sent regardless of relevance to the topic
- No tag information passed
- No cluster hierarchy context (what other topics exist)
- No neuron metadata (creation date, complexity, link count)

For a brain with 100 neurons, most summaries are irrelevant noise that dilutes the LLM's attention and wastes tokens.

**4. No Output Quality Validation**

The `validate_output` step in each agent only checks JSON structure. It normalizes fields and fills defaults but never evaluates semantic quality. A response with all explanations set to empty strings, or all bullets saying the same thing, passes validation.

**5. No Feedback Loop**

There is no mechanism for users to signal whether a generation was good or bad. The only option is to delete and recreate, losing all context about what was wrong.

---

## Improvement Proposals

### A. Prompt Engineering

**Priority: High | Complexity: Low | Impact: High**

Rewrite the system prompts for all four agents with explicit quality criteria, few-shot examples, and anti-pattern warnings.

#### A1. Research Goal Generator

**File:** `intelligence-service/src/agents/research_goal_generator.py`

Add to the prompt:
- Quality criteria: the goal should be *specific* (mention concrete subtopics), *scoped* (achievable, not "learn everything about X"), and *measurable* (the user can tell when they've achieved it)
- One good example and one bad example
- Instruction to adapt tone/depth based on whether the brain description suggests beginner or advanced study

```
Quality criteria for the research goal:
- SPECIFIC: Reference 2-3 concrete subtopics the user should master
- SCOPED: Achievable within a focused study period, not "learn everything about X"
- MEASURABLE: The user should be able to tell when they've reached the goal

Good example (brain: "Rust Programming"):
  "Master Rust's ownership model, lifetimes, and trait system to confidently
   write zero-cost abstractions and concurrent programs without data races."

Bad example:
  "Learn about Rust programming and its features."
  (Too vague — no concrete subtopics, no success criteria)
```

#### A2. Research Topic Generator

**File:** `intelligence-service/src/agents/research_topic_generator.py`

Changes:
- Replace fixed "4-8 key concepts" with dynamic range based on topic breadth: "Generate between 3 and 10 key concepts — use fewer for narrow topics, more for broad ones"
- Add quality criteria for each bullet:

```
For each concept:
- "text" should be a specific, well-scoped subtopic name (not "Introduction" or "Basics")
- "explanation" should be 1-2 sentences describing WHAT to learn and WHY it matters,
  not just "Learn about X". Bad: "Understanding closures." Good: "How closures capture
  variables from their enclosing scope, enabling callback patterns and data encapsulation."
- Children should represent genuinely distinct sub-concepts, not synonyms or rephrasing

Anti-patterns to avoid:
- Generic filler items like "Introduction", "Overview", "Advanced Topics", "Best Practices"
- Bullet text that restates the parent topic
- Explanations that are just the bullet text with "Learn about" prepended
- Overlapping concepts (e.g., "Error Handling" and "Exception Management" as siblings)
```

- Add instruction to check existing topics:

```
The cluster already contains these topics: {existing_topic_titles}
Do NOT duplicate concepts already covered. Focus on genuinely new ground.
```

- Add a chain-of-thought preamble:

```
Before generating the JSON, mentally:
1. Identify the 3 most important subtopics a practitioner must understand
2. Check which are already covered in existing neurons or topics
3. Order from foundational to advanced
Then produce the structured output.
```

#### A3. Research Topic Scorer

**File:** `intelligence-service/src/agents/research_topic_scorer.py`

Add calibration guidance:

```
Scoring calibration:
- "none": No neuron mentions this concept at all. Not even a passing reference.
- "partial": A neuron touches on this but doesn't explain it. E.g., the concept
  appears in a list or is mentioned as a prerequisite without elaboration.
- "good": At least one neuron explains this concept with examples or depth.
  The user could teach someone the basics from their notes.
- "complete": Multiple neurons cover this with depth, examples, edge cases,
  and connections to related concepts. Production-ready understanding.

When in doubt between two levels, choose the LOWER one — it's better to
motivate the user to study more than to give false confidence.

Only link a neuron_id if the neuron DIRECTLY discusses the bullet's concept.
Do not link neurons that merely mention a keyword in passing.
```

#### A4. Research Bullet Expander

**File:** `intelligence-service/src/agents/research_bullet_expander.py`

Add specificity requirements:

```
Each sub-point should be:
- Concrete enough that the user knows exactly what to study
- Distinct from siblings (no overlapping concepts)
- Ordered from foundational to advanced when a natural progression exists

Bad sub-points for "Memory Management":
  - "Understanding memory" (too vague)
  - "Memory concepts" (restates parent)
  - "Advanced memory topics" (filler)

Good sub-points for "Memory Management":
  - "Stack vs heap allocation and when each is used"
  - "Reference counting and its cycle problem"
  - "Mark-and-sweep garbage collection algorithm"
  - "Manual memory management with malloc/free and common pitfalls"
```

---

### B. LLM Configuration

**Priority: High | Complexity: Low | Impact: Medium**

#### B1. Per-Agent Temperature

**File:** `intelligence-service/src/config.py`

Add per-agent temperature settings:

```python
class Settings(BaseSettings):
    # ... existing fields ...

    # Per-agent LLM tuning
    temperature_goal_generator: float = 0.7      # creative, varied goals
    temperature_topic_generator: float = 0.4      # structured but not rigid
    temperature_topic_scorer: float = 0.1         # deterministic scoring
    temperature_bullet_expander: float = 0.4      # structured expansion
```

**File:** `intelligence-service/src/llm.py`

Update `get_llm()` to accept and pass `temperature`:

```python
def get_llm(temperature: float | None = None, **kwargs) -> BaseChatModel:
    # ... pass temperature to ChatOllama/ChatAnthropic constructors
```

**Files:** Each agent's `invoke_llm` function — pass the appropriate temperature:
```python
llm = get_llm(temperature=settings.temperature_topic_generator, format="json")
```

#### B2. Max Tokens Guard

For structured JSON output agents, set `max_tokens` to prevent truncated responses that break JSON parsing. Current failure mode: the LLM generates a valid start of JSON but hits its default token limit, producing unparseable output that falls through to the empty fallback.

Suggested limits:
- Goal generator: 256 tokens (short text output)
- Topic generator: 4096 tokens (complex nested JSON)
- Topic scorer: 4096 tokens (mirrors input size)
- Bullet expander: 2048 tokens (smaller scope)

---

### C. Context Enrichment

**Priority: High | Complexity: Medium | Impact: High**

#### C1. Increase Neuron Preview Length

**File:** `app/src/main/java/com/wliant/brainbook/service/ResearchAsyncService.java`

Change `CONTENT_PREVIEW_LENGTH` from 500 to 1500 for research agents. 500 characters is roughly 2-3 sentences — often not enough for the LLM to assess whether a concept is covered.

```java
private static final int CONTENT_PREVIEW_LENGTH = 1500;
```

This increases token usage per neuron but the next improvement (relevance filtering) compensates.

#### C2. Relevance-Based Neuron Filtering

**File:** `app/src/main/java/com/wliant/brainbook/service/ResearchAsyncService.java`

Instead of sending ALL neurons in the brain, filter to the most relevant ones:

**Phase 1 (keyword matching — no new dependencies):**
- Extract keywords from the topic prompt
- Score neurons by keyword overlap in title + contentText
- Send top 20 neurons instead of all

**Phase 2 (embedding similarity — uses existing embedding infrastructure):**
- Compute embedding of the topic prompt via `IntelligenceService.computeEmbedding()`
- Compare against neuron embeddings (requires storing embeddings — see `intelligence-service/src/embeddings.py`)
- Send top 20 by cosine similarity

This reduces noise, saves tokens, and improves scoring accuracy.

#### C3. Pass Existing Topic Titles

**File:** `app/src/main/java/com/wliant/brainbook/service/ResearchAsyncService.java`

When generating a new topic, include titles of existing topics in the same cluster:

```java
List<String> existingTopicTitles = researchTopicRepository
    .findByClusterIdOrderBySortOrder(clusterId).stream()
    .map(ResearchTopic::getTitle)
    .collect(Collectors.toList());
```

Pass as `existing_topics` in the context to the topic generator. The prompt (proposal A2) already instructs the LLM to avoid duplication.

**File:** `intelligence-service/src/schemas/research.py`

Add to `BrainContext`:
```python
class BrainContext(BaseModel):
    brain_name: str
    research_goal: str = ""
    neurons: list[NeuronSummary] = []
    existing_topic_titles: list[str] = []  # NEW
```

#### C4. Pass Tag Information

**File:** `app/src/main/java/com/wliant/brainbook/service/ResearchAsyncService.java`

Include neuron tags in summaries. Tags are compact (a few words each) and provide strong semantic signal at low token cost.

Add to `buildNeuronSummaries()`:
```java
List<String> tags = tagService.getTagsForNeuron(n.getId()).stream()
    .map(TagResponse::name).toList();
summary.put("tags", tags);
```

**File:** `intelligence-service/src/schemas/research.py`

Add to `NeuronSummary`:
```python
class NeuronSummary(BaseModel):
    neuron_id: str
    title: str
    content_preview: str = ""
    tags: list[str] = []  # NEW
```

---

### D. Multi-Step Generation with Self-Critique

**Priority: Medium | Complexity: Medium | Impact: High**

#### D1. Generate-Then-Critique for Topic Generator

**File:** `intelligence-service/src/agents/research_topic_generator.py`

Add a `self_critique` node to the LangGraph graph between `invoke_llm` and `validate_output`:

```
build_prompt → invoke_llm → self_critique → validate_output
```

The self-critique step:
1. Takes the raw LLM output
2. Sends it back to the LLM with a critique prompt:

```
Review this learning map for quality issues:
{generated_json}

Check for:
1. Vague or generic bullets (e.g., "Introduction", "Overview")
2. Overlapping concepts that should be merged
3. Missing obvious subtopics for this domain
4. Explanations that are too short or just restate the bullet text
5. Incorrect completeness assessments

If issues found, output a corrected version. If the map is good, output it unchanged.
Respond with the final JSON only.
```

This adds one extra LLM call but significantly improves output quality. The self-critique model can use a lower temperature (0.2) for more consistent evaluation.

#### D2. Deduplication Check

**File:** `intelligence-service/src/agents/research_topic_generator.py`

In the `validate_output` step, add programmatic deduplication:
- Check for bullets with >80% word overlap in `text` field
- Merge or flag duplicates before returning

This catches cases the LLM misses without requiring an extra LLM call.

---

### E. Output Quality Validation

**Priority: Medium | Complexity: Low | Impact: Medium**

#### E1. Semantic Quality Checks

**File:** `intelligence-service/src/agents/research_topic_generator.py` (and similar for other agents)

Add quality checks in `validate_output`:

```python
def validate_quality(items: list[dict]) -> list[str]:
    """Return list of quality warnings."""
    warnings = []

    for item in items:
        # Check for empty or too-short explanations
        explanation = item.get("explanation", "")
        if len(explanation) < 20:
            warnings.append(f"Bullet '{item.get('text', '')}' has a very short explanation")

        # Check for generic filler text
        filler_patterns = ["introduction to", "overview of", "basics of",
                          "advanced topics", "best practices", "getting started"]
        text_lower = item.get("text", "").lower()
        if any(text_lower.startswith(p) or text_lower == p for p in filler_patterns):
            warnings.append(f"Bullet '{item.get('text', '')}' appears to be generic filler")

        # Check for duplicate siblings
        # Check children recursively

    return warnings
```

When warnings exceed a threshold, log them and optionally trigger a re-generation with the warnings as feedback. For v1, just log warnings for observability.

#### E2. Minimum Viable Output

If the topic generator returns fewer than 3 items, or all explanations are empty, treat it as a generation failure rather than returning a low-quality result. Set the topic status to ERROR with a meaningful message.

---

### F. User Feedback Integration

**Priority: Medium | Complexity: Medium | Impact: Medium**

#### F1. Thumbs Up/Down on Topics

**New endpoint:** `POST /api/clusters/{clusterId}/research-topics/{id}/feedback`

```json
{ "rating": "positive" | "negative", "comment": "too generic" }
```

**Backend:** Store feedback in a new `research_topic_feedback` table. Use this data for:
- Analytics (which topics get poor ratings)
- Context for regeneration ("The user found the previous version too generic")

#### F2. Regenerate with Feedback

**New endpoint:** `POST /api/clusters/{clusterId}/research-topics/{id}/regenerate`

```json
{ "feedback": "Make it more specific to Spring Boot 3, not generic Java" }
```

Passes user feedback as additional context to the topic generator:

```
The user was not satisfied with the previous generation and provided this feedback:
"{feedback}"

Previous generation (for reference — do NOT repeat the same mistakes):
{previous_content_json}
```

**Files affected:**
- `app/src/main/java/com/wliant/brainbook/controller/ResearchTopicController.java` — new endpoints
- `app/src/main/java/com/wliant/brainbook/service/ResearchTopicService.java` — regeneration logic
- `intelligence-service/src/schemas/research.py` — add feedback fields to request
- `intelligence-service/src/agents/research_topic_generator.py` — incorporate feedback in prompt
- `web/src/components/research/ResearchTopicCard.tsx` — feedback UI
- `web/src/lib/hooks/useResearchTopics.ts` — new mutation
- `web/src/lib/api.ts` — new API calls
- Database migration for feedback table

---

### G. Scoring Improvements

**Priority: Medium | Complexity: Medium | Impact: Medium**

#### G1. Dedicated Scorer Context Window

The scorer needs MORE context per neuron than the generator, because it must determine coverage depth. Use 2000-char previews for the scorer specifically, even if the generator uses shorter previews.

**File:** `app/src/main/java/com/wliant/brainbook/service/ResearchAsyncService.java`

```java
List<Map<String, Object>> buildNeuronSummaries(UUID brainId, int previewLength) {
    // parameterize the preview length
}
```

Call with `buildNeuronSummaries(brainId, 2000)` for scoring, `buildNeuronSummaries(brainId, 1500)` for generation.

#### G2. Confidence Scores

**File:** `intelligence-service/src/schemas/research.py`

Add confidence to BulletItem:
```python
class BulletItem(BaseModel):
    # ... existing fields ...
    completeness_confidence: float = 1.0  # 0.0-1.0, how sure the scorer is
```

The scorer prompt should instruct: "For each bullet, also rate your confidence in the completeness assessment from 0.0 (guessing) to 1.0 (certain)."

Low-confidence scores surface in the UI as "uncertain" indicators, prompting the user to add more notes or verify manually.

#### G3. Incremental Scoring

When a single neuron is added or edited, only re-score bullets likely affected by that neuron rather than re-scoring the entire topic tree. This requires:
- Tracking which neuron_ids were used in the last scoring
- Comparing against changed neuron_ids
- Only sending affected bullets + the changed neuron to the scorer

This is a performance optimization that also improves quality by focusing the LLM's attention on the relevant subset.

---

## Prioritized Roadmap

| # | Proposal | Priority | Complexity | Impact | Key Files | Status |
|---|----------|----------|------------|--------|-----------|--------|
| A | Prompt Engineering | High | Low | High | `research_*.py` (4 agent files) | DONE |
| B1 | Per-Agent Temperature | High | Low | Medium | `config.py`, `llm.py`, 4 agent files | DONE |
| C3 | Pass Existing Topic Titles | High | Low | Medium | `ResearchAsyncService.java`, `research.py` | DONE |
| C4 | Pass Tag Information | High | Low | Medium | `ResearchAsyncService.java`, `research.py` | DONE |
| C1 | Increase Preview Length | High | Low | Medium | `ResearchAsyncService.java` | DONE |
| B2 | Max Tokens Guard | High | Low | Low | `config.py`, 4 agent files | DONE |
| E1 | Semantic Quality Checks | Medium | Low | Medium | `research_topic_generator.py` | DONE |
| E2 | Minimum Viable Output | Medium | Low | Low | `research_topic_generator.py` | DONE |
| D1 | Self-Critique Step | Medium | Medium | High | `research_topic_generator.py` | DONE |
| D2 | Deduplication Check | Medium | Low | Low | `research_topic_generator.py` | DONE |
| G1 | Dedicated Scorer Context | Medium | Low | Medium | `ResearchAsyncService.java` | DONE |
| C2 | Relevance-Based Filtering | Medium | Medium | High | `ResearchAsyncService.java`, embeddings | |
| G2 | Confidence Scores | Medium | Medium | Medium | `research.py`, scorer agent, frontend | |
| F1 | Thumbs Up/Down | Medium | Medium | Medium | Full stack (DB, backend, frontend) | |
| F2 | Regenerate with Feedback | Medium | Medium | Medium | Full stack | |
| G3 | Incremental Scoring | Lower | High | Low | `ResearchAsyncService.java`, scorer agent | |

**Recommended implementation order:** A → B1 → C3+C4 → C1 → B2 → E1 → D1 → C2 → F1+F2 → G

The first six items (A through B2) are all low-complexity prompt and config changes that can ship together as a single quality pass. The self-critique step (D1) is the single highest-impact architectural change and should follow promptly. Context enrichment (C2) and feedback (F) are larger efforts that can be phased in over subsequent iterations.
