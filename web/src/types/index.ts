export interface Brain {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  description: string | null;
  sortOrder: number;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  lastUpdatedBy: string;
  tags: Tag[];
}

export type ClusterType = "knowledge" | "ai-research" | "project";

export type ClusterStatusType = "generating" | "ready";
export type ResearchTopicStatusType = "generating" | "ready" | "updating" | "error";

export interface Cluster {
  id: string;
  brainId: string;
  name: string;
  type: ClusterType;
  status: ClusterStatusType;
  researchGoal: string | null;
  sortOrder: number;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  lastUpdatedBy: string;
}

export type CompletenessLevel = "none" | "partial" | "good" | "complete";

export interface BulletItem {
  id: string;
  text: string;
  explanation: string;
  completeness: CompletenessLevel;
  linkedNeuronIds: string[];
  children: BulletItem[];
}

export interface ResearchTopic {
  id: string;
  clusterId: string;
  brainId: string;
  title: string;
  prompt: string;
  contentJson: { version: number; items: BulletItem[] } | null;
  overallCompleteness: CompletenessLevel;
  status: ResearchTopicStatusType;
  lastRefreshedAt: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  lastUpdatedBy: string;
}

// Sandbox types

export type SandboxStatus = "cloning" | "indexing" | "active" | "error" | "terminating";

export interface Sandbox {
  id: string;
  clusterId: string;
  brainId: string;
  brainName: string | null;
  clusterName: string | null;
  repoUrl: string;
  currentBranch: string;
  currentCommit: string | null;
  isShallow: boolean;
  status: SandboxStatus;
  diskUsageBytes: number | null;
  errorMessage: string | null;
  lastAccessedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface GitCommit {
  sha: string;
  author: string;
  authorEmail: string;
  date: string;
  message: string;
}

export interface BlameLine {
  line: number;
  commitSha: string | null;
  author: string | null;
  date: string | null;
  content: string;
}

export interface PullResponse {
  newCommit: string;
  renamedAnchors: number;
}

// Project Cluster types

export interface ProjectConfig {
  id: string;
  clusterId: string;
  repoUrl: string;
  defaultBranch: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NeuronAnchor {
  id: string;
  neuronId: string;
  clusterId: string;
  filePath: string;
  createdAt: string;
  updatedAt: string;
}

export interface FileTreeEntry {
  name: string;
  path: string;
  type: "file" | "directory";
  size: number | null;
}

export interface FileContent {
  path: string;
  content: string;
  language: string | null;
  size: number;
}

// --- Code Intelligence ---

export interface CodeSymbol {
  name: string;
  kind: string;
  startLine: number;
  endLine: number;
  children: CodeSymbol[];
}

export interface CodeLocation {
  file: string | null;
  line: number;
  col: number;
}

export interface CodeStructureResponse {
  symbols: CodeSymbol[];
}

export interface CodeDefinitionResponse {
  location: CodeLocation | null;
}

export interface CodeReferencesResponse {
  references: CodeLocation[];
}

export interface Neuron {
  id: string;
  brainId: string;
  clusterId: string;
  title: string;
  contentJson: Record<string, unknown> | null;
  contentText: string | null;
  templateId: string | null;
  isArchived: boolean;
  isDeleted: boolean;
  isFavorite: boolean;
  isPinned: boolean;
  version: number;
  complexity: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  lastUpdatedBy: string;
  lastEditedAt: string;
  tags: Tag[];
  anchor: NeuronAnchor | null;
}

export interface AppSettings {
  displayName: string;
  maxRemindersPerNeuron: number;
  createdAt: string;
  updatedAt: string;
}

export interface Tag {
  id: string;
  name: string;
  color: string | null;
  createdAt: string;
}

export interface Attachment {
  id: string;
  neuronId: string;
  fileName: string;
  filePath: string;
  fileSize: number | null;
  contentType: string | null;
  createdAt: string;
}

export interface NeuronRevision {
  id: string;
  neuronId: string;
  revisionNumber: number;
  title: string | null;
  contentJson: Record<string, unknown> | null;
  contentText: string | null;
  createdAt: string;
}

export interface Template {
  id: string;
  name: string;
  description: string | null;
  contentJson: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export type SectionType =
  | "rich-text"
  | "code"
  | "math"
  | "diagram"
  | "callout"
  | "divider"
  | "image"
  | "table"
  | "audio";

export interface Section {
  id: string;
  type: SectionType;
  order: number;
  content: Record<string, unknown>;
  meta: Record<string, unknown>;
}

export interface SectionsDocument {
  version: 2;
  sections: Section[];
}

export interface SearchResultItem {
  neuron: Neuron;
  highlight: string | null;
  rank: number;
  brainName: string | null;
  clusterName: string | null;
}

export interface NeuronSummary {
  id: string;
  title: string;
  brainId: string;
  clusterId: string;
}

export interface NeuronLink {
  id: string;
  sourceNeuronId: string;
  sourceNeuronTitle: string | null;
  sourceNeuronClusterId: string | null;
  targetNeuronId: string;
  targetNeuronTitle: string | null;
  targetNeuronClusterId: string | null;
  label: string | null;
  linkType: string | null;
  weight: number | null;
  source: string;
  createdAt: string;
}

export interface LinkSuggestion {
  id: string;
  sourceNeuronId: string;
  sourceNeuronTitle: string | null;
  sourceNeuronClusterId: string | null;
  targetNeuronId: string;
  targetNeuronTitle: string | null;
  targetNeuronClusterId: string | null;
  suggestionType: string;
  displayType: "references" | "referenced_by" | "related";
  score: number | null;
  createdAt: string;
}

export interface Reminder {
  id: string;
  neuronId: string;
  reminderType: "ONCE" | "RECURRING";
  triggerAt: string;
  recurrencePattern: "DAILY" | "WEEKLY" | "MONTHLY" | null;
  recurrenceInterval: number | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  title?: string | null;
  description?: string | null;
  descriptionText?: string | null;
  neuronTitle?: string | null;
  brainId?: string | null;
  clusterId?: string | null;
}

export interface AppNotification {
  id: string;
  reminderId: string | null;
  neuronId: string;
  brainId: string;
  clusterId: string;
  neuronTitle: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export interface Thought {
  id: string;
  name: string;
  description: string | null;
  neuronTagMode: "any" | "all";
  brainTagMode: "any" | "all";
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  neuronTags: Tag[];
  brainTags: Tag[];
}

export interface SpacedRepetitionItem {
  id: string;
  neuronId: string;
  neuronTitle: string;
  easeFactor: number;
  intervalDays: number;
  repetitions: number;
  nextReviewAt: string;
  lastReviewedAt: string | null;
  createdAt: string;
  questionCount: number;
  hasQuestions: boolean;
  quizEligible: boolean;
  quizEnabled: boolean;
}

export interface ReviewQuestion {
  id: string;
  questionText: string;
  answerText: string;
  questionOrder: number;
}

export interface BrainExport {
  version: string;
  brain: {
    id: string;
    name: string;
    icon: string | null;
    color: string | null;
    description: string | null;
    createdAt: string;
  };
  clusters: Array<{
    id: string;
    name: string;
    sortOrder: number;
    tagNames: string[];
  }>;
  neurons: Array<{
    id: string;
    clusterId: string;
    title: string;
    contentJson: string | null;
    contentText: string | null;
    sortOrder: number;
    isFavorite: boolean;
    isPinned: boolean;
    tagNames: string[];
    createdAt: string;
  }>;
  tags: Array<{ name: string; color: string | null }>;
  links: Array<{
    sourceNeuronId: string;
    targetNeuronId: string;
    label: string | null;
    linkType: string | null;
    weight: number | null;
  }>;
}

export interface NeuronShare {
  id: string;
  token: string;
  expiresAt: string | null;
  createdAt: string;
}

export interface SharedNeuron {
  title: string;
  contentJson: string | null;
  tags: Tag[];
  brainName: string | null;
  createdAt: string;
}

// AI Assist types

export const AI_SUPPORTED_SECTION_TYPES: SectionType[] = [
  "rich-text",
  "code",
  "math",
  "diagram",
  "callout",
  "table",
];

export interface AiAssistQuestion {
  id: string;
  text: string;
  inputType: "single-select" | "multi-select" | "free-text";
  options?: string[];
  required?: boolean;
}

export interface AiAssistQuestionAnswer {
  questionId: string;
  value: string | string[];
}

export type ConversationTurnContent =
  | { type: "text"; text: string }
  | { type: "questions"; questions: AiAssistQuestion[] }
  | { type: "answers"; answers: AiAssistQuestionAnswer[] }
  | { type: "section_content"; sectionContent: Record<string, unknown> }
  | { type: "reply"; text: string }
  | { type: "message"; text: string; severity: "info" | "warning" | "error" };

export interface ConversationTurn {
  role: "user" | "assistant";
  content: ConversationTurnContent;
}

export interface AiAssistRequest {
  sectionType: SectionType;
  currentContent: Record<string, unknown> | null;
  userMessage: string;
  conversationHistory: ConversationTurn[];
  questionAnswers?: AiAssistQuestionAnswer[];
  regenerate?: boolean;
}

export interface AiAssistResponse {
  responseType: "questions" | "content" | "reply" | "message";
  questions?: AiAssistQuestion[];
  sectionContent?: Record<string, unknown>;
  message?: string;
  messageSeverity?: "info" | "warning" | "error";
  explanation?: string;
  conversationHistory: ConversationTurn[];
}
