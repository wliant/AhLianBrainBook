import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { GraphCanvas } from '@/components/graph/GraphCanvas';
import type { BrainExport } from '@/types';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

// Mock next-themes
vi.mock('next-themes', () => ({
  useTheme: () => ({ resolvedTheme: 'dark' }),
}));

// Mock @xyflow/react with a simplified version
vi.mock('@xyflow/react', () => ({
  ReactFlow: ({ nodes, edges, children }: { nodes: unknown[]; edges: unknown[]; children?: React.ReactNode }) => (
    <div data-testid="react-flow" data-node-count={nodes.length} data-edge-count={edges.length}>
      {children}
    </div>
  ),
  ReactFlowProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Controls: () => <div data-testid="controls" />,
  Background: () => <div data-testid="background" />,
  Handle: () => null,
  Position: { Top: 'top', Bottom: 'bottom' },
  MarkerType: { ArrowClosed: 'arrowclosed' },
}));

function makeSmallBrainExport(): BrainExport {
  return {
    brain: { id: 'brain-1', name: 'Test Brain', icon: null, color: null },
    clusters: [
      { id: 'cluster-1', name: 'Cluster A', brainId: 'brain-1', sortOrder: 0 },
      { id: 'cluster-2', name: 'Cluster B', brainId: 'brain-1', sortOrder: 1 },
    ],
    neurons: [
      { id: 'n-1', title: 'Neuron 1', clusterId: 'cluster-1', brainId: 'brain-1', contentJson: '', contentText: '', tagNames: [] },
      { id: 'n-2', title: 'Neuron 2', clusterId: 'cluster-1', brainId: 'brain-1', contentJson: '', contentText: '', tagNames: [] },
      { id: 'n-3', title: 'Neuron 3', clusterId: 'cluster-2', brainId: 'brain-1', contentJson: '', contentText: '', tagNames: [] },
    ],
    links: [
      { sourceNeuronId: 'n-1', targetNeuronId: 'n-2', linkType: 'related-to', label: null },
    ],
  } as unknown as BrainExport;
}

function makeLargeBrainExport(neuronCount: number): BrainExport {
  const clusters = [
    { id: 'cluster-1', name: 'Large Cluster', brainId: 'brain-1', sortOrder: 0 },
    { id: 'cluster-2', name: 'Another Cluster', brainId: 'brain-1', sortOrder: 1 },
  ];

  const neurons = Array.from({ length: neuronCount }, (_, i) => ({
    id: `n-${i}`,
    title: `Neuron ${i}`,
    clusterId: i < neuronCount / 2 ? 'cluster-1' : 'cluster-2',
    brainId: 'brain-1',
    contentJson: '',
    contentText: '',
    tagNames: [],
  }));

  const links = Array.from({ length: Math.min(10, neuronCount - 1) }, (_, i) => ({
    sourceNeuronId: `n-${i}`,
    targetNeuronId: `n-${i + 1}`,
    linkType: 'related-to',
    label: null,
  }));

  return {
    brain: { id: 'brain-1', name: 'Large Brain', icon: null, color: null },
    clusters,
    neurons,
    links,
  } as unknown as BrainExport;
}

describe('GraphCanvas', () => {
  it('renders small graphs with all neurons visible', () => {
    const data = makeSmallBrainExport();
    render(<GraphCanvas data={data} brainId="brain-1" />);

    const flow = screen.getByTestId('react-flow');
    // 3 neurons + 2 cluster backgrounds = 5 nodes
    const nodeCount = parseInt(flow.getAttribute('data-node-count') || '0');
    expect(nodeCount).toBeGreaterThanOrEqual(3);
  });

  it('does not show collapse/expand buttons for small graphs', () => {
    const data = makeSmallBrainExport();
    render(<GraphCanvas data={data} brainId="brain-1" />);

    expect(screen.queryByText('Collapse All')).not.toBeInTheDocument();
    expect(screen.queryByText('Expand All')).not.toBeInTheDocument();
  });

  it('renders large graphs with cluster collapse', () => {
    const data = makeLargeBrainExport(150);
    render(<GraphCanvas data={data} brainId="brain-1" />);

    // Large graph should show collapse/expand controls
    expect(screen.getByText('Collapse All')).toBeInTheDocument();
    expect(screen.getByText('Expand All')).toBeInTheDocument();
  });

  it('large graph starts in collapsed mode with cluster summary nodes', () => {
    const data = makeLargeBrainExport(150);
    render(<GraphCanvas data={data} brainId="brain-1" />);

    const flow = screen.getByTestId('react-flow');
    const nodeCount = parseInt(flow.getAttribute('data-node-count') || '0');
    // In collapsed mode, should have cluster summary nodes (2), not 150 neuron nodes
    expect(nodeCount).toBeLessThan(150);
  });

  it('renders controls and background', () => {
    const data = makeSmallBrainExport();
    render(<GraphCanvas data={data} brainId="brain-1" />);

    expect(screen.getByTestId('controls')).toBeInTheDocument();
    expect(screen.getByTestId('background')).toBeInTheDocument();
  });

  it('renders minimap', () => {
    const data = makeSmallBrainExport();
    const { container } = render(<GraphCanvas data={data} brainId="brain-1" />);

    // Minimap is rendered as an SVG
    expect(container.querySelector('svg')).toBeTruthy();
  });
});
