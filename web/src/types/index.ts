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
  tags: Tag[];
}

export interface Cluster {
  id: string;
  brainId: string;
  name: string;
  parentClusterId: string | null;
  sortOrder: number;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
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
  createdAt: string;
  updatedAt: string;
  lastEditedAt: string;
  tags: Tag[];
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
  contentJson: Record<string, unknown> | null;
  contentText: string | null;
  createdAt: string;
  reason: string;
  snapshotName: string | null;
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
  | "table";

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
  createdAt: string;
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
    parentClusterId: string | null;
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
