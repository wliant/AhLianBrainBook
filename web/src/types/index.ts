export interface Brain {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  sortOrder: number;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
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
  storageKey: string;
  filename: string;
  mimeType: string | null;
  sizeBytes: number | null;
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
