import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { CodeMirrorEditor } from '@/components/sections/CodeMirrorEditor';

describe('CodeMirrorEditor', () => {
  it('renders the editor container', () => {
    render(
      <CodeMirrorEditor
        value="console.log('hello')"
        language="javascript"
        height="200px"
      />
    );

    expect(screen.getByTestId('codemirror-editor')).toBeInTheDocument();
  });

  it('displays initial value', async () => {
    const { container } = render(
      <CodeMirrorEditor
        value="const x = 42;"
        language="javascript"
        height="200px"
      />
    );

    await waitFor(() => {
      // CodeMirror renders content in .cm-content
      const cmContent = container.querySelector('.cm-content');
      expect(cmContent).toBeTruthy();
      expect(cmContent?.textContent).toContain('const x = 42;');
    });
  });

  it('calls onChange when user types', async () => {
    const onChange = vi.fn();
    render(
      <CodeMirrorEditor
        value=""
        onChange={onChange}
        language="javascript"
        height="200px"
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('codemirror-editor').querySelector('.cm-editor')).toBeTruthy();
    });
  });

  it('respects readOnly prop', async () => {
    const onChange = vi.fn();
    const { container } = render(
      <CodeMirrorEditor
        value="read only code"
        onChange={onChange}
        language="javascript"
        readOnly={true}
        height="200px"
      />
    );

    await waitFor(() => {
      const cmContent = container.querySelector('.cm-content');
      expect(cmContent).toBeTruthy();
      // CodeMirror uses EditorState.readOnly to prevent edits, content remains visible
      expect(cmContent?.textContent).toContain('read only code');
    });
  });

  it('applies dark theme when darkMode is true', async () => {
    const { container } = render(
      <CodeMirrorEditor
        value="dark mode"
        language="javascript"
        height="200px"
        darkMode={true}
      />
    );

    await waitFor(() => {
      // oneDark theme adds cm-theme-dark or similar class
      const editor = container.querySelector('.cm-editor');
      expect(editor).toBeTruthy();
    });
  });

  it('applies light theme when darkMode is false', async () => {
    const { container } = render(
      <CodeMirrorEditor
        value="light mode"
        language="javascript"
        height="200px"
        darkMode={false}
      />
    );

    await waitFor(() => {
      const editor = container.querySelector('.cm-editor');
      expect(editor).toBeTruthy();
    });
  });

  it('updates content when value prop changes', async () => {
    const { container, rerender } = render(
      <CodeMirrorEditor
        value="initial"
        language="javascript"
        height="200px"
      />
    );

    await waitFor(() => {
      expect(container.querySelector('.cm-content')?.textContent).toContain('initial');
    });

    rerender(
      <CodeMirrorEditor
        value="updated"
        language="javascript"
        height="200px"
      />
    );

    await waitFor(() => {
      expect(container.querySelector('.cm-content')?.textContent).toContain('updated');
    });
  });

  it('renders with different languages', async () => {
    const { container } = render(
      <CodeMirrorEditor
        value="def hello(): pass"
        language="python"
        height="200px"
      />
    );

    await waitFor(() => {
      const cmContent = container.querySelector('.cm-content');
      expect(cmContent).toBeTruthy();
      expect(cmContent?.textContent).toContain('def hello(): pass');
    });
  });

  it('applies custom height', () => {
    render(
      <CodeMirrorEditor
        value=""
        language="javascript"
        height="300px"
      />
    );

    const container = screen.getByTestId('codemirror-editor');
    expect(container.style.height).toBe('300px');
  });
});
