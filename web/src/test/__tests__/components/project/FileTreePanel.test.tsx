import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FileTreePanel } from '@/components/project/FileTreePanel';
import type { FileTreeEntry } from '@/types';

const mockEntries: FileTreeEntry[] = [
  { name: 'src', path: 'src', type: 'directory', size: null },
  { name: 'Main.java', path: 'src/Main.java', type: 'file', size: 1024 },
  { name: 'Utils.java', path: 'src/Utils.java', type: 'file', size: 512 },
  { name: 'README.md', path: 'README.md', type: 'file', size: 256 },
];

const defaultProps = {
  entries: mockEntries,
  loading: false,
  selectedPath: null as string | null,
  onSelectFile: vi.fn(),
};

describe('FileTreePanel', () => {
  describe('folder collapse state (bug fix)', () => {
    it('renders directories collapsed by default — children hidden', () => {
      render(<FileTreePanel {...defaultProps} />);

      // Directory itself is visible
      expect(screen.getByText('src')).toBeInTheDocument();
      // Root-level file is visible
      expect(screen.getByText('README.md')).toBeInTheDocument();
      // Children inside src/ must NOT be rendered (collapsed)
      expect(screen.queryByText('Main.java')).not.toBeInTheDocument();
      expect(screen.queryByText('Utils.java')).not.toBeInTheDocument();
    });

    it('expands directory and shows children on click', async () => {
      const user = userEvent.setup();
      render(<FileTreePanel {...defaultProps} />);

      expect(screen.queryByText('Main.java')).not.toBeInTheDocument();

      await user.click(screen.getByText('src'));

      expect(screen.getByText('Main.java')).toBeInTheDocument();
      expect(screen.getByText('Utils.java')).toBeInTheDocument();
    });

    it('collapses directory on second click', async () => {
      const user = userEvent.setup();
      render(<FileTreePanel {...defaultProps} />);

      await user.click(screen.getByText('src'));
      expect(screen.getByText('Main.java')).toBeInTheDocument();

      await user.click(screen.getByText('src'));
      expect(screen.queryByText('Main.java')).not.toBeInTheDocument();
    });
  });

  describe('search button', () => {
    it('renders FILES header and search button', () => {
      render(<FileTreePanel {...defaultProps} />);

      expect(screen.getByText('FILES')).toBeInTheDocument();
      expect(screen.getByTitle('Search files (Ctrl+P)')).toBeInTheDocument();
    });

    it('calls onOpenSearch when search button is clicked', async () => {
      const onOpenSearch = vi.fn();
      const user = userEvent.setup();
      render(<FileTreePanel {...defaultProps} onOpenSearch={onOpenSearch} />);

      await user.click(screen.getByTitle('Search files (Ctrl+P)'));

      expect(onOpenSearch).toHaveBeenCalledTimes(1);
    });
  });

  describe('loading and empty states', () => {
    it('shows loading message while loading', () => {
      render(<FileTreePanel {...defaultProps} entries={[]} loading={true} />);

      expect(screen.getByText('Loading file tree...')).toBeInTheDocument();
      // Header should still be visible
      expect(screen.getByText('FILES')).toBeInTheDocument();
    });

    it('shows empty state when there are no entries', () => {
      render(<FileTreePanel {...defaultProps} entries={[]} />);

      expect(screen.getByText('No files found.')).toBeInTheDocument();
    });
  });

  describe('file selection', () => {
    it('calls onSelectFile when a file is clicked', async () => {
      const onSelectFile = vi.fn();
      const user = userEvent.setup();
      render(<FileTreePanel {...defaultProps} onSelectFile={onSelectFile} />);

      await user.click(screen.getByText('README.md'));

      expect(onSelectFile).toHaveBeenCalledWith('README.md');
    });
  });
});
