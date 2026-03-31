import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ImageSection } from '@/components/sections/ImageSection';
import type { Section } from '@/types';

function makeSection(content: Record<string, unknown> = {}): Section {
  return {
    id: 'section-1',
    type: 'image',
    order: 0,
    content: { src: '', caption: '', sourceType: 'upload', ...content },
    meta: {},
  };
}

describe('ImageSection', () => {
  describe('with image src', () => {
    it('renders img with loading=lazy and decoding=async', () => {
      render(
        <ImageSection
          section={makeSection({ src: 'https://example.com/test.png', caption: 'Test image' })}
          onUpdate={vi.fn()}
          editing={false}
        />
      );

      const img = screen.getByRole('img', { name: 'Test image' });
      expect(img).toHaveAttribute('loading', 'lazy');
      expect(img).toHaveAttribute('decoding', 'async');
      expect(img).toHaveAttribute('src', 'https://example.com/test.png');
    });

    it('renders caption in view mode', () => {
      render(
        <ImageSection
          section={makeSection({ src: 'https://example.com/test.png', caption: 'My caption' })}
          onUpdate={vi.fn()}
          editing={false}
        />
      );

      expect(screen.getByText('My caption')).toBeInTheDocument();
    });

    it('renders change button in edit mode', () => {
      render(
        <ImageSection
          section={makeSection({ src: 'https://example.com/test.png' })}
          onUpdate={vi.fn()}
          editing={true}
        />
      );

      expect(screen.getByText('Change')).toBeInTheDocument();
    });

    it('renders caption input in edit mode', () => {
      render(
        <ImageSection
          section={makeSection({ src: 'https://example.com/test.png' })}
          onUpdate={vi.fn()}
          editing={true}
        />
      );

      expect(screen.getByPlaceholderText('Add a caption...')).toBeInTheDocument();
    });

    it('calls onUpdate when caption changes', async () => {
      const user = userEvent.setup();
      const onUpdate = vi.fn();
      render(
        <ImageSection
          section={makeSection({ src: 'https://example.com/test.png', caption: '' })}
          onUpdate={onUpdate}
          editing={true}
        />
      );

      const input = screen.getByPlaceholderText('Add a caption...');
      await user.type(input, 'New caption');

      expect(onUpdate).toHaveBeenCalled();
    });
  });

  describe('without image src', () => {
    it('renders upload interface in edit mode', () => {
      render(
        <ImageSection
          section={makeSection()}
          onUpdate={vi.fn()}
          editing={true}
          neuronId="n-1"
        />
      );

      expect(screen.getByText('Upload')).toBeInTheDocument();
      expect(screen.getByText('URL')).toBeInTheDocument();
    });

    it('renders no image placeholder in view mode', () => {
      render(
        <ImageSection
          section={makeSection()}
          onUpdate={vi.fn()}
          editing={false}
        />
      );

      expect(screen.getByText('No image')).toBeInTheDocument();
    });

    it('switches to URL mode', async () => {
      const user = userEvent.setup();
      render(
        <ImageSection
          section={makeSection()}
          onUpdate={vi.fn()}
          editing={true}
          neuronId="n-1"
        />
      );

      await user.click(screen.getByText('URL'));
      expect(screen.getByPlaceholderText('Paste image URL...')).toBeInTheDocument();
    });
  });
});
