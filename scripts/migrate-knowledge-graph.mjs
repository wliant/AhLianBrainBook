#!/usr/bin/env node
/**
 * Migrates an "Understand Anything" knowledge graph into BrainBook.
 *
 * Usage:
 *   node scripts/migrate-knowledge-graph.mjs \
 *     --graph-url "http://127.0.0.1:5173/knowledge-graph.json?token=TOKEN" \
 *     --api-url "http://localhost:8080"
 */

const GRAPH_URL =
  process.argv.includes("--graph-url")
    ? process.argv[process.argv.indexOf("--graph-url") + 1]
    : "http://127.0.0.1:5173/knowledge-graph.json?token=f1f58a65bcedb68bc200381d113243ff";

const API_URL =
  process.argv.includes("--api-url")
    ? process.argv[process.argv.indexOf("--api-url") + 1]
    : "http://localhost:8080";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function uuid() {
  return crypto.randomUUID();
}

async function api(method, path, body) {
  const opts = {
    method,
    headers: { "Content-Type": "application/json" },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${API_URL}${path}`, opts);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${method} ${path} => ${res.status}: ${text}`);
  }
  const ct = res.headers.get("content-type") || "";
  return ct.includes("json") ? res.json() : null;
}

function richTextSection(order, text) {
  return {
    id: uuid(),
    type: "rich-text",
    order,
    content: {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text }] }],
    },
    meta: {},
  };
}

function codeSection(order, code, language = "text") {
  return { id: uuid(), type: "code", order, content: { code, language }, meta: {} };
}

function calloutSection(order, variant, text) {
  return { id: uuid(), type: "callout", order, content: { variant, text }, meta: {} };
}

function tableSection(order, headers, rows) {
  return { id: uuid(), type: "table", order, content: { headers, rows }, meta: {} };
}

function diagramSection(order, source) {
  return {
    id: uuid(),
    type: "diagram",
    order,
    content: { source, diagramType: "mermaid" },
    meta: {},
  };
}

function buildSectionsDoc(sections) {
  return JSON.stringify({ version: 2, sections });
}

function extractPlainText(node) {
  const parts = [node.name || ""];
  if (node.summary) parts.push(node.summary);
  if (node.path) parts.push(node.path);
  if (node.complexity) parts.push(`Complexity: ${node.complexity}`);
  if (node.tags?.length) parts.push(`Tags: ${node.tags.join(", ")}`);
  if (node.metrics) {
    parts.push(`Lines: ${node.metrics.totalLines || 0}`);
  }
  return parts.join("\n");
}

function buildNodeSections(node) {
  const sections = [];
  let order = 0;

  // Summary
  if (node.summary) {
    sections.push(richTextSection(order++, node.summary));
  }

  // File path
  if (node.path) {
    sections.push(codeSection(order++, node.path, node.language || "text"));
  }

  // Metadata callout
  const metaParts = [`Type: ${node.type}`];
  if (node.complexity) metaParts.push(`Complexity: ${node.complexity}`);
  if (node.metrics?.totalLines) metaParts.push(`Lines: ${node.metrics.totalLines}`);
  if (node.metrics?.functionCount) metaParts.push(`Functions: ${node.metrics.functionCount}`);
  if (node.metrics?.classCount) metaParts.push(`Classes: ${node.metrics.classCount}`);
  if (node.startLine != null) metaParts.push(`Lines ${node.startLine}-${node.endLine}`);
  sections.push(calloutSection(order++, "info", metaParts.join(" | ")));

  // Tags table
  if (node.tags?.length) {
    sections.push(
      tableSection(order++, ["Tag"], node.tags.map((t) => [t]))
    );
  }

  // Class methods/properties
  if (node.type === "class") {
    if (node.methods?.length) {
      sections.push(
        tableSection(order++, ["Method"], node.methods.map((m) => [m]))
      );
    }
    if (node.properties?.length) {
      sections.push(
        tableSection(order++, ["Property"], node.properties.map((p) => [p]))
      );
    }
  }

  return sections;
}

// ---------------------------------------------------------------------------
// Domain-based sub-cluster mapping for Backend API files
// ---------------------------------------------------------------------------

const BACKEND_DOMAIN_MAP = {
  finance: "Finance",
  menu: "Menu",
  orders: "Orders",
  promotions: "Promotions",
  operating_hours: "Operating Hours",
  inventory: "Inventory",
  settings: "Settings",
  staff: "Staff",
  storage: "Storage",
  public: "Public API",
  core: "Core",
};

function detectBackendDomain(nodePath) {
  if (!nodePath) return null;
  // Match patterns like backend/src/finance/ or backend/src/core/
  const match = nodePath.match(/backend\/src\/(\w+)\//);
  if (match && BACKEND_DOMAIN_MAP[match[1]]) return match[1];
  // main.py is in the root
  if (nodePath.includes("backend/src/main.py")) return "core";
  return null;
}

// ---------------------------------------------------------------------------
// Main migration
// ---------------------------------------------------------------------------

async function main() {
  console.log("Fetching knowledge graph...");
  const res = await fetch(GRAPH_URL);
  if (!res.ok) throw new Error(`Failed to fetch graph: ${res.status}`);
  const graph = await res.json();

  const nodes = graph.nodes || [];
  const edges = graph.edges || [];
  const layers = graph.layers || [];
  const tour = Array.isArray(graph.tour) ? graph.tour : [];
  const project = graph.project || {};

  console.log(
    `Graph: ${nodes.length} nodes, ${edges.length} edges, ${layers.length} layers, ${tour.length} tour steps`
  );

  // Step 1: Create Brain
  console.log("\n--- Step 1: Create Brain ---");
  const brain = await api("POST", "/api/brains", {
    name: "Alcafe-ERP",
    description: project.description || "A monorepo ERP system for cafe management",
  });
  const brainId = brain.id;
  console.log(`Brain created: ${brainId}`);

  // Step 2: Create top-level clusters
  console.log("\n--- Step 2: Create top-level clusters ---");
  const clusterMap = {}; // layer-id -> clusterId

  // Project Overview + Architecture Tour are special clusters
  const overviewCluster = await api("POST", "/api/clusters", {
    brainId,
    name: "Project Overview",
    sortOrder: 0,
  });
  console.log(`  Cluster: Project Overview (${overviewCluster.id})`);

  const layerOrder = [
    "layer:infrastructure-tooling",
    "layer:data-persistence",
    "layer:backend-api",
    "layer:frontend-admin",
    "layer:storefront",
    "layer:tests",
  ];

  for (let i = 0; i < layers.length; i++) {
    const layer = layers[i];
    const cluster = await api("POST", "/api/clusters", {
      brainId,
      name: layer.name,
      sortOrder: i + 1,
    });
    clusterMap[layer.id] = cluster.id;
    console.log(`  Cluster: ${layer.name} (${cluster.id})`);
  }

  const tourCluster = await api("POST", "/api/clusters", {
    brainId,
    name: "Architecture Tour",
    sortOrder: layers.length + 1,
  });
  console.log(`  Cluster: Architecture Tour (${tourCluster.id})`);

  // Step 3: Create Backend API sub-clusters
  console.log("\n--- Step 3: Create Backend API sub-clusters ---");
  const backendClusterId = clusterMap["layer:backend-api"];
  const subClusterMap = {}; // domain-key -> clusterId

  if (backendClusterId) {
    const domains = Object.entries(BACKEND_DOMAIN_MAP);
    for (let i = 0; i < domains.length; i++) {
      const [key, name] = domains[i];
      const sub = await api("POST", "/api/clusters", {
        brainId,
        name,
        parentClusterId: backendClusterId,
        sortOrder: i,
      });
      subClusterMap[key] = sub.id;
      console.log(`  Sub-cluster: ${name} (${sub.id})`);
    }
  }

  // Step 4: Create tags
  console.log("\n--- Step 4: Create tags ---");
  const allTags = new Set();
  for (const node of nodes) {
    if (node.tags) node.tags.forEach((t) => allTags.add(t));
  }

  // Also get existing tags to avoid duplicates
  const existingTags = await api("GET", "/api/tags");
  const tagNameToId = {};
  for (const t of existingTags) {
    tagNameToId[t.name] = t.id;
  }

  for (const tagName of allTags) {
    if (!tagNameToId[tagName]) {
      try {
        const tag = await api("POST", "/api/tags", { name: tagName });
        tagNameToId[tagName] = tag.id;
      } catch (e) {
        // Tag may already exist
        const search = await api("GET", `/api/tags/search?q=${encodeURIComponent(tagName)}`);
        const match = search.find((t) => t.name === tagName);
        if (match) tagNameToId[tagName] = match.id;
      }
    }
  }
  console.log(`  Created/found ${Object.keys(tagNameToId).length} tags`);

  // Build layer membership lookup: nodeId -> layerId
  const nodeToLayer = {};
  for (const layer of layers) {
    for (const nid of layer.nodeIds || []) {
      nodeToLayer[nid] = layer.id;
    }
  }

  // Step 5: Create neurons
  console.log("\n--- Step 5: Create neurons ---");
  const nodeIdToNeuronId = {}; // graph node id -> brainbook neuron id
  let created = 0;
  let skipped = 0;

  for (const node of nodes) {
    const layerId = nodeToLayer[node.id];
    let clusterId = clusterMap[layerId];

    // For Backend API nodes, try to place in sub-cluster
    if (layerId === "layer:backend-api") {
      const domain = detectBackendDomain(node.path || node.filePath);
      if (domain && subClusterMap[domain]) {
        clusterId = subClusterMap[domain];
      }
    }

    // Nodes not in any layer go to Project Overview
    if (!clusterId) {
      clusterId = overviewCluster.id;
    }

    const sections = buildNodeSections(node);
    const contentJson = buildSectionsDoc(sections);
    const contentText = extractPlainText(node);

    try {
      const neuron = await api("POST", "/api/neurons", {
        title: node.name || node.id,
        brainId,
        clusterId,
        contentJson,
        contentText,
      });
      nodeIdToNeuronId[node.id] = neuron.id;
      created++;

      // Associate tags
      if (node.tags) {
        for (const tagName of node.tags) {
          const tagId = tagNameToId[tagName];
          if (tagId) {
            try {
              await api("POST", `/api/tags/neurons/${neuron.id}/tags/${tagId}`);
            } catch {
              // ignore duplicate tag association
            }
          }
        }
      }

      if (created % 50 === 0) console.log(`  ... ${created} neurons created`);
    } catch (e) {
      console.error(`  Failed to create neuron for ${node.id}: ${e.message}`);
      skipped++;
    }
  }
  console.log(`  Created ${created} neurons, skipped ${skipped}`);

  // Step 6: Create Project Overview neuron
  console.log("\n--- Step 6: Create Project Overview neuron ---");
  const languages = (project.languages || []).join(", ");
  const frameworks = (project.frameworks || []).join(", ");

  const fileCount = nodes.filter((n) => n.type === "file").length;
  const funcCount = nodes.filter((n) => n.type === "function").length;
  const classCount = nodes.filter((n) => n.type === "class").length;

  const mermaidDiagram = `graph TD
    A[Infrastructure & Tooling<br/>25 files] --> B[Data & Persistence<br/>31 files]
    B --> C[Backend API<br/>54 files]
    C --> D[Frontend Admin<br/>67 files]
    C --> E[Storefront<br/>28 files]
    C --> F[Tests<br/>90 files]`;

  const overviewSections = [
    richTextSection(0, project.description || "Alcafe-ERP: A monorepo ERP system for cafe management."),
    tableSection(1, ["Metric", "Value"], [
      ["Total Nodes", String(nodes.length)],
      ["Files", String(fileCount)],
      ["Functions", String(funcCount)],
      ["Classes", String(classCount)],
      ["Edges", String(edges.length)],
      ["Layers", String(layers.length)],
    ]),
    calloutSection(2, "info", `Languages: ${languages}`),
    calloutSection(3, "info", `Frameworks: ${frameworks}`),
    diagramSection(4, mermaidDiagram),
  ];

  await api("POST", "/api/neurons", {
    title: "Alcafe-ERP Project Overview",
    brainId,
    clusterId: overviewCluster.id,
    contentJson: buildSectionsDoc(overviewSections),
    contentText: `Alcafe-ERP Project Overview\n${project.description}\n${languages}\n${frameworks}\nNodes: ${nodes.length} Edges: ${edges.length}`,
  });
  console.log("  Project Overview neuron created");

  // Step 7: Create Architecture Tour neurons
  console.log("\n--- Step 7: Create Architecture Tour neurons ---");
  for (const step of tour) {
    const refNodes = (step.nodeIds || [])
      .map((nid) => {
        const n = nodes.find((x) => x.id === nid);
        return n ? `${n.name} (${n.path || n.id})` : nid;
      })
      .join("\n");

    const tourSections = [
      richTextSection(0, step.description || ""),
      calloutSection(1, "info", `Tour Step ${step.order}: ${step.title}`),
    ];
    if (refNodes) {
      tourSections.push(codeSection(2, refNodes, "text"));
    }

    await api("POST", "/api/neurons", {
      title: `Step ${step.order}: ${step.title}`,
      brainId,
      clusterId: tourCluster.id,
      contentJson: buildSectionsDoc(tourSections),
      contentText: `Step ${step.order}: ${step.title}\n${step.description || ""}\n${refNodes}`,
      sortOrder: step.order,
    });
    console.log(`  Tour step ${step.order}: ${step.title}`);
  }

  // Step 8: Save mapping file
  console.log("\n--- Step 8: Save mapping file ---");
  const mappingPath = new URL("./migration-mapping.json", import.meta.url);
  const { writeFile } = await import("node:fs/promises");
  await writeFile(
    mappingPath,
    JSON.stringify({ brainId, nodeIdToNeuronId, tagNameToId, clusterMap, subClusterMap }, null, 2)
  );
  console.log(`  Mapping saved to ${mappingPath.pathname}`);

  // Summary
  console.log("\n=== Migration Complete ===");
  console.log(`Brain: ${brain.name} (${brainId})`);
  console.log(`Clusters: ${Object.keys(clusterMap).length + Object.keys(subClusterMap).length + 2}`);
  console.log(`Neurons: ${created + tour.length + 1}`);
  console.log(`Tags: ${Object.keys(tagNameToId).length}`);
  console.log(`\nNote: ${edges.length} edges not migrated (NeuronLink API not yet implemented).`);
  console.log("Run edge migration after implementing P0-1 (NeuronLink REST API).");
}

main().catch((e) => {
  console.error("Migration failed:", e);
  process.exit(1);
});
