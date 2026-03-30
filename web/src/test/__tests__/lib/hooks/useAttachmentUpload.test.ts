import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { useAttachmentUpload } from '@/lib/hooks/useAttachmentUpload';
import { server } from '../../../mocks/server';

const API_BASE = 'http://localhost:8080';

describe('useAttachmentUpload', () => {
  it('uploads file and calls onUploaded with download URL', async () => {
    const onUploaded = vi.fn();
    server.use(
      http.post(`${API_BASE}/api/attachments/neuron/:neuronId`, () =>
        HttpResponse.json({
          id: 'att-1',
          neuronId: 'neuron-1',
          fileName: 'test.mp3',
          filePath: 'abc_test.mp3',
          fileSize: 1024,
          contentType: 'audio/mpeg',
          createdAt: '2024-01-01T00:00:00',
        })
      )
    );

    const { result } = renderHook(() =>
      useAttachmentUpload({ neuronId: 'neuron-1', onUploaded })
    );

    const file = new File(['audio-data'], 'test.mp3', { type: 'audio/mpeg' });

    await act(async () => {
      await result.current.upload(file);
    });

    expect(result.current.uploading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(onUploaded).toHaveBeenCalledWith(
      `${API_BASE}/api/attachments/att-1/download`,
      expect.objectContaining({ id: 'att-1', fileName: 'test.mp3' })
    );
  });

  it('sets error on upload failure', async () => {
    const onUploaded = vi.fn();
    server.use(
      http.post(`${API_BASE}/api/attachments/neuron/:neuronId`, () =>
        HttpResponse.json({ message: 'File too large' }, { status: 413 })
      )
    );

    const { result } = renderHook(() =>
      useAttachmentUpload({ neuronId: 'neuron-1', onUploaded })
    );

    const file = new File(['data'], 'big.mp3', { type: 'audio/mpeg' });

    await act(async () => {
      await result.current.upload(file);
    });

    expect(result.current.uploading).toBe(false);
    expect(result.current.error).toBeTruthy();
    expect(onUploaded).not.toHaveBeenCalled();
  });

  it('does nothing when neuronId is undefined', async () => {
    const onUploaded = vi.fn();
    const { result } = renderHook(() =>
      useAttachmentUpload({ neuronId: undefined, onUploaded })
    );

    const file = new File(['data'], 'test.mp3', { type: 'audio/mpeg' });

    await act(async () => {
      await result.current.upload(file);
    });

    expect(onUploaded).not.toHaveBeenCalled();
    expect(result.current.uploading).toBe(false);
  });

  it('clears error via clearError', async () => {
    const onUploaded = vi.fn();
    server.use(
      http.post(`${API_BASE}/api/attachments/neuron/:neuronId`, () =>
        HttpResponse.json({ message: 'Fail' }, { status: 500 })
      )
    );

    const { result } = renderHook(() =>
      useAttachmentUpload({ neuronId: 'neuron-1', onUploaded })
    );

    const file = new File(['data'], 'test.mp3', { type: 'audio/mpeg' });

    await act(async () => {
      await result.current.upload(file);
    });

    expect(result.current.error).toBeTruthy();

    act(() => {
      result.current.clearError();
    });

    expect(result.current.error).toBeNull();
  });
});
