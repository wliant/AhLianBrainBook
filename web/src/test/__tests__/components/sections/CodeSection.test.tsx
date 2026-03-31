import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CodeSection } from '@/components/sections/CodeSection';
import type { Section } from '@/types';

// Mock next-themes
vi.mock('next-themes', () => ({
  useTheme: () => ({ resolvedTheme: 'dark' }),
}));

function makeSection(content: Record<string, unknown> = {}): Section {
  return {
    id: 'section-1',
    type: 'code',
    order: 0,
    content: { code: '', language: 'javascript', title: '', ...content },
    meta: {},
  };
}

describe('CodeSection', () => {
  it('renders language selector in edit mode', () => {
    render(
      <CodeSection
        section={makeSection({ code: 'console.log("hi")' })}
        onUpdate={vi.fn()}
        editing={true}
      />
    );

    const select = screen.getByDisplayValue('javascript');
    expect(select).toBeInTheDocument();
  });

  it('renders language label in view mode', () => {
    render(
      <CodeSection
        section={makeSection({ code: 'print("hi")', language: 'python' })}
        onUpdate={vi.fn()}
        editing={false}
      />
    );

    expect(screen.getByText('python')).toBeInTheDocument();
  });

  it('shows Run button for runnable languages', () => {
    render(
      <CodeSection
        section={makeSection({ code: 'console.log("test")', language: 'javascript' })}
        onUpdate={vi.fn()}
        editing={true}
      />
    );

    expect(screen.getByTestId('run-code-btn')).toBeInTheDocument();
    expect(screen.getByText('Run')).toBeInTheDocument();
  });

  it('hides Run button for non-runnable languages', () => {
    render(
      <CodeSection
        section={makeSection({ code: 'fn main() {}', language: 'rust' })}
        onUpdate={vi.fn()}
        editing={true}
      />
    );

    expect(screen.queryByTestId('run-code-btn')).not.toBeInTheDocument();
  });

  it('shows title input in edit mode', () => {
    render(
      <CodeSection
        section={makeSection({ title: 'My Code' })}
        onUpdate={vi.fn()}
        editing={true}
      />
    );

    expect(screen.getByPlaceholderText('Section title...')).toHaveValue('My Code');
  });

  it('changes language when selector changes', async () => {
    const user = userEvent.setup();
    const onUpdate = vi.fn();

    render(
      <CodeSection
        section={makeSection({ code: 'some code', language: 'javascript' })}
        onUpdate={onUpdate}
        editing={true}
      />
    );

    const select = screen.getByDisplayValue('javascript');
    await user.selectOptions(select, 'python');

    expect(onUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ language: 'python' })
    );
  });

  it('shows resize handle in edit mode', () => {
    const { container } = render(
      <CodeSection
        section={makeSection({ code: 'code' })}
        onUpdate={vi.fn()}
        editing={true}
      />
    );

    // Resize handle is the grip icon container
    expect(container.querySelector('.cursor-row-resize')).toBeInTheDocument();
  });

  it('hides resize handle in view mode', () => {
    const { container } = render(
      <CodeSection
        section={makeSection({ code: 'code' })}
        onUpdate={vi.fn()}
        editing={false}
      />
    );

    expect(container.querySelector('.cursor-row-resize')).not.toBeInTheDocument();
  });

  it('renders CodeMirror editor', async () => {
    render(
      <CodeSection
        section={makeSection({ code: 'const x = 1;' })}
        onUpdate={vi.fn()}
        editing={true}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('codemirror-editor')).toBeInTheDocument();
    });
  });
});
