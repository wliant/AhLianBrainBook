import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '../../mocks/server';
import type { Neuron } from '@/types';

// Mock next/link to render a simple anchor
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useParams: () => ({}),
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/',
}));

const API_BASE = 'http://localhost:8080';

const makeNeuron = (overrides: Partial<Neuron> = {}): Neuron => ({
  id: 'neuron-1',
  brainId: 'brain-1',
  clusterId: 'cluster-1',
  title: 'Test Neuron',
  contentJson: null,
  contentText: null,
  templateId: null,
  isArchived: false,
  isDeleted: false,
  isFavorite: false,
  isPinned: false,
  version: 1,
  createdAt: '2024-01-01T00:00:00',
  updatedAt: '2024-01-01T00:00:00',
  lastEditedAt: '2024-01-01T00:00:00',
  ...overrides,
});

// Dynamic import to ensure mocks are applied first
const importDashboard = async () => {
  const mod = await import('@/app/page');
  return mod.default;
};

describe('Dashboard (Home Page)', () => {
  it('renders BrainBook heading', async () => {
    const Dashboard = await importDashboard();
    render(<Dashboard />);

    expect(screen.getByText('BrainBook')).toBeInTheDocument();
  });

  it('renders Recent section', async () => {
    const Dashboard = await importDashboard();
    render(<Dashboard />);

    expect(screen.getByText('Recent')).toBeInTheDocument();
  });

  it('shows neurons when API returns data', async () => {
    const mockNeurons = [
      makeNeuron({ id: 'n-1', title: 'My First Note' }),
      makeNeuron({ id: 'n-2', title: 'My Second Note' }),
    ];

    server.use(
      http.get(`${API_BASE}/api/neurons/recent`, () =>
        HttpResponse.json(mockNeurons)
      )
    );

    const Dashboard = await importDashboard();
    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText('My First Note')).toBeInTheDocument();
    });
    expect(screen.getByText('My Second Note')).toBeInTheDocument();
  });
});
