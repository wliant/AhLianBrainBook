import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { AudioSection } from '@/components/sections/AudioSection';
import { server } from '../../../mocks/server';
import type { Section } from '@/types';

const API_BASE = 'http://localhost:8080';

function makeSection(content: Record<string, unknown> = {}): Section {
  return {
    id: 'section-1',
    type: 'audio',
    order: 0,
    content: { src: '', label: '', sourceType: 'upload', ...content },
    meta: {},
  };
}

// Mock MediaRecorder for recording tests
class MockMediaRecorder {
  state = 'inactive';
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  static isTypeSupported() { return true; }
  start() { this.state = 'recording'; }
  stop() {
    this.state = 'inactive';
    this.ondataavailable?.({ data: new Blob(['audio'], { type: 'audio/webm' }) });
    this.onstop?.();
  }
}

describe('AudioSection', () => {
  describe('edit mode, no audio', () => {
    it('renders upload input by default', () => {
      render(<AudioSection section={makeSection()} onUpdate={vi.fn()} neuronId="n-1" />);

      expect(screen.getByText('Click to choose an audio file')).toBeInTheDocument();
      expect(screen.getByText('Upload')).toBeInTheDocument();
      expect(screen.getByText('Record')).toBeInTheDocument();
    });

    it('switches to record mode when Record tab clicked', async () => {
      const user = userEvent.setup();
      render(<AudioSection section={makeSection()} onUpdate={vi.fn()} neuronId="n-1" />);

      await user.click(screen.getByText('Record'));

      expect(screen.getByText('Start Recording')).toBeInTheDocument();
    });

    it('uploads file and calls onUpdate', async () => {
      const onUpdate = vi.fn();
      server.use(
        http.post(`${API_BASE}/api/attachments/neuron/:neuronId`, () =>
          HttpResponse.json({
            id: 'att-1',
            neuronId: 'n-1',
            fileName: 'song.mp3',
            filePath: 'abc_song.mp3',
            fileSize: 2048,
            contentType: 'audio/mpeg',
            createdAt: '2024-01-01T00:00:00',
          })
        )
      );

      render(<AudioSection section={makeSection()} onUpdate={onUpdate} neuronId="n-1" />);

      const file = new File(['audio-data'], 'song.mp3', { type: 'audio/mpeg' });
      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      await userEvent.upload(input, file);

      await vi.waitFor(() => {
        expect(onUpdate).toHaveBeenCalledWith(
          expect.objectContaining({
            src: `${API_BASE}/api/attachments/att-1/download`,
            label: 'song.mp3',
            sourceType: 'upload',
            attachmentId: 'att-1',
          })
        );
      });
    });

    it('shows upload error when upload fails', async () => {
      server.use(
        http.post(`${API_BASE}/api/attachments/neuron/:neuronId`, () =>
          HttpResponse.json({ message: 'File too large' }, { status: 413 })
        )
      );

      render(<AudioSection section={makeSection()} onUpdate={vi.fn()} neuronId="n-1" />);

      const file = new File(['data'], 'big.mp3', { type: 'audio/mpeg' });
      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      await userEvent.upload(input, file);

      await vi.waitFor(() => {
        expect(screen.getByText(/File too large/)).toBeInTheDocument();
      });
    });

    it('disables upload button when no neuronId', () => {
      render(<AudioSection section={makeSection()} onUpdate={vi.fn()} />);

      const button = screen.getByText('Click to choose an audio file');
      expect(button).toBeDisabled();
    });
  });

  describe('edit mode, has audio', () => {
    it('renders audio player', () => {
      const section = makeSection({
        src: 'http://example.com/audio.mp3',
        label: 'My Audio',
      });

      render(<AudioSection section={section} onUpdate={vi.fn()} neuronId="n-1" />);

      const audio = document.querySelector('audio') as HTMLAudioElement;
      expect(audio).toBeInTheDocument();
      expect(audio.src).toBe('http://example.com/audio.mp3');
    });

    it('renders editable label input', () => {
      const section = makeSection({
        src: 'http://example.com/audio.mp3',
        label: 'My Audio',
      });

      render(<AudioSection section={section} onUpdate={vi.fn()} neuronId="n-1" />);

      const input = screen.getByDisplayValue('My Audio');
      expect(input).toBeInTheDocument();
    });

    it('calls onUpdate when label changes', async () => {
      const onUpdate = vi.fn();
      const section = makeSection({
        src: 'http://example.com/audio.mp3',
        label: 'My Audio',
        attachmentId: 'att-1',
      });

      render(<AudioSection section={section} onUpdate={onUpdate} neuronId="n-1" />);

      const input = screen.getByDisplayValue('My Audio');
      await userEvent.type(input, '!');

      expect(onUpdate).toHaveBeenLastCalledWith(
        expect.objectContaining({ label: 'My Audio!' })
      );
    });

    it('shows Change button', () => {
      const section = makeSection({
        src: 'http://example.com/audio.mp3',
      });

      render(<AudioSection section={section} onUpdate={vi.fn()} neuronId="n-1" />);

      expect(screen.getByText('Change')).toBeInTheDocument();
    });
  });

  describe('view mode', () => {
    it('renders audio player without Change button', () => {
      const section = makeSection({
        src: 'http://example.com/audio.mp3',
        label: 'My Audio',
      });

      render(<AudioSection section={section} onUpdate={vi.fn()} editing={false} />);

      expect(document.querySelector('audio')).toBeInTheDocument();
      expect(screen.queryByText('Change')).not.toBeInTheDocument();
    });

    it('renders label as text, not input', () => {
      const section = makeSection({
        src: 'http://example.com/audio.mp3',
        label: 'My Audio',
      });

      render(<AudioSection section={section} onUpdate={vi.fn()} editing={false} />);

      expect(screen.getByText('My Audio')).toBeInTheDocument();
      expect(screen.queryByDisplayValue('My Audio')).not.toBeInTheDocument();
    });

    it('shows "No audio" when src is empty', () => {
      render(<AudioSection section={makeSection()} onUpdate={vi.fn()} editing={false} />);

      expect(screen.getByText('No audio')).toBeInTheDocument();
    });
  });

  describe('recording flow', () => {
    it('starts and stops recording, uploads result', async () => {
      Object.defineProperty(global, 'MediaRecorder', {
        writable: true,
        value: MockMediaRecorder,
      });
      Object.defineProperty(navigator, 'mediaDevices', {
        writable: true,
        value: {
          getUserMedia: vi.fn().mockResolvedValue({
            getTracks: () => [{ stop: vi.fn() }],
          }),
        },
      });

      const onUpdate = vi.fn();
      server.use(
        http.post(`${API_BASE}/api/attachments/neuron/:neuronId`, () =>
          HttpResponse.json({
            id: 'att-rec-1',
            neuronId: 'n-1',
            fileName: 'recording.webm',
            filePath: 'abc_recording.webm',
            fileSize: 512,
            contentType: 'audio/webm',
            createdAt: '2024-01-01T00:00:00',
          })
        )
      );

      render(<AudioSection section={makeSection()} onUpdate={onUpdate} neuronId="n-1" />);

      // Switch to record mode
      await userEvent.click(screen.getByText('Record'));
      // Start recording
      await userEvent.click(screen.getByText('Start Recording'));

      // Should show stop button
      expect(screen.getByText('Stop Recording')).toBeInTheDocument();

      // Stop recording
      await userEvent.click(screen.getByText('Stop Recording'));

      // Should have uploaded and called onUpdate with recording sourceType
      await vi.waitFor(() => {
        expect(onUpdate).toHaveBeenCalledWith(
          expect.objectContaining({
            sourceType: 'recording',
            attachmentId: 'att-rec-1',
          })
        );
      });
    });
  });
});
