import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { TiptapEditor } from '@/components/editor/TiptapEditor';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

const makeContent = (text: string) => ({
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      content: [{ type: 'text', text }],
    },
  ],
});

describe('TiptapEditor', () => {
  it('renders initial content', async () => {
    const content = makeContent('Hello world');

    render(
      <TiptapEditor
        content={content}
        onUpdate={vi.fn()}
        editable={true}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Hello world')).toBeInTheDocument();
    });
  });

  it('renders in read-only mode', async () => {
    const content = makeContent('Read only text');

    render(
      <TiptapEditor
        content={content}
        onUpdate={vi.fn()}
        editable={false}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Read only text')).toBeInTheDocument();
    });

    // Toolbar should not be present in view mode
    expect(screen.queryByRole('toolbar')).not.toBeInTheDocument();
  });

  it('updates content when prop changes', async () => {
    const onUpdate = vi.fn();
    const content1 = makeContent('First content');
    const content2 = makeContent('Updated content');

    const { rerender } = render(
      <TiptapEditor
        content={content1}
        onUpdate={onUpdate}
        editable={true}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('First content')).toBeInTheDocument();
    });

    // Re-render with new content — should use setContent to update
    rerender(
      <TiptapEditor
        content={content2}
        onUpdate={onUpdate}
        editable={true}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Updated content')).toBeInTheDocument();
    });
  });

  it('renders placeholder when content is empty', async () => {
    render(
      <TiptapEditor
        content={null}
        onUpdate={vi.fn()}
        editable={true}
      />
    );

    await waitFor(() => {
      const placeholder = document.querySelector('[data-placeholder]');
      expect(placeholder).toBeTruthy();
    });
  });
});
