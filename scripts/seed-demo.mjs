#!/usr/bin/env node
/**
 * Seeds BrainBook with demo data for README screenshots.
 * Usage: node scripts/seed-demo.mjs
 */

const API = "http://localhost:8080";

async function api(method, path, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${method} ${path} => ${res.status}: ${text}`);
  }
  const ct = res.headers.get("content-type") || "";
  return ct.includes("json") ? res.json() : null;
}

function uuid() {
  return crypto.randomUUID();
}

function richText(...paragraphs) {
  return {
    type: "doc",
    content: paragraphs.map((p) => ({
      type: "paragraph",
      content: [{ type: "text", text: p }],
    })),
  };
}

function sections(items) {
  return JSON.stringify({
    version: 2,
    sections: items.map((item, i) => ({ id: uuid(), order: i, ...item })),
  });
}

function plainText(...parts) {
  return parts.join("\n");
}

// ─── Section builders ─────────────────────────────────────────────────────────

function rtSection(text) {
  return {
    type: "rich-text",
    content: richText(text),
    meta: {},
  };
}

function rtSectionMulti(...paragraphs) {
  return {
    type: "rich-text",
    content: richText(...paragraphs),
    meta: {},
  };
}

function calloutSection(variant, text) {
  return { type: "callout", content: { variant, text }, meta: {} };
}

function codeSection(language, code) {
  return { type: "code", content: { language, code }, meta: {} };
}

function tableSection(headers, rows) {
  return { type: "table", content: { headers, rows }, meta: {} };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("Creating tags...");
  const tagNames = ["java", "system-design", "algorithms", "spring", "concurrency", "python"];
  const tagMap = {};
  const existingTags = await api("GET", "/api/tags");
  for (const t of existingTags) tagMap[t.name] = t.id;
  for (const name of tagNames) {
    if (tagMap[name]) {
      console.log(`  Tag (existing): ${name} (${tagMap[name]})`);
      continue;
    }
    const tag = await api("POST", "/api/tags", { name, color: tagColor(name) });
    tagMap[name] = tag.id;
    console.log(`  Tag: ${name} (${tag.id})`);
  }

  console.log("\nCreating brain...");
  const brain = await api("POST", "/api/brains", {
    name: "Software Engineering Notes",
    description: "My personal technical knowledge base — system design, Java, and algorithms",
    color: "#6366f1",
    icon: "BookOpen",
  });
  // Associate brain-level tags
  for (const t of ["java", "system-design", "algorithms"]) {
    await api("POST", `/api/tags/brains/${brain.id}/tags/${tagMap[t]}`);
  }
  console.log(`  Brain: ${brain.id}`);

  // ─── Cluster 1: System Design ───────────────────────────────────────────────
  console.log("\nCreating Cluster: System Design...");
  const c1 = await api("POST", "/api/clusters", {
    brainId: brain.id,
    name: "System Design",
    type: "knowledge",
    sortOrder: 0,
  });

  const capNeuron = await api("POST", "/api/neurons", {
    brainId: brain.id,
    clusterId: c1.id,
    title: "CAP Theorem",
    contentJson: sections([
      rtSectionMulti(
        "The CAP theorem, formulated by Eric Brewer, states that a distributed system can guarantee at most two of three properties simultaneously: Consistency, Availability, and Partition Tolerance.",
        "Consistency means every read receives the most recent write. Availability guarantees every request receives a response. Partition Tolerance means the system continues operating even when network partitions occur between nodes."
      ),
      calloutSection(
        "info",
        "In practice, partition tolerance is non-negotiable in distributed systems. Network partitions always happen eventually. You are really choosing between Consistency (CP) and Availability (AP)."
      ),
      tableSection(
        ["Property", "CP Systems", "AP Systems"],
        [
          ["Consistency", "Strong (linearizable)", "Eventual"],
          ["Availability", "May reject requests", "Always responds"],
          ["Examples", "HBase, Zookeeper, etcd", "Cassandra, DynamoDB, CouchDB"],
          ["Use when", "Financial transactions, config", "Shopping carts, DNS, social feeds"],
        ]
      ),
      rtSection(
        "Choose CP when data correctness is critical — banking, inventory counts, leader election. Choose AP when availability matters more — user sessions, analytics, recommendation engines."
      ),
    ]),
    contentText: plainText(
      "CAP Theorem: Consistency, Availability, Partition Tolerance",
      "CP Systems: HBase, Zookeeper. AP Systems: Cassandra, DynamoDB"
    ),
  });
  await api("POST", `/api/tags/neurons/${capNeuron.id}/tags/${tagMap["system-design"]}`);
  console.log(`  Neuron: CAP Theorem (${capNeuron.id})`);

  const hashNeuron = await api("POST", "/api/neurons", {
    brainId: brain.id,
    clusterId: c1.id,
    title: "Consistent Hashing",
    contentJson: sections([
      rtSectionMulti(
        "Naive modulo-based sharding (node = hash(key) % N) breaks when nodes are added or removed — almost every key remaps to a different node, causing a thundering herd of cache misses and expensive data migrations.",
        "Consistent hashing maps both keys and nodes onto a circular ring using the same hash function. A key is assigned to the first node clockwise from its position on the ring. When a node is added or removed, only the keys between the new/removed node and its predecessor need to be remapped — roughly 1/N of all keys."
      ),
      codeSection(
        "text",
        `                    Node A (hash=10)
                   /
  Ring: 0 ──────10──────50──────80──── 100 (wraps)
                          \\             /
                        Node B (hash=50)   Node C (hash=80)

  Key "user:42" → hash=35 → assigned to Node B (next clockwise)
  Key "user:99" → hash=95 → wraps around → assigned to Node A

  Add Node D at hash=65:
    Only keys in range (50, 65] move from Node B → Node D`
      ),
      rtSectionMulti(
        "Virtual nodes (vnodes) solve the uneven distribution problem. Each physical node is represented by multiple points on the ring (e.g., 150 virtual nodes per physical node). This distributes load evenly and makes the rebalancing on node addition/removal smoother.",
        "Replication factor R means each key is stored on the next R nodes clockwise. In Cassandra, the coordinator writes to all R replicas; consistency level controls how many acknowledgements are required."
      ),
      calloutSection(
        "tip",
        "Most distributed caches and databases use consistent hashing internally: Redis Cluster (16,384 hash slots), Cassandra (vnodes), Amazon DynamoDB, and Memcached client libraries all rely on variants of this algorithm."
      ),
    ]),
    contentText: plainText("Consistent Hashing", "Ring-based sharding, virtual nodes, replication"),
  });
  await api("POST", `/api/tags/neurons/${hashNeuron.id}/tags/${tagMap["system-design"]}`);
  console.log(`  Neuron: Consistent Hashing (${hashNeuron.id})`);

  const rateLimitNeuron = await api("POST", "/api/neurons", {
    brainId: brain.id,
    clusterId: c1.id,
    title: "Rate Limiting Patterns",
    contentJson: sections([
      rtSectionMulti(
        "Rate limiting protects services from abuse, prevents resource exhaustion, and ensures fair usage across clients. It sits at the API gateway, reverse proxy, or application layer.",
        "Choosing the right algorithm depends on your burst tolerance, accuracy requirements, and implementation complexity. Here's a comparison of the four most common approaches:"
      ),
      tableSection(
        ["Algorithm", "Burst Allowed", "Memory", "Pros", "Cons"],
        [
          ["Token Bucket", "Yes (up to bucket size)", "O(1) per user", "Simple, allows bursts", "Burst can still overwhelm"],
          ["Leaky Bucket", "No (smoothed output)", "O(1) per user", "Smooth traffic shaping", "Drops bursts; queue adds latency"],
          ["Fixed Window Counter", "2× at boundary", "O(1) per user", "Very simple", "Double-burst at window edge"],
          ["Sliding Window Log", "No", "O(requests/window)", "Most accurate", "High memory for many users"],
        ]
      ),
      codeSection(
        "python",
        `import time
from threading import Lock

class TokenBucket:
    """Thread-safe token bucket rate limiter."""

    def __init__(self, capacity: int, refill_rate: float):
        """
        capacity    – max tokens (burst size)
        refill_rate – tokens added per second
        """
        self.capacity = capacity
        self.tokens = capacity
        self.refill_rate = refill_rate
        self.last_refill = time.monotonic()
        self._lock = Lock()

    def allow(self, tokens: int = 1) -> bool:
        with self._lock:
            self._refill()
            if self.tokens >= tokens:
                self.tokens -= tokens
                return True
            return False

    def _refill(self):
        now = time.monotonic()
        elapsed = now - self.last_refill
        self.tokens = min(self.capacity, self.tokens + elapsed * self.refill_rate)
        self.last_refill = now


# Usage: 100 req/s with burst up to 200
limiter = TokenBucket(capacity=200, refill_rate=100)
if not limiter.allow():
    raise Exception("429 Too Many Requests")`
      ),
      calloutSection(
        "warning",
        "Fixed window counters allow up to 2× the rate limit in a short burst. If your limit is 100 req/min, a client can send 100 requests at 00:59 and 100 more at 01:00 — 200 requests in 2 seconds. Use sliding window log or sliding window counter for strict enforcement."
      ),
    ]),
    contentText: plainText("Rate Limiting Patterns", "Token Bucket, Leaky Bucket, Fixed Window, Sliding Window"),
  });
  await api("POST", `/api/tags/neurons/${rateLimitNeuron.id}/tags/${tagMap["system-design"]}`);
  console.log(`  Neuron: Rate Limiting Patterns (${rateLimitNeuron.id})`);

  // Link CAP Theorem ↔ Consistent Hashing
  await api("POST", "/api/neuron-links", {
    sourceNeuronId: capNeuron.id,
    targetNeuronId: hashNeuron.id,
    linkType: "RELATED_TO",
    weight: 1,
  });
  // Link Rate Limiting → CAP Theorem
  await api("POST", "/api/neuron-links", {
    sourceNeuronId: rateLimitNeuron.id,
    targetNeuronId: capNeuron.id,
    linkType: "REFERENCES",
    weight: 1,
  });
  console.log("  Links created");

  // ─── Cluster 2: Java & Spring Boot ──────────────────────────────────────────
  console.log("\nCreating Cluster: Java & Spring Boot...");
  const c2 = await api("POST", "/api/clusters", {
    brainId: brain.id,
    name: "Java & Spring Boot",
    type: "knowledge",
    sortOrder: 1,
  });

  const vtNeuron = await api("POST", "/api/neurons", {
    brainId: brain.id,
    clusterId: c2.id,
    title: "Virtual Threads in Java 21",
    contentJson: sections([
      rtSectionMulti(
        "Traditional platform threads map 1:1 to OS threads. Each thread consumes ~1 MB of stack memory, and context switching between thousands of threads creates significant CPU overhead. A typical JVM process tops out at ~10,000 concurrent threads before performance degrades.",
        "Project Loom, shipped in Java 21, introduces virtual threads — lightweight threads managed by the JVM, not the OS. They are mounted onto carrier (platform) threads only when actively executing CPU work; during I/O blocking they unmount, freeing the carrier thread for other virtual threads."
      ),
      codeSection(
        "java",
        `// Before Java 21 — bounded thread pool
ExecutorService pool = Executors.newFixedThreadPool(200);
for (int i = 0; i < 10_000; i++) {
    pool.submit(() -> {
        Thread.sleep(Duration.ofMillis(100)); // blocks carrier thread!
        return callExternalService();
    });
}

// Java 21 — virtual thread per task (scales to millions)
try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
    for (int i = 0; i < 10_000; i++) {
        executor.submit(() -> {
            Thread.sleep(Duration.ofMillis(100)); // unmounts, doesn't block!
            return callExternalService();
        });
    }
}

// Spring Boot 3.2+ — enable in application.properties
// spring.threads.virtual.enabled=true`
      ),
      calloutSection(
        "info",
        "Virtual threads are not faster — they are cheaper. Code running on a virtual thread executes at the same speed as platform thread code. The benefit is that you can run 1,000,000 virtual threads where previously you were limited to ~10,000 platform threads."
      ),
      tableSection(
        ["Aspect", "Platform Thread", "Virtual Thread"],
        [
          ["Memory per thread", "~1 MB stack", "~few KB (grows on demand)"],
          ["Creation cost", "Expensive (OS syscall)", "Cheap (JVM managed)"],
          ["Max concurrent", "~10K before degradation", "Millions"],
          ["Best for", "CPU-bound tasks", "I/O-bound tasks (DB, HTTP, files)"],
          ["Pinning risk", "N/A", "Avoid synchronized blocks over I/O"],
        ]
      ),
    ]),
    contentText: plainText("Virtual Threads in Java 21", "Project Loom, lightweight threads, I/O concurrency"),
  });
  await api("POST", `/api/tags/neurons/${vtNeuron.id}/tags/${tagMap["java"]}`);
  await api("POST", `/api/tags/neurons/${vtNeuron.id}/tags/${tagMap["concurrency"]}`);
  console.log(`  Neuron: Virtual Threads (${vtNeuron.id})`);

  const sbNeuron = await api("POST", "/api/neurons", {
    brainId: brain.id,
    clusterId: c2.id,
    title: "Spring Boot Auto-Configuration",
    contentJson: sections([
      rtSectionMulti(
        "@SpringBootApplication includes @EnableAutoConfiguration, which triggers Spring Boot's auto-configuration mechanism. At startup, Spring scans for all META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports files on the classpath and evaluates each listed configuration class.",
        "Each auto-configuration class is annotated with @ConditionalOn* annotations that check if specific classes are present on the classpath, if beans are missing, or if properties are set. Only matching configurations are applied, keeping the context lean."
      ),
      codeSection(
        "java",
        `// Custom auto-configuration — provides a default DataSource bean
// only when no DataSource is already defined

@AutoConfiguration
@ConditionalOnClass(DataSource.class)          // only if JDBC is on classpath
@ConditionalOnMissingBean(DataSource.class)    // only if no custom DataSource
@EnableConfigurationProperties(DbProperties.class)
public class CustomDataSourceAutoConfiguration {

    @Bean
    public DataSource dataSource(DbProperties props) {
        return DataSourceBuilder.create()
            .url(props.getUrl())
            .username(props.getUsername())
            .password(props.getPassword())
            .build();
    }
}

// Register in: src/main/resources/META-INF/spring/
// org.springframework.boot.autoconfigure.AutoConfiguration.imports
// com.example.CustomDataSourceAutoConfiguration`
      ),
      codeSection(
        "bash",
        `# See which auto-configurations were applied (matched) and which were skipped
./gradlew bootRun --args='--debug' 2>&1 | grep -E "Did match|Did not match"

# Or hit the actuator endpoint (add spring-boot-starter-actuator)
curl http://localhost:8080/actuator/conditions | jq '.positiveMatches | keys'`
      ),
      calloutSection(
        "tip",
        "Use @SpringBootTest(webEnvironment = WebEnvironment.RANDOM_PORT) in integration tests to avoid port conflicts when running tests in parallel. Inject the port with @LocalServerPort and build URLs dynamically."
      ),
    ]),
    contentText: plainText("Spring Boot Auto-Configuration", "@EnableAutoConfiguration, @ConditionalOn*, custom auto-config"),
  });
  await api("POST", `/api/tags/neurons/${sbNeuron.id}/tags/${tagMap["java"]}`);
  await api("POST", `/api/tags/neurons/${sbNeuron.id}/tags/${tagMap["spring"]}`);
  console.log(`  Neuron: Spring Boot Auto-Config (${sbNeuron.id})`);

  // ─── Cluster 3: Algorithm Patterns (AI Research) ────────────────────────────
  console.log("\nCreating Cluster: Algorithm Patterns (AI Research)...");
  const c3 = await api("POST", "/api/clusters", {
    brainId: brain.id,
    name: "Algorithm Patterns",
    type: "ai-research",
    sortOrder: 2,
    description: "Master the core algorithmic patterns for technical interviews — understand when and why to apply each pattern",
  });

  const tpNeuron = await api("POST", "/api/neurons", {
    brainId: brain.id,
    clusterId: c3.id,
    title: "Two Pointers",
    contentJson: sections([
      rtSectionMulti(
        "The two-pointer technique uses two indices to traverse a data structure — usually an array or string — in a single pass. This reduces a naive O(n²) brute-force to O(n) time by exploiting sorted order or structural symmetry.",
        "Common trigger signals: the problem involves a sorted array, asks for pairs/triplets summing to a target, or requires palindrome detection. If you see 'sorted' + 'pairs' or 'in-place removal', reach for two pointers first."
      ),
      codeSection(
        "python",
        `def two_sum_sorted(nums: list[int], target: int) -> tuple[int, int]:
    """Find indices of two numbers that sum to target in a sorted array."""
    left, right = 0, len(nums) - 1

    while left < right:
        total = nums[left] + nums[right]
        if total == target:
            return (left, right)
        elif total < target:
            left += 1   # need a larger sum → move left pointer right
        else:
            right -= 1  # need a smaller sum → move right pointer left

    return (-1, -1)  # no solution found


def remove_duplicates(nums: list[int]) -> int:
    """Remove duplicates in-place from sorted array. Returns new length."""
    if not nums:
        return 0

    slow = 0  # slow pointer marks the boundary of unique elements

    for fast in range(1, len(nums)):
        if nums[fast] != nums[slow]:  # found a new unique element
            slow += 1
            nums[slow] = nums[fast]

    return slow + 1  # length of deduplicated array


def is_palindrome(s: str) -> bool:
    """Check if a string is a palindrome using two pointers."""
    left, right = 0, len(s) - 1
    while left < right:
        if s[left] != s[right]:
            return False
        left += 1
        right -= 1
    return True`
      ),
      calloutSection(
        "tip",
        "Recognition heuristic: sorted array + find pair/triplet → two pointers. Unsorted array + find pair → use a hash set instead. If the problem says 'in-place' with O(1) space, two pointers is almost always the answer."
      ),
    ]),
    contentText: plainText("Two Pointers", "Sorted array, pair sum, palindrome, O(n) traversal"),
  });
  await api("POST", `/api/tags/neurons/${tpNeuron.id}/tags/${tagMap["algorithms"]}`);
  await api("POST", `/api/tags/neurons/${tpNeuron.id}/tags/${tagMap["python"]}`);
  console.log(`  Neuron: Two Pointers (${tpNeuron.id})`);

  const swNeuron = await api("POST", "/api/neurons", {
    brainId: brain.id,
    clusterId: c3.id,
    title: "Sliding Window",
    contentJson: sections([
      rtSectionMulti(
        "The sliding window technique maintains a contiguous sub-array or substring as a 'window' that moves across the input. It converts O(n²) nested-loop solutions into O(n) by reusing computation from the previous window position instead of restarting from scratch.",
        "Fixed window: the window size is constant — useful for 'max sum of K elements'. Variable window: the window expands and contracts based on a constraint — useful for 'longest substring without repeating characters' or 'minimum window covering all characters'."
      ),
      codeSection(
        "python",
        `def max_sum_fixed_window(nums: list[int], k: int) -> int:
    """Maximum sum of any contiguous subarray of size k — O(n)."""
    window_sum = sum(nums[:k])
    max_sum = window_sum

    for i in range(k, len(nums)):
        window_sum += nums[i] - nums[i - k]  # slide: add new, remove old
        max_sum = max(max_sum, window_sum)

    return max_sum


def longest_unique_substring(s: str) -> int:
    """Longest substring without repeating characters — O(n)."""
    char_index: dict[str, int] = {}
    left = 0
    max_len = 0

    for right, char in enumerate(s):
        if char in char_index and char_index[char] >= left:
            # Shrink window: move left past the previous occurrence
            left = char_index[char] + 1

        char_index[char] = right
        max_len = max(max_len, right - left + 1)

    return max_len


# Example:
# max_sum_fixed_window([2, 1, 5, 1, 3, 2], k=3) → 9  (subarray [5,1,3])
# longest_unique_substring("abcabcbb") → 3             (substring "abc")`
      ),
      tableSection(
        ["Problem Type", "Window Type", "Expand When", "Shrink When"],
        [
          ["Max sum of K elements", "Fixed", "Always slide by 1", "After reaching size K"],
          ["Longest valid substring", "Variable", "Move right pointer", "Constraint violated"],
          ["Minimum covering window", "Variable", "Right until covered", "Left to minimize"],
          ["Count of subarrays with property", "Variable", "Right pointer", "Condition exceeded"],
        ]
      ),
      calloutSection(
        "tip",
        "If shrinking the window from the left still satisfies the constraint, the window is variable. If you always process exactly K elements, it's fixed. Variable window problems often involve a frequency map or running sum to track the current window's state."
      ),
    ]),
    contentText: plainText("Sliding Window", "Fixed window, variable window, max sum, longest substring"),
  });
  await api("POST", `/api/tags/neurons/${swNeuron.id}/tags/${tagMap["algorithms"]}`);
  await api("POST", `/api/tags/neurons/${swNeuron.id}/tags/${tagMap["python"]}`);
  console.log(`  Neuron: Sliding Window (${swNeuron.id})`);

  // Link Sliding Window → Two Pointers
  await api("POST", "/api/neuron-links", {
    sourceNeuronId: swNeuron.id,
    targetNeuronId: tpNeuron.id,
    linkType: "RELATED_TO",
    weight: 1,
  });
  console.log("  Link: Sliding Window → Two Pointers");

  // ─── Post-seed actions ───────────────────────────────────────────────────────
  console.log("\nSetting favorites, pins, and spaced repetition...");

  await api("POST", `/api/neurons/${capNeuron.id}/favorite`);
  await api("POST", `/api/neurons/${vtNeuron.id}/favorite`);
  console.log("  Favorited: CAP Theorem, Virtual Threads");

  await api("POST", `/api/neurons/${rateLimitNeuron.id}/pin`);
  console.log("  Pinned: Rate Limiting Patterns");

  for (const neuronId of [capNeuron.id, vtNeuron.id, tpNeuron.id]) {
    try {
      await api("POST", `/api/spaced-repetition/items/${neuronId}`);
    } catch (e) {
      console.warn(`  Warning: could not add spaced repetition for ${neuronId}: ${e.message}`);
    }
  }
  console.log("  Spaced repetition enabled: CAP Theorem, Virtual Threads, Two Pointers");

  // ─── Summary ─────────────────────────────────────────────────────────────────
  console.log("\n=== Seed complete ===");
  console.log(`Brain ID:   ${brain.id}`);
  console.log(`Cluster 1:  ${c1.id}  (System Design)`);
  console.log(`Cluster 2:  ${c2.id}  (Java & Spring Boot)`);
  console.log(`Cluster 3:  ${c3.id}  (Algorithm Patterns)`);
  console.log("\nNeuron IDs:");
  console.log(`  CAP Theorem:              ${capNeuron.id}`);
  console.log(`  Consistent Hashing:       ${hashNeuron.id}`);
  console.log(`  Rate Limiting Patterns:   ${rateLimitNeuron.id}`);
  console.log(`  Virtual Threads:          ${vtNeuron.id}`);
  console.log(`  Spring Auto-Config:       ${sbNeuron.id}`);
  console.log(`  Two Pointers:             ${tpNeuron.id}`);
  console.log(`  Sliding Window:           ${swNeuron.id}`);
}

function tagColor(name) {
  const colors = {
    java: "#f97316",
    "system-design": "#6366f1",
    algorithms: "#22c55e",
    spring: "#84cc16",
    concurrency: "#f59e0b",
    python: "#3b82f6",
  };
  return colors[name] || "#64748b";
}

main().catch((e) => {
  console.error("Seed failed:", e);
  process.exit(1);
});
