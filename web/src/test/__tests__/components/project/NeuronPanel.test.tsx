import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { NeuronPanel } from '@/components/project/NeuronPanel';
import { server } from '../../../mocks/server';
import { createWrapper } from '../../../utils/createWrapper';
import type { Neuron, NeuronAnchor } from '@/types';

const API_BASE = 'http://localhost:8080';

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock('@/components/editor/TiptapEditor', () => ({
  TiptapEditor: () => <div data-testid="mock-editor" />,
}));

const makeAnchor = (overrides: Partial<NeuronAnchor> = {}): NeuronAnchor => ({
  id: 'anchor-1',
  neuronId: 'neuron-1',
  clusterId: 'cluster-1',
  filePath: 'src/Main.java',
  createdAt: '2024-01-01T00:00:00',
  updatedAt: '2024-01-01T00:00:00',
  ...overrides,
});

const makeNeuron = (overrides: Partial<Neuron> = {}): Neuron => ({
  id: 'neuron-1',
  brainId: 'brain-1',
  clusterId: 'cluster-1',
  title: 'Test Neuron',
  contentJson: null,
  contentText: 'test content',
  templateId: null,
  isArchived: false,
  isDeleted: false,
  isFavorite: false,
  isPinned: false,
  version: 1,
  complexity: null,
  createdAt: '2024-01-01T00:00:00',
  updatedAt: '2024-01-01T00:00:00',
  createdBy: 'user',
  lastUpdatedBy: 'user',
  lastEditedAt: '2024-01-01T00:00:00',
  tags: [],
  anchor: makeAnchor(),
  ...overrides,
});

const defaultProps = {
  clusterId: 'cluster-1',
  brainId: 'brain-1',
  selectedPath: 'src/Main.java' as string | null,
  fileAnchors: [] as NeuronAnchor[],
  anchorsLoading: false,
  codeSelection: null,
  onNavigateToFile: vi.fn(),
};

function useNeuronsHandler(neurons: Neuron[]) {
  server.use(
    http.get(`${API_BASE}/api/neurons/cluster/:clusterId`, () =>
      HttpResponse.json(neurons)
    )
  );
}

describe('NeuronPanel', () => {
  beforeEach(() => {
    mockPush.mockClear();
    defaultProps.onNavigateToFile = vi.fn();
  });

  describe('tabs', () => {
    it('renders "This File" and "All Neurons" tabs', () => {
      useNeuronsHandler([]);
      render(<NeuronPanel {...defaultProps} />, { wrapper: createWrapper() });

      expect(screen.getByText('This File')).toBeInTheDocument();
      expect(screen.getByText('All Neurons')).toBeInTheDocument();
    });

    it('defaults to "This File" tab showing file header', () => {
      useNeuronsHandler([]);
      render(<NeuronPanel {...defaultProps} />, { wrapper: createWrapper() });

      expect(screen.getByText(/Neurons in.*Main\.java/)).toBeInTheDocument();
    });

    it('shows "Select a file" message on This File tab when no file selected', () => {
      useNeuronsHandler([]);
      render(
        <NeuronPanel {...defaultProps} selectedPath={null} />,
        { wrapper: createWrapper() }
      );

      expect(screen.getByText('Select a file or folder to see anchored neurons.')).toBeInTheDocument();
    });
  });

  describe('This File tab — anchors', () => {
    it('shows "No anchored neurons" when file has no anchors', () => {
      useNeuronsHandler([]);
      render(<NeuronPanel {...defaultProps} />, { wrapper: createWrapper() });

      expect(screen.getByText('No anchored neurons.')).toBeInTheDocument();
    });

    it('renders anchored neurons for the selected file', async () => {
      const neuron = makeNeuron({ title: 'Auth Middleware' });
      const anchor = makeAnchor();
      useNeuronsHandler([neuron]);

      render(
        <NeuronPanel {...defaultProps} fileAnchors={[anchor]} />,
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(screen.getByText('Auth Middleware')).toBeInTheDocument();
      });
    });

    it('opens content dialog when anchor card is clicked', async () => {
      const neuron = makeNeuron({ title: 'Auth Middleware' });
      const anchor = makeAnchor();
      useNeuronsHandler([neuron]);

      const user = userEvent.setup();
      render(
        <NeuronPanel {...defaultProps} fileAnchors={[anchor]} />,
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(screen.getByText('Auth Middleware')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Auth Middleware'));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Go to neuron page' })).toBeInTheDocument();
      });
      expect(mockPush).not.toHaveBeenCalled();
    });

    it('navigates to neuron page via context menu', async () => {
      const neuron = makeNeuron({ title: 'Auth Middleware' });
      const anchor = makeAnchor();
      useNeuronsHandler([neuron]);

      const user = userEvent.setup();
      render(
        <NeuronPanel {...defaultProps} fileAnchors={[anchor]} />,
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(screen.getByText('Auth Middleware')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: 'Neuron options' }));
      await user.click(screen.getByText('Go to neuron page'));

      expect(mockPush).toHaveBeenCalledWith('/brain/brain-1/cluster/cluster-1/neuron/neuron-1');
    });
  });

  describe('All Neurons tab', () => {
    it('shows search input when switching to All Neurons tab', async () => {
      useNeuronsHandler([]);
      const user = userEvent.setup();
      render(<NeuronPanel {...defaultProps} />, { wrapper: createWrapper() });

      await user.click(screen.getByText('All Neurons'));

      expect(screen.getByPlaceholderText('Search neurons...')).toBeInTheDocument();
    });

    it('displays all cluster neurons', async () => {
      const neurons = [
        makeNeuron({ id: 'n1', title: 'Auth Module' }),
        makeNeuron({ id: 'n2', title: 'Database Layer', anchor: makeAnchor({ id: 'a2', neuronId: 'n2', filePath: 'src/DB.java' }) }),
      ];
      useNeuronsHandler(neurons);

      const user = userEvent.setup();
      render(<NeuronPanel {...defaultProps} />, { wrapper: createWrapper() });

      await user.click(screen.getByText('All Neurons'));

      await waitFor(() => {
        expect(screen.getByText('Auth Module')).toBeInTheDocument();
        expect(screen.getByText('Database Layer')).toBeInTheDocument();
      });
    });

    it('shows anchor file path for each neuron', async () => {
      const neurons = [
        makeNeuron({ id: 'n1', title: 'Auth Module', anchor: makeAnchor({ filePath: 'src/Auth.java' }) }),
      ];
      useNeuronsHandler(neurons);

      const user = userEvent.setup();
      render(<NeuronPanel {...defaultProps} />, { wrapper: createWrapper() });

      await user.click(screen.getByText('All Neurons'));

      await waitFor(() => {
        expect(screen.getByText('src/Auth.java')).toBeInTheDocument();
      });
    });

    it('filters neurons by search term', async () => {
      const neurons = [
        makeNeuron({ id: 'n1', title: 'Auth Module' }),
        makeNeuron({ id: 'n2', title: 'Database Layer' }),
      ];
      useNeuronsHandler(neurons);

      const user = userEvent.setup();
      render(<NeuronPanel {...defaultProps} />, { wrapper: createWrapper() });

      await user.click(screen.getByText('All Neurons'));

      await waitFor(() => {
        expect(screen.getByText('Auth Module')).toBeInTheDocument();
      });

      await user.type(screen.getByPlaceholderText('Search neurons...'), 'Database');

      expect(screen.queryByText('Auth Module')).not.toBeInTheDocument();
      expect(screen.getByText('Database Layer')).toBeInTheDocument();
    });

    it('filters neurons by contentText too', async () => {
      const neurons = [
        makeNeuron({ id: 'n1', title: 'Module A', contentText: 'handles authentication' }),
        makeNeuron({ id: 'n2', title: 'Module B', contentText: 'handles caching' }),
      ];
      useNeuronsHandler(neurons);

      const user = userEvent.setup();
      render(<NeuronPanel {...defaultProps} />, { wrapper: createWrapper() });

      await user.click(screen.getByText('All Neurons'));

      await waitFor(() => {
        expect(screen.getByText('Module A')).toBeInTheDocument();
      });

      await user.type(screen.getByPlaceholderText('Search neurons...'), 'caching');

      expect(screen.queryByText('Module A')).not.toBeInTheDocument();
      expect(screen.getByText('Module B')).toBeInTheDocument();
    });

    it('shows empty message when no neurons match search', async () => {
      const neurons = [makeNeuron({ title: 'Auth Module' })];
      useNeuronsHandler(neurons);

      const user = userEvent.setup();
      render(<NeuronPanel {...defaultProps} />, { wrapper: createWrapper() });

      await user.click(screen.getByText('All Neurons'));

      await waitFor(() => {
        expect(screen.getByText('Auth Module')).toBeInTheDocument();
      });

      await user.type(screen.getByPlaceholderText('Search neurons...'), 'zzz_no_match');

      expect(screen.queryByText('Auth Module')).not.toBeInTheDocument();
      expect(screen.getByText(/No results for/)).toBeInTheDocument();
    });

    it('shows empty cluster message when there are no neurons', async () => {
      useNeuronsHandler([]);

      const user = userEvent.setup();
      render(<NeuronPanel {...defaultProps} />, { wrapper: createWrapper() });

      await user.click(screen.getByText('All Neurons'));

      await waitFor(() => {
        expect(screen.getByText('No neurons in this cluster.')).toBeInTheDocument();
      });
    });

    it('calls onNavigateToFile and switches to file tab via context menu', async () => {
      const onNavigateToFile = vi.fn();
      const neurons = [
        makeNeuron({ title: 'My Note', anchor: makeAnchor({ filePath: 'src/Main.java' }) }),
      ];
      useNeuronsHandler(neurons);

      const user = userEvent.setup();
      render(
        <NeuronPanel {...defaultProps} onNavigateToFile={onNavigateToFile} />,
        { wrapper: createWrapper() }
      );

      await user.click(screen.getByText('All Neurons'));

      await waitFor(() => {
        expect(screen.getByText('src/Main.java')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: 'Neuron options' }));
      await user.click(screen.getByText('Open file in tree'));

      expect(onNavigateToFile).toHaveBeenCalledWith('src/Main.java');
      // Should switch back to "This File" tab
      expect(screen.getByText(/Neurons in/)).toBeInTheDocument();
    });

    it('opens content dialog when neuron card is clicked', async () => {
      const neurons = [makeNeuron({ id: 'n1', title: 'Click Me' })];
      useNeuronsHandler(neurons);

      const user = userEvent.setup();
      render(<NeuronPanel {...defaultProps} />, { wrapper: createWrapper() });

      await user.click(screen.getByText('All Neurons'));

      await waitFor(() => {
        expect(screen.getByText('Click Me')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Click Me'));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Go to neuron page' })).toBeInTheDocument();
      });
      expect(mockPush).not.toHaveBeenCalled();
    });

    it('navigates to neuron page via context menu in All Neurons tab', async () => {
      const neurons = [makeNeuron({ id: 'n1', title: 'Click Me' })];
      useNeuronsHandler(neurons);

      const user = userEvent.setup();
      render(<NeuronPanel {...defaultProps} />, { wrapper: createWrapper() });

      await user.click(screen.getByText('All Neurons'));

      await waitFor(() => {
        expect(screen.getByText('Click Me')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: 'Neuron options' }));
      await user.click(screen.getByText('Go to neuron page'));

      expect(mockPush).toHaveBeenCalledWith('/brain/brain-1/cluster/cluster-1/neuron/n1');
    });
  });
});
